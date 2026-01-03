/**
 * SavedFilters（pdf-home）
 * - 主文件保持为“装配/委托层”，详细说明见：`docs/standards/pdf-home-saved-filters.md`
 */

import { SavedFiltersFeatureConfig } from "./feature.config.js";
import { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS, WEBSOCKET_EVENTS, FILTER_EVENTS, SEARCH_EVENTS } from "../../../../common/event/event-constants.js";
import { showError } from "../../../../common/utils/notification.js";
import { createSubscriptionBag } from "../../../../common/event/subscription-bag.js";
import { upsertSavedFilter } from "./saved-filters-collection.js";
import { escapeHtml, formatTimeHHMM } from "./saved-filters-text-utils.js";
import { buildSortSummary, toPythonExpression } from "./saved-filters-python-expression.js";
import { createSavedFiltersSaveDialog } from "./saved-filters-save-dialog.js";
import { createSavedFiltersManageDialog } from "./saved-filters-manage-dialog.js";

// 导入样式
import "./styles/saved-filters.css";

export class SavedFiltersFeature {
  name = SavedFiltersFeatureConfig.name;
  version = SavedFiltersFeatureConfig.version;
  dependencies = SavedFiltersFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #config = SavedFiltersFeatureConfig.config;
  #container = null;
  #listEl = null;
  #addBtn = null;
  #configBtn = null;
  #subscriptionBag = null;
  #storageKey = "pdf-home:saved-filters";
  #savedFilters = [];
  #pendingSaveTimer = null;
  #pendingGetConfigReqId = null;
  #lastFilters = null;   // 最近一次 filter:state:updated 的 filters（对象或null）
  #lastSort = null;      // 最近一次排序：{column, direction}
  #saveDialogController = null;
  #manageDialogController = null;

  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;
    this.#subscriptionBag = createSubscriptionBag({ loggerName: "SavedFiltersFeature.Subscriptions" });

    this.#logger.info(`[SavedFiltersFeature] Installing v${this.version}...`);

    try {
      // 1. 创建UI容器并挂载
      this.#createContainer();

      // 2. 绑定元素并初始化数据
      this.#bindElements();
      this.#loadFromStorage();
      this.#requestLoadFromBackend();
      this.#renderFilterList();

      // 3. 设置事件监听
      this.#setupEventListeners();

      this.#logger.info("[SavedFiltersFeature] Installed successfully");
    } catch (error) {
      this.#logger.error("[SavedFiltersFeature] Installation failed", error);
      throw error;
    }
  }

  async uninstall() {
    this.#logger.info("[SavedFiltersFeature] Uninstalling...");

    // 取消所有事件订阅
    if (this.#subscriptionBag) {
      this.#subscriptionBag.clear();
      this.#subscriptionBag = null;
    }

    if (this.#pendingSaveTimer) {
      clearTimeout(this.#pendingSaveTimer);
      this.#pendingSaveTimer = null;
    }

    try { this.#saveDialogController?.destroy?.(); } catch (e) { this.#logger?.debug?.("[SavedFiltersFeature] destroy save dialog failed", e); }
    this.#saveDialogController = null;
    try { this.#manageDialogController?.destroy?.(); } catch (e) { this.#logger?.debug?.("[SavedFiltersFeature] destroy manage dialog failed", e); }
    this.#manageDialogController = null;

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
    }

    this.#logger.info("[SavedFiltersFeature] Uninstalled");
  }

  #createContainer() {
    this.#container = document.createElement("div");
    this.#container.className = "saved-filters-section sidebar-section";
    this.#container.innerHTML =
      "<div class=\"saved-filters-header\">"
      + "<h3 class=\"saved-filters-title\">📌 已存搜索条件</h3>"
      + "<div class=\"btn-group\">"
      + "<button class=\"saved-filters-config-btn\" title=\"管理\">⚙️</button>"
      + "<button class=\"saved-filters-add-btn\" title=\"添加当前条件\">+</button>"
      + "</div></div>"
      + "<div class=\"saved-filters-list\">"
      + "<div class=\"saved-filters-empty\">暂无保存的搜索条件</div>"
      + "</div>";

    // 插入到侧边栏面板的开头（在所有section之前）
    const sidebarPanel = document.querySelector(".sidebar-panel");
    if (sidebarPanel) {
      sidebarPanel.insertBefore(this.#container, sidebarPanel.firstChild);
      this.#logger.debug("[SavedFiltersFeature] Container inserted at top of sidebar");
    } else {
      this.#logger.warn("[SavedFiltersFeature] Sidebar panel not found");
    }
  }

  #setupEventListeners() {
    // 添加按钮点击（打开命名对话框）
    if (this.#addBtn) {
      const onAdd = () => this.#openSaveDialog();
      this.#addBtn.addEventListener("click", onAdd);
      if (this.#subscriptionBag) {
        this.#subscriptionBag.add(() => this.#addBtn.removeEventListener("click", onAdd));
      }
    }

    // 列表点击（应用保存的条件）
    if (this.#listEl) {
      const onClick = (e) => {
        const item = e.target.closest(".saved-filter-item");
        if (!item) {return;}
        const id = item.getAttribute("data-id");
        const found = this.#savedFilters.find(sf => sf.id === id);
        if (found) {this.#applyFilter(found);}
      };
      this.#listEl.addEventListener("click", onClick);
      if (this.#subscriptionBag) {
        this.#subscriptionBag.add(() => this.#listEl.removeEventListener("click", onClick));
      }
    }

    // 配置按钮点击（打开管理对话框）
    if (this.#configBtn) {
      const onCfg = () => this.#openManageDialog();
      this.#configBtn.addEventListener("click", onCfg);
      if (this.#subscriptionBag) {
        this.#subscriptionBag.add(() => this.#configBtn.removeEventListener("click", onCfg));
      }
    }

    // 监听全局筛选状态更新（保存最近 filters）
    const unsubFilter = this.#globalEventBus.on(FILTER_EVENTS.STATE.UPDATED, (data) => {
      try { this.#lastFilters = data?.filters ?? null; } catch { this.#lastFilters = null; }
    }, { subscriberId: "SavedFiltersFeature" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubFilter);
    }

    // 监听 PDF 列表排序变化（保留最近排序信息）
    const unsubSort = this.#scopedEventBus.onGlobal("@pdf-list/sort:change:completed", (data) => {
      const column = data?.column; const direction = data?.direction;
      if (typeof column === "string" && (direction === "asc" || direction === "desc")) {
        this.#lastSort = { column, direction };
      }
    }, { subscriberId: "SavedFiltersFeature" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubSort);
    }

    // 监听后端配置回执（覆盖本地）
    const unsubWsResp = this.#scopedEventBus.onGlobal(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        if (!message || message.status !== "success") {return;}
        if (this.#pendingGetConfigReqId && message.request_id === this.#pendingGetConfigReqId) {
          this.#pendingGetConfigReqId = null;
          const cfg = message?.data?.config;
          if (cfg && Array.isArray(cfg.saved_filters)) {
            // 仅接受有效结构
            this.#savedFilters = cfg.saved_filters.filter(x => x && typeof x.id === "string");
            this.#saveToStorage();
            this.#renderFilterList();
            this.#logger.info("[SavedFiltersFeature] Synced saved_filters from backend");
          }
        }
      } catch (e) {
        this.#logger.error("[SavedFiltersFeature] Handle backend config failed", e);
      }
    }, { subscriberId: "SavedFiltersFeature" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubWsResp);
    }

    this.#logger.debug("[SavedFiltersFeature] Event listeners setup");
  }

  /**
   * 获取保存的搜索条件列表
   * @returns {Array} 搜索条件列表
   * @private
   */
  #getSavedFilters() {
    try {
      const raw = localStorage.getItem(this.#storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {return arr;}
      return [];
    } catch (e) {
      this.#logger.warn("[SavedFiltersFeature] Load from storage failed", e);
      return [];
    }
  }

  /**
   * 保存搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #saveFilter(filter) {
    const maxItems = (this.#config?.maxItems) || 50;
    this.#savedFilters = upsertSavedFilter({
      savedFilters: this.#savedFilters,
      newFilter: filter,
      maxItems,
      nowMs: Date.now()
    });
    this.#saveToStorage();
    this.#renderFilterList();
    this.#scheduleSaveToBackend();
  }

  // （已移除未使用的 #deleteFilter，避免 no-unused-private-class-members）

  /**
   * 应用搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #applyFilter(filter) {
    try {
      // 1) 更新搜索框文本（不依赖 DI，直接操作 DOM）
      const input = document.querySelector(".search-input");
      const clearBtn = document.querySelector(".clear-search-btn");
      if (input) {
        input.value = filter.searchText || "";
        if (clearBtn) {clearBtn.style.display = (filter.searchText || "").trim() ? "block" : "none";}
      }

      // 2) 广播筛选状态（让 SearchManager 记录 currentFilters）
      this.#globalEventBus.emit(FILTER_EVENTS.STATE.UPDATED, { filters: filter.filters || null });

      // 3) 发送搜索请求（透传 filters/sort）
      this.#globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, {
        searchText: filter.searchText || "",
        filters: filter.filters || null,
        sort: Array.isArray(filter.sort) ? filter.sort : undefined,
      });
    } catch (e) {
      this.#logger.error("[SavedFiltersFeature] Apply filter failed", e);
    }
  }

  /**
   * 渲染搜索条件列表
   * @private
   */
  #renderFilterList() {
    try {
      this.#listEl = this.#listEl || this.#container.querySelector(".saved-filters-list");
      if (!this.#listEl) {return;}
      const items = this.#savedFilters;
      if (!items || items.length === 0) {
        this.#listEl.innerHTML = "<div class=\"saved-filters-empty\">暂无保存的搜索条件</div>";
        return;
      }
      const html = items.map(sf => {
        const safeName = escapeHtml(sf.name || this.#buildDefaultName(sf));
        const timeStr = formatTimeHHMM(sf.ts || Date.now());
        return (
          `<div class="saved-filter-item" data-id="${sf.id}">`
          + "<span class=\"icon\">📌</span>"
          + `<span class="name" title="${safeName}">${safeName}</span>`
          + `<span class="time" title="${timeStr}">${timeStr}</span>`
          + "</div>"
        );
      }).join("\n");
      this.#listEl.innerHTML = html;
    } catch (e) {
      this.#logger.error("[SavedFiltersFeature] Render list failed", e);
    }
  }

  #bindElements() {
    try {
      this.#listEl = this.#container.querySelector(".saved-filters-list");
      this.#addBtn = this.#container.querySelector(".saved-filters-add-btn");
      this.#configBtn = this.#container.querySelector(".saved-filters-config-btn");
    } catch (e) {
      // logger-guard
      void e;
    }
  }

  #loadFromStorage() {
    this.#savedFilters = this.#getSavedFilters();
  }

  #saveToStorage() {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(this.#savedFilters));
    } catch (e) {
      this.#logger.warn("[SavedFiltersFeature] Save to storage failed", e);
    }
  }

  #requestLoadFromBackend() {
    try {
      const rid = `cfg_get_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      this.#pendingGetConfigReqId = rid;
      this.#scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, {
        type: WEBSOCKET_MESSAGE_TYPES.GET_CONFIG,
        request_id: rid,
        metadata: { version: "1.0.0" }
      });
    } catch (e) {
      this.#logger.warn("[SavedFiltersFeature] Request backend config failed", e);
    }
  }

  #scheduleSaveToBackend() {
    try {
      if (this.#pendingSaveTimer) {clearTimeout(this.#pendingSaveTimer);}
      this.#pendingSaveTimer = setTimeout(() => {
        this.#pendingSaveTimer = null;
        const rid = `cfg_up_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        this.#scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, {
          type: WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG,
          request_id: rid,
          metadata: { version: "1.0.0" },
          data: { saved_filters: this.#savedFilters }
        });
      }, 300);
    } catch (e) {
      this.#logger.warn("[SavedFiltersFeature] Schedule save backend failed", e);
    }
  }

  #handleAddCurrentCondition(nameFromDialog) {
    try {
      // 搜索词优先从 SearchManager 获取；退化到 DOM 输入框
      let searchText = "";
      try {
        const sm = this.#context?.container?.get && this.#context.container.get("searchManager");
        if (sm && typeof sm.getCurrentSearchText === "function") {searchText = sm.getCurrentSearchText() || "";}
      } catch (e) {
        // logger-guard
        void e;
      }
      if (!searchText) {
        const input = document.querySelector(".search-input");
        searchText = (input && input.value) ? String(input.value) : "";
      }

      const defaultName = this.#buildDefaultName({ searchText, filters: this.#lastFilters, sort: this.#buildSortRules() });
      const name = (typeof nameFromDialog === "string" && nameFromDialog.trim()) ? nameFromDialog.trim() : defaultName;
      const filter = {
        id: `sf_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        name,
        searchText,
        filters: this.#lastFilters || null,
        sort: this.#buildSortRules(),
        ts: Date.now()
      };
      this.#saveFilter(filter);
      this.#logger.info("[SavedFiltersFeature] Current condition saved", { name });
    } catch (e) {
      this.#logger.error("[SavedFiltersFeature] Add current condition failed", e);
    }
  }

  #buildDefaultName(sf) {
    const parts = [];
    const st = (sf?.searchText || "").trim();
    parts.push(st ? `关键词: ${st}` : "关键词: (全部)");
    if (sf?.filters) {parts.push("筛选: 已设置");}
    const sortRules = Array.isArray(sf?.sort) ? sf.sort : [];
    if (sortRules.length > 0) {
      const r = sortRules[0];
      parts.push(`排序: ${r.field || r.column || "?"} ${r.direction || ""}`);
    }
    return parts.join(" | ");
  }

  #buildSortRules() {
    if (this.#lastSort && this.#lastSort.column) {
      return [{ field: this.#lastSort.column, direction: this.#lastSort.direction || "asc" }];
    }
    return [];
  }

  #openSaveDialog() {
    try {
      const snapshot = this.#buildCurrentSnapshot();
      if (!this.#saveDialogController) {
        this.#saveDialogController = createSavedFiltersSaveDialog({
          logger: this.#logger,
          onConfirmName: (name) => {
            if (!name) {
              showError("请输入名称", 3000);
              return false;
            }
            this.#handleAddCurrentCondition(name);
            return true;
          }
        });
      }
      this.#saveDialogController.open({
        defaultName: snapshot.defaultName,
        summaryHtml: this.#buildSummaryHtml(snapshot)
      });
    } catch (e) {
      this.#logger.error("[SavedFiltersFeature] Open save dialog failed", e);
    }
  }

  #buildCurrentSnapshot() {
    let searchText = "";
    try {
      const sm = this.#context?.container?.get && this.#context.container.get("searchManager");
      if (sm && typeof sm.getCurrentSearchText === "function") {searchText = sm.getCurrentSearchText() || "";}
    } catch (e) {
      // logger-guard
      void e;
    }
    if (!searchText) {
      const input = document.querySelector(".search-input");
      searchText = (input && input.value) ? String(input.value) : "";
    }
    const sortRules = this.#buildSortRules();
    const defaultName = this.#buildDefaultName({ searchText, filters: this.#lastFilters, sort: sortRules });
    return { searchText, filters: this.#lastFilters, sort: sortRules, defaultName };
  }

  #buildSummaryHtml(snapshot) {
    const kw = escapeHtml(snapshot.searchText || "(全部)");
    const filtersExpr = escapeHtml(this.#buildFiltersPython(snapshot.filters));
    const sortSummary = escapeHtml(this.#buildSortSummary(snapshot.sort));
    return (
      `<div><strong>关键词</strong>：${kw}</div>` +
      `<div><strong>筛选</strong>：<code>${filtersExpr}</code></div>` +
      `<div><strong>排序</strong>：${sortSummary}</div>`
    );
  }

  #buildFiltersPython(filters) {
    if (!filters) {return "True";}
    return this.#toPython(filters);
  }

  #buildSortSummary(sortRules) {
    return buildSortSummary(sortRules);
  }

  #toPython(cfg) {
    return toPythonExpression(cfg);
  }

  // ========== 管理对话框（排序/重命名/复制/删除） ==========
  #openManageDialog() {
    try {
      if (!this.#manageDialogController) {
        this.#manageDialogController = createSavedFiltersManageDialog({
          logger: this.#logger,
          escapeHtml,
          onSaveList: (nextList) => {
            this.#savedFilters = nextList;
            this.#saveToStorage();
            this.#renderFilterList();
            this.#scheduleSaveToBackend();
            this.#logger.info("[SavedFiltersFeature] Manage dialog saved", { count: this.#savedFilters.length });
          }
        });
      }
      this.#manageDialogController.open(this.#savedFilters);
    } catch (e) {
      this.#logger.error("[SavedFiltersFeature] Open manage dialog failed", e);
    }
  }
}

