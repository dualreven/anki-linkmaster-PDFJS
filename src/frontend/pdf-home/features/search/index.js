/**
 * Search Feature - PDF搜索功能插件
 * 面向用户的搜索起点，提供搜索框UI和基础搜索逻辑
 */

import { SearchBar } from "./components/search-bar.js";
import { SearchManager } from "./services/search-manager.js";

// 导入样式
import "./styles/search-bar.css";
import "./styles/search-panel.css";
import { showInfoWithId, dismissById } from "../../../common/utils/notification.js";

export class SearchFeature {
  name = "search";
  version = "1.0.0";
  dependencies = [];  // 不需要 wsClient，使用 EventBus 通信

  #logger = null;
  #scopedEventBus = null;  // 内部事件总线（带@search/前缀）
  #globalEventBus = null;  // 全局事件总线（跨Feature通信）
  #searchBar = null;
  #searchPanel = null;
  #searchManager = null;  // 搜索管理器
  #unsubscribers = [];

  /**
   * 安装插件
   */
  async install(context) {
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;
    const sidBase = `se-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

    this.#logger.info("[SearchFeature] Installing...");

    try {
      // 1. 创建搜索面板DOM
      this.#createSearchPanel();
      this.#logger.info('[SearchFeature] Step1: Search panel created');

      // 2. 初始化SearchBar组件（使用scopedEventBus用于内部事件）
      this.#searchBar = new SearchBar(this.#logger, this.#scopedEventBus);
      this.#searchBar.render(this.#searchPanel.querySelector(".search-panel-content"));
      this.#logger.info('[SearchFeature] Step2: SearchBar rendered');

      // 3. 创建 SearchManager（使用全局 EventBus）
      this.#searchManager = new SearchManager(this.#globalEventBus);

      // 4. 注册 SearchManager 到容器（可选，供其他 Feature 使用）
      try {
        if (typeof context.container?.has === 'function' && !context.container.has('searchManager')) {
          context.container.register('searchManager', this.#searchManager);
          this.#logger.info('[SearchFeature] Step3: searchManager registered in container');
        } else {
          this.#logger.warn('[SearchFeature] searchManager already registered in container, reusing existing');
        }
      } catch (e) {
        // 避免重复注册导致安装失败，记录并继续
        this.#logger.warn('[SearchFeature] Register searchManager failed (will continue)', e);
      }

      // 5. 监听内部事件，转发到全局EventBus
      this.#setupEventBridge(sidBase);
      this.#logger.info('[SearchFeature] Step4: Event bridge set up');

      // 6. 监听全局事件（搜索结果更新）
      this.#setupGlobalEventListeners(sidBase);
      this.#logger.info('[SearchFeature] Step5: Global listeners set up');

      this.#logger.info("[SearchFeature] Installed successfully");
    } catch (error) {
      try { this.#logger.error('[SearchFeature] Installation failed (stack)', error?.stack || '(no stack)'); } catch(_) {}
      try { this.#logger.error('[SearchFeature] Installation failed (message)', error?.message || String(error)); } catch(_) {}
      try { this.#logger.error('[SearchFeature] Installation failed (object)', error); } catch(_) {}
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info("[SearchFeature] Uninstalling...");

    // 取消所有事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁 SearchManager
    if (this.#searchManager) {
      this.#searchManager.destroy();
      this.#searchManager = null;
    }

    // 销毁组件
    if (this.#searchBar) {
      this.#searchBar.destroy();
      this.#searchBar = null;
    }

    // 移除DOM
    if (this.#searchPanel) {
      this.#searchPanel.remove();
      this.#searchPanel = null;
    }

    this.#logger.info("[SearchFeature] Uninstalled");
  }

  /**
   * 创建搜索面板DOM
   * @private
   */
  #createSearchPanel() {
    this.#searchPanel = document.createElement("div");
    this.#searchPanel.className = "search-panel active";
    this.#searchPanel.innerHTML = `
      <div class="search-panel-content">
        <!-- SearchBar组件将在这里渲染 -->
      </div>
    `;

    // 插入到body顶部（fixed定位）
    document.body.insertBefore(this.#searchPanel, document.body.firstChild);

    this.#logger.debug("[SearchFeature] Search panel created");
  }

  /**
   * 设置事件桥接（内部事件 -> 全局事件）
   * @param {string} sidBase - 订阅者ID基础字符串
   * @private
   */
  #setupEventBridge(sidBase) {
    // 搜索请求 -> 转发到全局
    const unsubSearch = this.#scopedEventBus.on("search:query:requested", (data) => {
      this.#logger.info("[SearchFeature] Forwarding search query to global", data);
      this.#globalEventBus.emit("search:query:requested", data);
    }, { subscriberId: `${this.name}:${sidBase}:forward-search-query` });
    this.#unsubscribers.push(unsubSearch);

    // 清除请求 -> 转发到全局
    const unsubClear = this.#scopedEventBus.on("search:clear:requested", () => {
      this.#logger.info("[SearchFeature] Forwarding clear request to global");
      this.#globalEventBus.emit("search:clear:requested");
    }, { subscriberId: `${this.name}:${sidBase}:forward-clear` });
    this.#unsubscribers.push(unsubClear);

    // 添加按钮点击 -> 转发到全局
    const unsubAdd = this.#scopedEventBus.on("search:add:requested", () => {
      this.#logger.info("[SearchFeature] Forwarding add request to global");
      this.#globalEventBus.emit("search:add:requested");
    }, { subscriberId: `${this.name}:${sidBase}:forward-add` });
    this.#unsubscribers.push(unsubAdd);

    // 排序按钮点击 -> 转发到全局
    const unsubSort = this.#scopedEventBus.on("search:sort:requested", () => {
      this.#logger.info("[SearchFeature] Forwarding sort request to global");
      this.#globalEventBus.emit("search:sort:requested");
    }, { subscriberId: `${this.name}:${sidBase}:forward-sort` });
    this.#unsubscribers.push(unsubSort);

    // 高级筛选按钮点击 -> 转发到全局
    const unsubAdvanced = this.#scopedEventBus.on("search:advanced:clicked", () => {
      this.#logger.info("[SearchFeature] Forwarding advanced click to global");
      this.#globalEventBus.emit("filter:advanced:open");
    }, { subscriberId: `${this.name}:${sidBase}:forward-advanced` });
    this.#unsubscribers.push(unsubAdvanced);

    // 保存预设 -> 转发到全局
    const unsubPreset = this.#scopedEventBus.on("search:preset:save", (data) => {
      this.#logger.info("[SearchFeature] Forwarding preset save to global", data);
      this.#globalEventBus.emit("filter:preset:save", data);
    }, { subscriberId: `${this.name}:${sidBase}:forward-preset-save` });
    this.#unsubscribers.push(unsubPreset);
  }

  /**
   * 监听全局事件
   * @param {string} sidBase - 订阅者ID基础字符串
   * @private
   */
  #setupGlobalEventListeners(sidBase) {
    // 搜索开始：显示"搜索中"
    const unsubStarted = this.#globalEventBus.on("search:query:started", () => {
      try {
        // 用户偏好：非粘性 3000ms
        showInfoWithId("search:busy", "搜索中", 3000);
      } catch (e) {
        this.#logger?.warn("[SearchFeature] showInfoWithId failed", e);
      }
    }, { subscriberId: `${this.name}:${sidBase}:search-query-started` });
    this.#unsubscribers.push(unsubStarted);

    // 监听搜索结果更新
    const unsubResults = this.#globalEventBus.on("search:results:updated", (data) => {
      this.#logger.debug("[SearchFeature] Search results updated", data);

      if (this.#searchBar) {
        this.#searchBar.updateStats({
          count: data.count || 0,
          hasResults: data.count > 0
        });
      }
      try { dismissById("search:busy"); } catch { /* ignore dismiss errors */ }
    }, { subscriberId: `${this.name}:${sidBase}:search-results-updated` });
    this.#unsubscribers.push(unsubResults);

    // 搜索失败：隐藏进行中的提示
    const unsubFailed = this.#globalEventBus.on("search:results:failed", () => {
      try { dismissById("search:busy"); } catch { /* ignore dismiss errors */ }
    }, { subscriberId: `${this.name}:${sidBase}:search-results-failed` });
    this.#unsubscribers.push(unsubFailed);
  }
}
