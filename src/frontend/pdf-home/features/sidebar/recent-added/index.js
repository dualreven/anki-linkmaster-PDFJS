/**
 * RecentAdded Feature - 最近添加功能
 * 显示和管理最近添加的PDF文档
 */

import { RecentAddedFeatureConfig } from './feature.config.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';
import './styles/recent-added.css';

export class RecentAddedFeature {
  name = RecentAddedFeatureConfig.name;
  version = RecentAddedFeatureConfig.version;
  dependencies = RecentAddedFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentAdded = [];
  #displayLimit = RecentAddedFeatureConfig.config.defaultDisplayLimit;
  #storageKey = RecentAddedFeatureConfig.config.storageKey;
  #containerEl = null;
  #listEl = null;
  #limitSelectEl = null;
  #pendingDetailIds = new Set();
  #pendingSearchReqId = null;
  #pendingListReqId = null;
  #initialLoadTriggered = false;
  #initialFallbackTimer = null;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentAddedFeature] Installing...');

    try {
      // 1) 绑定容器元素
      this.#containerEl = document.getElementById('recent-added-section');
      this.#listEl = document.getElementById('recent-added-list');
      if (!this.#containerEl || !this.#listEl) {
        // 兜底：如果侧边栏容器尚未渲染，主动创建最近添加区块并插入到 #sidebar
        try {
          const sidebar = document.getElementById('sidebar');
          if (sidebar) {
            const section = document.createElement('div');
            section.className = 'sidebar-section';
            section.id = 'recent-added-section';
            section.innerHTML = (
              '<h3 class="sidebar-section-title">'
              + '<span>➕ 最近添加</span>'
              + '</h3>'
              + '<ul class="sidebar-list" id="recent-added-list">'
              + '  <li class="sidebar-empty">暂无添加记录</li>'
              + '</ul>'
            );
            sidebar.appendChild(section);
            this.#containerEl = section;
            this.#listEl = section.querySelector('#recent-added-list');
            this.#logger.info('[RecentAddedFeature] Sidebar section created on-the-fly');
          } else {
            this.#logger.warn('[RecentAddedFeature] #sidebar not found; cannot render section');
          }
        } catch (e) {
          this.#logger.error('[RecentAddedFeature] Failed to create fallback section', e);
        }
      }

      // 2) 监听事件（优先）
      this.#setupEventListeners();

      // 3) 若侧边栏已渲染则立即初始化UI，否则等待 'sidebar:render:completed'
      if (this.#containerEl && this.#listEl) {
        this.#initializeUIAndLoad();
      } else {
        const unsubSidebarReady = this.#globalEventBus.on('sidebar:render:completed', () => {
          try {
            // 侧边栏渲染后重新绑定容器并初始化
            this.#containerEl = document.getElementById('recent-added-section');
            this.#listEl = document.getElementById('recent-added-list');
            this.#initializeUIAndLoad();
          } catch (_) {}
          if (typeof unsubSidebarReady === 'function') unsubSidebarReady();
        }, { subscriberId: 'RecentAddedFeature' });
        this.#unsubscribers.push(unsubSidebarReady);
      }

      this.#logger.info('[RecentAddedFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentAddedFeature] Installation failed', error);
      throw error;
    }
  }

  // 私有：初始化 UI 并触发首轮加载
  #initializeUIAndLoad() {
    try {
      if (!this.#containerEl || !this.#listEl) return;
      // 加载历史数据
      this.#loadFromStorage();
      // 渲染UI（含显示条数选择）
      this.#ensureLimitSelect();
      this.#renderList();
      // 绑定标题点击：触发“最近添加”搜索（按创建时间降序，限制为当前显示条数），并请求结果聚焦
      try {
        const titleEl = this.#containerEl.querySelector('.sidebar-section-title');
        if (titleEl) {
          const onTitleClick = () => {
            this.#triggerRecentSearch();
          };
          titleEl.addEventListener('click', onTitleClick);
          this.#unsubscribers.push(() => titleEl.removeEventListener('click', onTitleClick));
        }
      } catch (_) {}
      // 绑定列表点击：同样触发“最近添加”搜索
      try {
        if (this.#listEl) {
          const onListClick = (e) => {
            const li = e.target.closest('.sidebar-item');
            if (!li) return; // 只在点击条目时触发
            const id = li.getAttribute('data-id');
            this.#triggerRecentSearch(id ? [String(id)] : null);
          };
          this.#listEl.addEventListener('click', onListClick);
          this.#unsubscribers.push(() => this.#listEl.removeEventListener('click', onListClick));
        }
      } catch (_) {}
      // 启动即从数据库加载
      this.#scheduleInitialLoad();
      this.#logger.info('[RecentAddedFeature] UI initialized and initial load scheduled');
    } catch (e) {
      this.#logger.error('[RecentAddedFeature] Failed to initialize UI', e);
    }
  }

  // 私有：触发“最近添加”搜索并请求结果聚焦/高亮（数量与侧边栏显示一致）
  #triggerRecentSearch(focusIds = null) {
    try {
      const limit = this.#displayLimit || 5;
      const sort = [{ field: 'created_at', direction: 'desc' }];
      const ids = Array.isArray(focusIds) && focusIds.length > 0
        ? focusIds.map(x => String(x)).filter(Boolean)
        : this.#recentAdded.slice(0, limit).map(x => String(x.id || '')).filter(Boolean);
      this.#scopedEventBus.emitGlobal('search:query:requested', {
        searchText: '',
        sort,
        pagination: { limit, offset: 0 }
      });
      if (ids.length > 0) {
        this.#scopedEventBus.emitGlobal('search-results:focus:requested', { ids });
      }
      this.#logger.info('[RecentAddedFeature] Trigger RECENT search', { limit, idsCount: ids.length });
    } catch (e) {
      this.#logger.warn('[RecentAddedFeature] Failed to trigger RECENT search', e);
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[RecentAddedFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 清理UI
    if (this.#listEl) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无添加记录</li>';
    }
    if (this.#limitSelectEl && this.#limitSelectEl.parentNode) {
      this.#limitSelectEl.parentNode.removeChild(this.#limitSelectEl);
      this.#limitSelectEl = null;
    }

    this.#logger.info('[RecentAddedFeature] Uninstalled');
  }

  // 私有：注册事件监听
  #setupEventListeners() {
    // 监听 WebSocket 标准响应，捕捉添加完成事件
    const unsubWsResponse = this.#globalEventBus.on('websocket:message:response', (msg) => {
      try {
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type === WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED && msg.status === 'success') {
          // 支持 data.file 或 data.files（批量）
          const f = msg?.data?.file;
          const files = Array.isArray(msg?.data?.files) ? msg.data.files : (f ? [f] : []);
          if (files.length) {
            files.forEach(file => this.#addItemFromMessage(file));
          }
          return;
        }
        // 详情回执：用于补全标题
        if ((msg.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST.replace(':requested', ':completed') || msg.type === 'pdf-library:info:completed') && msg.status === 'success') {
          const detail = msg?.data || {};
          const id = String(detail.id || detail.uuid || '').trim();
          if (!id) return;
          const idx = this.#recentAdded.findIndex(it => it.id === id);
          if (idx >= 0) {
            const it = this.#recentAdded[idx];
            const newTitle = String(detail.title || '').trim();
            if (newTitle && newTitle !== it.title) {
              it.title = newTitle;
              this.#saveToStorage();
              this.#renderList();
            }
          }
          this.#pendingDetailIds.delete(id);
          return;
        }
        // 初始搜索回执：加载最近添加数据
        if ((msg.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_COMPLETED || msg.type === 'pdf-library:search:completed') && this.#pendingSearchReqId && msg.request_id === this.#pendingSearchReqId) {
          try {
            const arr = Array.isArray(msg?.data?.records) ? msg.data.records : (Array.isArray(msg?.data?.files) ? msg.data.files : []);
            const mapped = arr.map(r => ({
              id: String(r.id || r.uuid || '').trim(),
              title: String(r.title || '').trim(),
              filename: String(r.filename || '').trim(),
              path: String(r.file_path || r.filepath || '').trim(),
              ts: (typeof r.created_at === 'number' ? r.created_at * 1000 : Date.now())
            })).filter(x => x.id || x.filename);
            this.#recentAdded = mapped.slice(0, RecentAddedFeatureConfig.config.maxItems);
            this.#saveToStorage();
            this.#renderList();
          } catch (err) {
            this.#logger.error('[RecentAddedFeature] Failed to handle initial search response', err);
          } finally {
            this.#pendingSearchReqId = null;
            if (this.#initialFallbackTimer) { clearTimeout(this.#initialFallbackTimer); this.#initialFallbackTimer = null; }
          }
          return;
        }
        // 初始列表回执（兜底）
        if ((msg.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIST_COMPLETED || msg.type === 'pdf-library:list:completed') && this.#pendingListReqId && msg.request_id === this.#pendingListReqId) {
          try {
            const files = (msg?.data?.files && Array.isArray(msg.data.files)) ? msg.data.files : [];
            const sorted = files.slice().sort((a, b) => {
              const ca = typeof a.created_at === 'number' ? a.created_at : -Infinity;
              const cb = typeof b.created_at === 'number' ? b.created_at : -Infinity;
              return cb - ca;
            });
            const mapped = sorted.map(r => ({
              id: String(r.id || r.uuid || '').trim(),
              title: String(r.title || '').trim(),
              filename: String(r.filename || '').trim(),
              path: String(r.file_path || r.filepath || '').trim(),
              ts: (typeof r.created_at === 'number' ? r.created_at * 1000 : Date.now())
            })).filter(x => x.id || x.filename);
            this.#recentAdded = mapped.slice(0, RecentAddedFeatureConfig.config.maxItems);
            this.#saveToStorage();
            this.#renderList();
          } catch (err) {
            this.#logger.error('[RecentAddedFeature] Failed to handle initial list response', err);
          } finally {
            this.#pendingListReqId = null;
          }
          return;
        }
      } catch (e) {
        this.#logger.error('[RecentAddedFeature] Handle ws response failed', e);
      }
    }, { subscriberId: 'RecentAddedFeature' });
    this.#unsubscribers.push(unsubWsResponse);

    // 列表点击打开 PDF（通过标准 open 请求）
    if (this.#listEl) {
      const clickHandler = (e) => {
        const item = e.target.closest('.sidebar-item');
        if (!item) return;
        const fileId = item.getAttribute('data-id');
        if (!fileId) return;
        try {
          this.#logger.info('[RecentAddedFeature] Item clicked, open viewer', { file_id: fileId });
          this.#scopedEventBus.emitGlobal('websocket:message:send', {
            type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
            data: { file_id: fileId }
          });
        } catch (err) {
          this.#logger.warn('[RecentAddedFeature] Failed to emit open message', err);
        }
      };
      this.#listEl.addEventListener('click', clickHandler);
      this.#unsubscribers.push(() => this.#listEl.removeEventListener('click', clickHandler));
    }

    // 显示条数变化
    if (this.#limitSelectEl) {
      const changeHandler = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!Number.isNaN(val) && val > 0) {
          this.#displayLimit = val;
          try {
            localStorage.setItem(`${this.#storageKey}:display-limit`, String(val));
          } catch (err) {
            this.#logger.warn('[RecentAddedFeature] Persist display limit failed', err);
          }
          this.#scopedEventBus.emit('limit:changed', { value: val });
          this.#renderList();
        }
      };
      this.#limitSelectEl.addEventListener('change', changeHandler);
      this.#unsubscribers.push(() => this.#limitSelectEl.removeEventListener('change', changeHandler));
    }

    this.#logger.debug('[RecentAddedFeature] Event listeners setup');
  }

  // 私有：根据 ws 文件对象添加记录
  #addItemFromMessage(file) {
    if (!file || (typeof file !== 'object')) return;
    const id = String(file.id || file.file_id || '').trim();
    const filename = String(file.filename || file.name || '').trim();
    const path = String(file.path || file.filepath || '').trim();
    if (!id && !filename) return;

    // 去重：按 id 优先，其次按 filename+path
    const idx = this.#recentAdded.findIndex(it => (id && it.id === id) || (!id && it.filename === filename && it.path === path));
    if (idx >= 0) {
      const [exist] = this.#recentAdded.splice(idx, 1);
      exist.ts = Date.now();
      this.#recentAdded.unshift(exist);
    } else {
      this.#recentAdded.unshift({ id, filename, path, ts: Date.now(), title: String(file.title || '').trim() });
    }

    // 截断
    const max = RecentAddedFeatureConfig.config.maxItems;
    if (this.#recentAdded.length > max) this.#recentAdded.length = max;

    this.#saveToStorage();
    this.#renderList();

    // 若无标题且有 id，则请求详情以补全标题
    if (id && !this.#recentAdded[0].title) {
      this.#maybeFetchDetail(id);
    }
  }

  // 私有：渲染列表
  #renderList() {
    if (!this.#listEl) return;

    const items = this.#recentAdded.slice(0, this.#displayLimit);
    if (!items.length) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无添加记录</li>';
      return;
    }

    this.#listEl.innerHTML = items.map(item => {
      const titleText = this.#displayTitle(item);
      const safeText = this.#escapeHtml(titleText);
      const timeStr = this.#formatTime(item.ts);
      return (
        `<li class="sidebar-item" data-id="${item.id || ''}">`
        + `<span class=\"sidebar-item-icon\">📄</span>`
        + `<span class=\"sidebar-item-text\">${safeText}</span>`
        + `<span class=\"sidebar-item-time\" title=\"${timeStr}\">${timeStr}</span>`
        + `</li>`
      );
    }).join('\n');
  }

  // 私有：根据记录返回用于展示的标题
  #displayTitle(item) {
    const t = String(item?.title || '').trim();
    if (t) return t;
    const fn = String(item?.filename || '').trim();
    // 没有书名时直接展示文件名
    return fn;
  }

  // 私有：确保显示条数选择器
  #ensureLimitSelect() {
    if (!this.#containerEl) return;
    const titleEl = this.#containerEl.querySelector('.sidebar-section-title');
    if (!titleEl) return;
    if (this.#limitSelectEl && this.#limitSelectEl.isConnected) return;

    const select = document.createElement('select');
    select.className = 'sidebar-limit-select';
    [5, 10, 20, 50].forEach(n => {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `显示 ${n}`;
      select.appendChild(opt);
    });

    // 恢复保存的显示条数
    const saved = parseInt(localStorage.getItem(`${this.#storageKey}:display-limit`) || '', 10);
    if (!Number.isNaN(saved) && saved > 0) this.#displayLimit = saved;
    select.value = String(this.#displayLimit);
    titleEl.appendChild(select);
    this.#limitSelectEl = select;
  }

  // 私有：本地存储加载
  #loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.#storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const max = RecentAddedFeatureConfig.config.maxItems;
        this.#recentAdded = arr.filter(x => x && (typeof x.filename === 'string' || typeof x.id === 'string')).slice(0, max);
      } else {
        this.#recentAdded = [];
      }
      const savedLimit = parseInt(localStorage.getItem(`${this.#storageKey}:display-limit`) || '', 10);
      if (!Number.isNaN(savedLimit) && savedLimit > 0) this.#displayLimit = savedLimit;
      this.#logger.debug('[RecentAddedFeature] Loaded from storage', { count: this.#recentAdded.length, displayLimit: this.#displayLimit });
    } catch (e) {
      this.#logger.error('[RecentAddedFeature] Failed to load from storage', e);
      this.#recentAdded = [];
    }
  }

  // 私有：保存到本地存储
  #saveToStorage() {
    try {
      const payload = JSON.stringify(this.#recentAdded.slice(0, RecentAddedFeatureConfig.config.maxItems));
      localStorage.setItem(this.#storageKey, payload);
    } catch (e) {
      this.#logger.error('[RecentAddedFeature] Failed to save to storage', e);
    }
  }

  // 私有：请求详情以补齐标题
  #maybeFetchDetail(id) {
    try {
      if (this.#pendingDetailIds.has(id)) return;
      this.#pendingDetailIds.add(id);
      const rid = `info_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.#scopedEventBus.emitGlobal('websocket:message:send', {
        type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
        request_id: rid,
        data: { pdf_id: id }
      });
    } catch (e) {
      this.#logger.warn('[RecentAddedFeature] Request detail failed', e);
    }
  }

  // 私有：启动即从数据库加载最近添加（创建时间降序）
  #requestInitialFromDB() {
    try {
      const reqId = `recent_added_init_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.#pendingSearchReqId = reqId;
      const limit = RecentAddedFeatureConfig.config.maxItems || 50;
      this.#scopedEventBus.emitGlobal('websocket:message:send', {
        type: WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF,
        request_id: reqId,
        data: {
          query: '',
          sort: [{ field: 'created_at', direction: 'desc' }],
          pagination: { limit, offset: 0, need_total: false }
        }
      });
      this.#logger.info('[RecentAddedFeature] Initial load requested (created_at desc)');
    } catch (e) {
      this.#logger.warn('[RecentAddedFeature] Initial load request failed', e);
    }
  }

  // 私有：安排初始加载（WebSocket连接状态与兜底回退）
  #scheduleInitialLoad() {
    if (this.#initialLoadTriggered) return;
    this.#initialLoadTriggered = true;
    // 立即请求（WSClient 未连接时会入队，连接后自动发送）
    this.#requestInitialFromDB();
    // 监听连接建立，补一遍（保证请求发出）
    const unsub = this.#globalEventBus.on('websocket:connection:established', () => {
      try { this.#requestInitialFromDB(); } catch (_) {}
      if (typeof unsub === 'function') unsub();
    }, { subscriberId: 'RecentAddedFeature' });
    this.#unsubscribers.push(unsub);
    // 兜底：超时后改用 list 请求
    this.#initialFallbackTimer = setTimeout(() => {
      try {
        if (this.#pendingSearchReqId) {
          const rid = `recent_added_list_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          this.#pendingListReqId = rid;
          const limit = RecentAddedFeatureConfig.config.maxItems || 50;
          this.#scopedEventBus.emitGlobal('websocket:message:send', {
            type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST,
            request_id: rid,
            data: { pagination: { limit, offset: 0 } }
          });
          this.#logger.warn('[RecentAddedFeature] Search response timeout, fallback to list');
        }
      } catch (e) {
        this.#logger.warn('[RecentAddedFeature] Initial fallback failed', e);
      } finally {
        this.#initialFallbackTimer = null;
      }
    }, 2500);
  }

  // 私有：时间格式化（简洁）
  #formatTime(ts) {
    try {
      const d = new Date(ts || Date.now());
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch (_) {
      return '';
    }
  }

  // 私有：HTML转义
  #escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export default RecentAddedFeature;
