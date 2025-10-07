/**
 * SavedFilters Feature - 已存搜索条件插件
 * 提供保存和管理搜索条件的功能
 */

import { SavedFiltersFeatureConfig } from './feature.config.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';

// 导入样式
import './styles/saved-filters.css';

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
  #unsubscribers = [];
  #storageKey = 'pdf-home:saved-filters';
  #savedFilters = [];
  #pendingSaveTimer = null;
  #pendingGetConfigReqId = null;
  #lastFilters = null;   // 最近一次 filter:state:updated 的 filters（对象或null）
  #lastSort = null;      // 最近一次排序：{column, direction}
  #saveDialog = null;
  #saveNameInput = null;
  #saveSummaryEl = null;
  #manageDialog = null;
  #manageListEl = null;
  #editorList = [];

  /**
   * 安装插件
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

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

      this.#logger.info('[SavedFiltersFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SavedFiltersFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info('[SavedFiltersFeature] Uninstalling...');

    // 取消所有事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
    }

    this.#logger.info('[SavedFiltersFeature] Uninstalled');
  }

  /**
   * 创建UI容器
   * @private
   */
  #createContainer() {
    this.#container = document.createElement('div');
    this.#container.className = 'saved-filters-section sidebar-section';
    this.#container.innerHTML = `
      <div class="saved-filters-header">
        <h3 class="saved-filters-title">📌 已存搜索条件</h3>
        <div class="btn-group">
          <button class="saved-filters-config-btn" title="管理">⚙️</button>
          <button class="saved-filters-add-btn" title="添加当前条件">+</button>
        </div>
      </div>
      <div class="saved-filters-list">
        <!-- 搜索条件列表将在这里显示 -->
        <div class="saved-filters-empty">暂无保存的搜索条件</div>
      </div>
    `;

    // 插入到侧边栏面板的开头（在所有section之前）
    const sidebarPanel = document.querySelector('.sidebar-panel');
    if (sidebarPanel) {
      sidebarPanel.insertBefore(this.#container, sidebarPanel.firstChild);
      this.#logger.debug('[SavedFiltersFeature] Container inserted at top of sidebar');
    } else {
      this.#logger.warn('[SavedFiltersFeature] Sidebar panel not found');
    }
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 添加按钮点击（打开命名对话框）
    if (this.#addBtn) {
      const onAdd = () => this.#openSaveDialog();
      this.#addBtn.addEventListener('click', onAdd);
      this.#unsubscribers.push(() => this.#addBtn.removeEventListener('click', onAdd));
    }

    // 列表点击（应用保存的条件）
    if (this.#listEl) {
      const onClick = (e) => {
        const item = e.target.closest('.saved-filter-item');
        if (!item) return;
        const id = item.getAttribute('data-id');
        const found = this.#savedFilters.find(sf => sf.id === id);
        if (found) this.#applyFilter(found);
      };
      this.#listEl.addEventListener('click', onClick);
      this.#unsubscribers.push(() => this.#listEl.removeEventListener('click', onClick));
    }

    // 配置按钮点击（打开管理对话框）
    if (this.#configBtn) {
      const onCfg = () => this.#openManageDialog();
      this.#configBtn.addEventListener('click', onCfg);
      this.#unsubscribers.push(() => this.#configBtn.removeEventListener('click', onCfg));
    }

    // 监听全局筛选状态更新（保存最近 filters）
    const unsubFilter = this.#globalEventBus.on('filter:state:updated', (data) => {
      try { this.#lastFilters = data?.filters ?? null; } catch { this.#lastFilters = null; }
    }, { subscriberId: 'SavedFiltersFeature' });
    this.#unsubscribers.push(unsubFilter);

    // 监听 PDF 列表排序变化（保留最近排序信息）
    const unsubSort = this.#scopedEventBus.onGlobal('@pdf-list/sort:change:completed', (data) => {
      const column = data?.column; const direction = data?.direction;
      if (typeof column === 'string' && (direction === 'asc' || direction === 'desc')) {
        this.#lastSort = { column, direction };
      }
    }, { subscriberId: 'SavedFiltersFeature' });
    this.#unsubscribers.push(unsubSort);

    // 监听后端配置回执（覆盖本地）
    const unsubWsResp = this.#scopedEventBus.onGlobal('websocket:message:response', (message) => {
      try {
        if (!message || message.status !== 'success') return;
        if (this.#pendingGetConfigReqId && message.request_id === this.#pendingGetConfigReqId) {
          this.#pendingGetConfigReqId = null;
          const cfg = message?.data?.config;
          if (cfg && Array.isArray(cfg.saved_filters)) {
            // 仅接受有效结构
            this.#savedFilters = cfg.saved_filters.filter(x => x && typeof x.id === 'string');
            this.#saveToStorage();
            this.#renderFilterList();
            this.#logger.info('[SavedFiltersFeature] Synced saved_filters from backend');
          }
        }
      } catch (e) {
        this.#logger.error('[SavedFiltersFeature] Handle backend config failed', e);
      }
    }, { subscriberId: 'SavedFiltersFeature' });
    this.#unsubscribers.push(unsubWsResp);

    this.#logger.debug('[SavedFiltersFeature] Event listeners setup');
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
      if (Array.isArray(arr)) return arr;
      return [];
    } catch (e) {
      this.#logger.warn('[SavedFiltersFeature] Load from storage failed', e);
      return [];
    }
  }

  /**
   * 保存搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #saveFilter(filter) {
    // 去重：同名+同内容则更新时间，不重复插入
    const key = JSON.stringify({ searchText: filter.searchText || '', filters: filter.filters || null, sort: filter.sort || [] });
    const existIdx = this.#savedFilters.findIndex(sf => JSON.stringify({ searchText: sf.searchText || '', filters: sf.filters || null, sort: sf.sort || [] }) === key);
    if (existIdx >= 0) {
      const exist = this.#savedFilters[existIdx];
      const updated = { ...exist, name: filter.name || exist.name, ts: Date.now() };
      this.#savedFilters.splice(existIdx, 1);
      this.#savedFilters.unshift(updated);
    } else {
      this.#savedFilters.unshift(filter);
    }
    // 截断最大数量
    const maxItems = (this.#config?.maxItems) || 50;
    if (this.#savedFilters.length > maxItems) this.#savedFilters.length = maxItems;
    this.#saveToStorage();
    this.#renderFilterList();
    this.#scheduleSaveToBackend();
  }

  /**
   * 删除搜索条件
   * @param {string} filterId - 条件ID
   * @private
   */
  #deleteFilter(filterId) {
    const idx = this.#savedFilters.findIndex(sf => sf.id === filterId);
    if (idx >= 0) {
      this.#savedFilters.splice(idx, 1);
      this.#saveToStorage();
      this.#renderFilterList();
      this.#scheduleSaveToBackend();
    }
  }

  /**
   * 应用搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #applyFilter(filter) {
    try {
      // 1) 更新搜索框文本（不依赖 DI，直接操作 DOM）
      const input = document.querySelector('.search-input');
      const clearBtn = document.querySelector('.clear-search-btn');
      if (input) {
        input.value = filter.searchText || '';
        if (clearBtn) clearBtn.style.display = (filter.searchText || '').trim() ? 'block' : 'none';
      }

      // 2) 广播筛选状态（让 SearchManager 记录 currentFilters）
      this.#globalEventBus.emit('filter:state:updated', { filters: filter.filters || null });

      // 3) 发送搜索请求（透传 filters/sort）
      this.#globalEventBus.emit('search:query:requested', {
        searchText: filter.searchText || '',
        filters: filter.filters || null,
        sort: Array.isArray(filter.sort) ? filter.sort : undefined,
      });
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Apply filter failed', e);
    }
  }

  /**
   * 渲染搜索条件列表
   * @private
   */
  #renderFilterList() {
    try {
      this.#listEl = this.#listEl || this.#container.querySelector('.saved-filters-list');
      if (!this.#listEl) return;
      const items = this.#savedFilters;
      if (!items || items.length === 0) {
        this.#listEl.innerHTML = '<div class="saved-filters-empty">暂无保存的搜索条件</div>';
        return;
      }
      const html = items.map(sf => {
        const safeName = this.#escapeHtml(sf.name || this.#buildDefaultName(sf));
        const timeStr = this.#formatTime(sf.ts || Date.now());
        return (
          `<div class="saved-filter-item" data-id="${sf.id}">`
          + `<span class="icon">📌</span>`
          + `<span class="name" title="${safeName}">${safeName}</span>`
          + `<span class="time" title="${timeStr}">${timeStr}</span>`
          + `</div>`
        );
      }).join('\n');
      this.#listEl.innerHTML = html;
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Render list failed', e);
    }
  }

  #bindElements() {
    try {
      this.#listEl = this.#container.querySelector('.saved-filters-list');
      this.#addBtn = this.#container.querySelector('.saved-filters-add-btn');
      this.#configBtn = this.#container.querySelector('.saved-filters-config-btn');
    } catch {}
  }

  #loadFromStorage() {
    this.#savedFilters = this.#getSavedFilters();
  }

  #saveToStorage() {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(this.#savedFilters));
    } catch (e) {
      this.#logger.warn('[SavedFiltersFeature] Save to storage failed', e);
    }
  }

  #requestLoadFromBackend() {
    try {
      const rid = `cfg_get_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      this.#pendingGetConfigReqId = rid;
      this.#scopedEventBus.emitGlobal('websocket:message:send', {
        type: WEBSOCKET_MESSAGE_TYPES.GET_CONFIG,
        request_id: rid
      });
    } catch (e) {
      this.#logger.warn('[SavedFiltersFeature] Request backend config failed', e);
    }
  }

  #scheduleSaveToBackend() {
    try {
      if (this.#pendingSaveTimer) clearTimeout(this.#pendingSaveTimer);
      this.#pendingSaveTimer = setTimeout(() => {
        this.#pendingSaveTimer = null;
        const rid = `cfg_up_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        this.#scopedEventBus.emitGlobal('websocket:message:send', {
          type: WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG,
          request_id: rid,
          data: { saved_filters: this.#savedFilters }
        });
      }, 300);
    } catch (e) {
      this.#logger.warn('[SavedFiltersFeature] Schedule save backend failed', e);
    }
  }

  #handleAddCurrentCondition(nameFromDialog) {
    try {
      // 搜索词优先从 SearchManager 获取；退化到 DOM 输入框
      let searchText = '';
      try {
        const sm = this.#context?.container?.get && this.#context.container.get('searchManager');
        if (sm && typeof sm.getCurrentSearchText === 'function') searchText = sm.getCurrentSearchText() || '';
      } catch {}
      if (!searchText) {
        const input = document.querySelector('.search-input');
        searchText = (input && input.value) ? String(input.value) : '';
      }

      const defaultName = this.#buildDefaultName({ searchText, filters: this.#lastFilters, sort: this.#buildSortRules() });
      const name = (typeof nameFromDialog === 'string' && nameFromDialog.trim()) ? nameFromDialog.trim() : defaultName;
      const filter = {
        id: `sf_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        name,
        searchText,
        filters: this.#lastFilters || null,
        sort: this.#buildSortRules(),
        ts: Date.now()
      };
      this.#saveFilter(filter);
      this.#logger.info('[SavedFiltersFeature] Current condition saved', { name });
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Add current condition failed', e);
    }
  }

  #buildDefaultName(sf) {
    const parts = [];
    const st = (sf?.searchText || '').trim();
    parts.push(st ? `关键词: ${st}` : '关键词: (全部)');
    if (sf?.filters) parts.push('筛选: 已设置');
    const sortRules = Array.isArray(sf?.sort) ? sf.sort : [];
    if (sortRules.length > 0) {
      const r = sortRules[0];
      parts.push(`排序: ${r.field || r.column || '?'} ${r.direction || ''}`);
    }
    return parts.join(' | ');
  }

  #buildSortRules() {
    if (this.#lastSort && this.#lastSort.column) {
      return [{ field: this.#lastSort.column, direction: this.#lastSort.direction || 'asc' }];
    }
    return [];
  }

  #escapeHtml(str) {
    try {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    } catch { return ''; }
  }

  #formatTime(ts) {
    try {
      const d = new Date(ts || Date.now());
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch { return ''; }
  }

  #openSaveDialog() {
    try {
      if (!this.#saveDialog) {
        this.#createSaveDialog();
      }
      const snapshot = this.#buildCurrentSnapshot();
      this.#saveNameInput.value = snapshot.defaultName;
      this.#saveSummaryEl.innerHTML = this.#buildSummaryHtml(snapshot);
      this.#saveDialog.hidden = false;
      setTimeout(() => { try { this.#saveNameInput.focus(); } catch {} }, 50);
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Open save dialog failed', e);
    }
  }

  #closeSaveDialog() {
    if (this.#saveDialog) {
      this.#saveDialog.hidden = true;
    }
  }

  #createSaveDialog() {
    const html = `
      <div class="preset-save-dialog" hidden>
        <div class="preset-dialog-overlay"></div>
        <div class="preset-dialog-content">
          <div class="preset-dialog-header">
            <h3>💾 保存搜索条件</h3>
            <button class="preset-dialog-close" aria-label="关闭">&times;</button>
          </div>
          <div class="preset-dialog-body">
            <label for="sf-preset-name-input">名称:</label>
            <input type="text" id="sf-preset-name-input" class="preset-name-input" placeholder="请输入名称..." autocomplete="off" />
            <div class="preset-description">
              <small>将保存当前的搜索关键词、筛选条件与排序规则</small>
            </div>
            <div id="sf-preset-summary" style="margin-top:8px"></div>
          </div>
          <div class="preset-dialog-footer">
            <button class="preset-dialog-cancel">取消</button>
            <button class="preset-dialog-save">保存</button>
          </div>
        </div>
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    this.#saveDialog = wrapper.firstChild;
    document.body.appendChild(this.#saveDialog);
    this.#saveNameInput = this.#saveDialog.querySelector('#sf-preset-name-input');
    this.#saveSummaryEl = this.#saveDialog.querySelector('#sf-preset-summary');

    const closeBtn = this.#saveDialog.querySelector('.preset-dialog-close');
    const cancelBtn = this.#saveDialog.querySelector('.preset-dialog-cancel');
    const saveBtn = this.#saveDialog.querySelector('.preset-dialog-save');
    const overlay = this.#saveDialog.querySelector('.preset-dialog-overlay');
    if (closeBtn) closeBtn.addEventListener('click', () => this.#closeSaveDialog());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.#closeSaveDialog());
    if (overlay) overlay.addEventListener('click', () => this.#closeSaveDialog());
    if (saveBtn) saveBtn.addEventListener('click', () => this.#handleConfirmSave());
    if (this.#saveNameInput) {
      this.#saveNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.#handleConfirmSave();
      });
    }
  }

  #handleConfirmSave() {
    try {
      const name = (this.#saveNameInput && this.#saveNameInput.value) ? this.#saveNameInput.value.trim() : '';
      if (!name) { alert('请输入名称'); return; }
      this.#handleAddCurrentCondition(name);
      this.#closeSaveDialog();
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Confirm save failed', e);
    }
  }

  #buildCurrentSnapshot() {
    let searchText = '';
    try {
      const sm = this.#context?.container?.get && this.#context.container.get('searchManager');
      if (sm && typeof sm.getCurrentSearchText === 'function') searchText = sm.getCurrentSearchText() || '';
    } catch {}
    if (!searchText) {
      const input = document.querySelector('.search-input');
      searchText = (input && input.value) ? String(input.value) : '';
    }
    const sortRules = this.#buildSortRules();
    const defaultName = this.#buildDefaultName({ searchText, filters: this.#lastFilters, sort: sortRules });
    return { searchText, filters: this.#lastFilters, sort: sortRules, defaultName };
  }

  #buildSummaryHtml(snapshot) {
    const kw = this.#escapeHtml(snapshot.searchText || '(全部)');
    const filtersExpr = this.#escapeHtml(this.#buildFiltersPython(snapshot.filters));
    const sortSummary = this.#escapeHtml(this.#buildSortSummary(snapshot.sort));
    return (
      `<div><strong>关键词</strong>：${kw}</div>` +
      `<div><strong>筛选</strong>：<code>${filtersExpr}</code></div>` +
      `<div><strong>排序</strong>：${sortSummary}</div>`
    );
  }

  #buildFiltersPython(filters) {
    try {
      if (!filters) return 'True';
      return this.#toPython(filters);
    } catch { return 'True'; }
  }

  #buildSortSummary(sortRules) {
    try {
      const arr = Array.isArray(sortRules) ? sortRules : [];
      if (arr.length === 0) return '默认';
      return arr.map(r => `${r.field || r.column || '?'} ${r.direction || ''}`).join(', ');
    } catch { return '无'; }
  }

  // 将条件配置对象转换为Python表达式
  #toPython(cfg) {
    if (!cfg || typeof cfg !== 'object') return 'True';

    // 组合条件
    if (cfg.type === 'composite') {
      const op = String(cfg.operator || 'AND').toUpperCase();
      const xs = (cfg.conditions || []).map(c => this.#toPython(c)).filter(Boolean);
      if (op === 'NOT') {
        return xs.length ? `not (${xs[0]})` : 'True';
      }
      if (op === 'AND') {
        return xs.length === 1 ? xs[0] : `(${xs.join(' and ')})`;
      }
      if (op === 'OR') {
        return xs.length === 1 ? xs[0] : `(${xs.join(' or ')})`;
      }
      return xs.join(' and ');
    }

    // 字段条件
    if (cfg.type === 'field') {
      const field = String(cfg.field || 'field');
      const operator = String(cfg.operator || 'eq');
      const value = cfg.value;
      const str = (v) => (typeof v === 'number' || typeof v === 'boolean') ? String(v) : `"${String(v)}"`;
      switch (operator) {
        case 'contains': return `${str(value)} in ${field}`;
        case 'not_contains': return `${str(value)} not in ${field}`;
        case 'eq': return `${field} == ${str(value)}`;
        case 'ne': return `${field} != ${str(value)}`;
        case 'gt': return `${field} > ${value}`;
        case 'lt': return `${field} < ${value}`;
        case 'gte': return `${field} >= ${value}`;
        case 'lte': return `${field} <= ${value}`;
        case 'starts_with': return `${field}.startswith(${str(value)})`;
        case 'ends_with': return `${field}.endswith(${str(value)})`;
        case 'in_range': {
          try {
            const [min, max] = String(value || '').split(',');
            return `${min} <= ${field} <= ${max}`;
          } catch { return `${field}`; }
        }
        default: return `${field} ${operator} ${str(value)}`;
      }
    }

    // 模糊条件（将关键词映射为若干个“任一字段包含”表达式，再按 any/all 组合）
    if (cfg.type === 'fuzzy') {
      const keywords = Array.isArray(cfg.keywords) ? cfg.keywords : [];
      const fields = Array.isArray(cfg.searchFields) && cfg.searchFields.length ? cfg.searchFields : ['filename','tags','notes'];
      const perKw = (kw) => `(${fields.map(f => `"${kw}" in ${f}`).join(' or ')})`;
      if (keywords.length === 0) return 'True';
      const exprs = keywords.map(perKw);
      const mode = String(cfg.matchMode || 'any').toLowerCase();
      return mode === 'all' ? `(${exprs.join(' and ')})` : `(${exprs.join(' or ')})`;
    }

    // 未知或无条件
    return 'True';
  }

  // ========== 管理对话框（排序/重命名/复制/删除） ==========
  #openManageDialog() {
    try {
      if (!this.#manageDialog) this.#createManageDialog();
      // 克隆数据到编辑列表
      this.#editorList = (this.#savedFilters || []).map(sf => ({ ...sf }));
      this.#renderManageList();
      this.#manageDialog.hidden = false;
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Open manage dialog failed', e);
    }
  }

  #closeManageDialog() {
    if (this.#manageDialog) this.#manageDialog.hidden = true;
  }

  #createManageDialog() {
    const html = `
      <div class="preset-save-dialog" hidden>
        <div class="preset-dialog-overlay"></div>
        <div class="preset-dialog-content">
          <div class="preset-dialog-header">
            <h3>⚙️ 管理已存搜索条件</h3>
            <button class="preset-dialog-close" aria-label="关闭">&times;</button>
          </div>
          <div class="preset-dialog-body">
            <div class="sf-manage-list" id="sf-manage-list"></div>
          </div>
          <div class="preset-dialog-footer">
            <button class="preset-dialog-cancel">取消</button>
            <button class="preset-dialog-save">确定</button>
          </div>
        </div>
      </div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    this.#manageDialog = wrap.firstChild;
    document.body.appendChild(this.#manageDialog);
    this.#manageListEl = this.#manageDialog.querySelector('#sf-manage-list');
    // 绑定按钮
    const closeBtn = this.#manageDialog.querySelector('.preset-dialog-close');
    const cancelBtn = this.#manageDialog.querySelector('.preset-dialog-cancel');
    const saveBtn = this.#manageDialog.querySelector('.preset-dialog-save');
    const overlay = this.#manageDialog.querySelector('.preset-dialog-overlay');
    if (closeBtn) closeBtn.addEventListener('click', () => this.#closeManageDialog());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.#closeManageDialog());
    if (overlay) overlay.addEventListener('click', () => this.#closeManageDialog());
    if (saveBtn) saveBtn.addEventListener('click', () => this.#handleManageSave());
  }

  #renderManageList() {
    if (!this.#manageListEl) return;
    if (!Array.isArray(this.#editorList) || this.#editorList.length === 0) {
      this.#manageListEl.innerHTML = '<div class="saved-filters-empty">暂无数据</div>';
      return;
    }
    const html = this.#editorList.map((sf, idx) => (
      `<div class="sf-manage-item" draggable="true" data-index="${idx}">` +
      `<span class="sf-drag-handle" title="拖动排序">☰</span>` +
      `<input class="sf-name-input" type="text" value="${this.#escapeHtml(sf.name || '')}" data-index="${idx}" />` +
      `<button class="sf-btn sf-dup" data-index="${idx}" title="复制">📄</button>` +
      `<button class="sf-btn sf-del" data-index="${idx}" title="删除">🗑️</button>` +
      `</div>`
    )).join('\n');
    this.#manageListEl.innerHTML = html;
    this.#bindManageEvents();
  }

  #bindManageEvents() {
    // 名称编辑
    this.#manageListEl.querySelectorAll('.sf-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'));
        if (!Number.isNaN(i) && this.#editorList[i]) {
          this.#editorList[i].name = e.target.value;
        }
      });
    });
    // 删除
    this.#manageListEl.querySelectorAll('.sf-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-index'));
        if (!Number.isNaN(i)) {
          this.#editorList.splice(i, 1);
          this.#renderManageList();
        }
      });
    });
    // 复制
    this.#manageListEl.querySelectorAll('.sf-dup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-index'));
        if (!Number.isNaN(i) && this.#editorList[i]) {
          const base = this.#editorList[i];
          const copy = { ...base, id: `sf_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name: (base.name || '') + ' (副本)', ts: Date.now() };
          this.#editorList.splice(i + 1, 0, copy);
          this.#renderManageList();
        }
      });
    });
    // 拖动排序
    this.#manageListEl.querySelectorAll('.sf-manage-item').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', row.getAttribute('data-index'));
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'));
        const to = parseInt(row.getAttribute('data-index'));
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
        const moved = this.#editorList.splice(from, 1)[0];
        this.#editorList.splice(to, 0, moved);
        this.#renderManageList();
      });
    });
  }

  #handleManageSave() {
    try {
      // 过滤空名，保留原名逻辑
      this.#editorList = this.#editorList.map(sf => ({ ...sf, name: (sf.name && sf.name.trim()) ? sf.name.trim() : (sf.name || '') }));
      this.#savedFilters = this.#editorList;
      this.#saveToStorage();
      this.#renderFilterList();
      this.#scheduleSaveToBackend();
      this.#closeManageDialog();
      this.#logger.info('[SavedFiltersFeature] Manage dialog saved', { count: this.#savedFilters.length });
    } catch (e) {
      this.#logger.error('[SavedFiltersFeature] Manage save failed', e);
    }
  }
}
