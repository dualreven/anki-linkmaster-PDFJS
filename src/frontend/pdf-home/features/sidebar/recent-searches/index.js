/**
 * RecentSearches Feature - 最近搜索功能
 * 显示和管理最近的搜索关键词
 */

import { RecentSearchesFeatureConfig } from './feature.config.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';
import './styles/recent-searches.css';

export class RecentSearchesFeature {
  name = RecentSearchesFeatureConfig.name;
  version = RecentSearchesFeatureConfig.version;
  dependencies = RecentSearchesFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentSearches = [];
  #displayLimit = RecentSearchesFeatureConfig.config.defaultDisplayLimit;
  #storageKey = RecentSearchesFeatureConfig.config.storageKey;
  #containerEl = null;
  #listEl = null;
  #limitSelectEl = null;
  #saveTimer = null;
  #pendingGetConfigReqId = null;
  #saveDebounceMs = 300; // 后端持久化防抖，避免频繁写盘

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentSearchesFeature] Installing...');

    try {
      // 1. 绑定容器元素
      this.#containerEl = document.getElementById('recent-searches-section');
      this.#listEl = document.getElementById('recent-searches-list');

      if (!this.#containerEl || !this.#listEl) {
        this.#logger.warn('[RecentSearchesFeature] Container or list element not found');
      }

      // 2. 加载历史数据
      this.#loadFromStorage();
      // 同步后端持久化配置（覆盖本地）
      this.#requestLoadFromBackend();

      // 3. 渲染UI（含显示条数选择）
      this.#ensureLimitSelect();
      this.#renderList();

      // 4. 监听事件
      this.#setupEventListeners();

      this.#logger.info('[RecentSearchesFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentSearchesFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[RecentSearchesFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 清理UI
    if (this.#listEl) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无搜索记录</li>';
    }
    if (this.#limitSelectEl && this.#limitSelectEl.parentNode) {
      this.#limitSelectEl.parentNode.removeChild(this.#limitSelectEl);
      this.#limitSelectEl = null;
    }

    this.#logger.info('[RecentSearchesFeature] Uninstalled');
  }

  // 私有：设置事件监听
  #setupEventListeners() {
    // 监听全局搜索请求事件，记录最近搜索
    const unsubSearchRequested = this.#globalEventBus.on('search:query:requested', (data) => {
      const text = (data && typeof data.searchText === 'string') ? data.searchText.trim() : '';
      this.#logger.info('[RecentSearchesFeature] Capture search request', { searchText: text || '(empty)' });
      this.#addSearch(text);
    }, { subscriberId: 'RecentSearchesFeature' });
    this.#unsubscribers.push(unsubSearchRequested);

    // 列表项点击 - 事件代理
    if (this.#listEl) {
      const clickHandler = (e) => {
        const item = e.target.closest('.sidebar-item');
        if (!item) return;
        const text = item.getAttribute('data-text') || '';
        this.#logger.info('[RecentSearchesFeature] Item clicked, emit search', { searchText: text || '(empty)' });
        this.#scopedEventBus.emit('search:item:clicked', { searchText: text });
        this.#globalEventBus.emit('search:query:requested', { searchText: text });
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
            this.#logger.warn('[RecentSearchesFeature] Persist display limit failed', err);
          }
          this.#scopedEventBus.emit('limit:value:changed', { value: val });
          this.#renderList();
        }
      };
      this.#limitSelectEl.addEventListener('change', changeHandler);
      this.#unsubscribers.push(() => this.#limitSelectEl.removeEventListener('change', changeHandler));
    }

    // 监听后端响应（用于加载/保存配置回执）
    const unsubWsResponse = this.#scopedEventBus.onGlobal('websocket:message:response', (data) => {
      try {
        if (!data || data.status !== 'success') return;

        if (this.#pendingGetConfigReqId && data.request_id === this.#pendingGetConfigReqId) {
          this.#pendingGetConfigReqId = null;
          const cfg = data?.data?.config;
          if (cfg && Array.isArray(cfg.recent_search)) {
            this.#recentSearches = cfg.recent_search
              .filter(x => x && typeof x.text === 'string')
              .slice(0, RecentSearchesFeatureConfig.config.maxItems);
            this.#saveToStorage();
            this.#renderList();
            this.#logger.info('[RecentSearchesFeature] Synced from backend config');
          }
        }
      } catch (e) {
        this.#logger.error('[RecentSearchesFeature] Handle backend response failed', e);
      }
    }, { subscriberId: 'RecentSearchesFeature' });
    this.#unsubscribers.push(unsubWsResponse);

    this.#logger.debug('[RecentSearchesFeature] Event listeners setup');
  }

  // 私有：从 LocalStorage 加载
  #loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.#storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        this.#recentSearches = arr.filter(x => x && typeof x.text === 'string').slice(0, RecentSearchesFeatureConfig.config.maxItems);
      } else {
        this.#recentSearches = [];
      }

      const savedLimit = parseInt(localStorage.getItem(`${this.#storageKey}:display-limit`) || '', 10);
      if (!Number.isNaN(savedLimit) && savedLimit > 0) {
        this.#displayLimit = savedLimit;
      }

      this.#logger.debug('[RecentSearchesFeature] Loaded from storage', { count: this.#recentSearches.length, displayLimit: this.#displayLimit });
    } catch (error) {
      this.#logger.error('[RecentSearchesFeature] Failed to load from storage', error);
      this.#recentSearches = [];
    }
  }

  // 私有：向后端请求加载配置（获取 recent_search 持久化数据）
  #requestLoadFromBackend() {
    try {
      const reqId = `cfg_get_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.#pendingGetConfigReqId = reqId;
      this.#scopedEventBus.emitGlobal('websocket:message:send', {
        type: WEBSOCKET_MESSAGE_TYPES.GET_CONFIG,
        request_id: reqId
      });
      this.#logger.debug('[RecentSearchesFeature] Requesting backend config', { request_id: reqId });
    } catch (e) {
      this.#logger.warn('[RecentSearchesFeature] Request backend config failed', e);
    }
  }

  // 私有：保存到 LocalStorage
  #saveToStorage() {
    try {
      const payload = JSON.stringify(this.#recentSearches.slice(0, RecentSearchesFeatureConfig.config.maxItems));
      localStorage.setItem(this.#storageKey, payload);
    } catch (error) {
      this.#logger.error('[RecentSearchesFeature] Failed to save to storage', error);
    }
  }

  // 私有：添加搜索项
  #addSearch(text) {
    // 允许空搜索（显示全部）也进入历史，但不重复
    const normalized = text || '';

    // 去重：若存在则上移到顶部
    const existIndex = this.#recentSearches.findIndex(it => it.text === normalized);
    if (existIndex >= 0) {
      const [exist] = this.#recentSearches.splice(existIndex, 1);
      exist.ts = Date.now();
      this.#recentSearches.unshift(exist);
    } else {
      this.#recentSearches.unshift({ text: normalized, ts: Date.now() });
    }

    // 截断到最大数量
    if (this.#recentSearches.length > RecentSearchesFeatureConfig.config.maxItems) {
      this.#recentSearches.length = RecentSearchesFeatureConfig.config.maxItems;
    }

    this.#saveToStorage();
    this.#renderList();

    // 后端持久化（防抖）
    this.#scheduleSaveToBackend();
  }

  // 私有：调度向后端保存配置（持久化 recent_search）
  #scheduleSaveToBackend() {
    try {
      if (this.#saveTimer) {
        clearTimeout(this.#saveTimer);
      }
      this.#saveTimer = setTimeout(() => {
        this.#saveTimer = null;
        const reqId = `cfg_up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const payload = {
          type: WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG,
          request_id: reqId,
          data: {
            recent_search: this.#recentSearches.slice(0, RecentSearchesFeatureConfig.config.maxItems)
          }
        };
        this.#logger.debug('[RecentSearchesFeature] Saving backend config', { request_id: reqId, count: this.#recentSearches.length });
        this.#scopedEventBus.emitGlobal('websocket:message:send', payload);
      }, this.#saveDebounceMs);
    } catch (e) {
      this.#logger.warn('[RecentSearchesFeature] Schedule save backend failed', e);
    }
  }

  // 私有：渲染最近搜索列表
  #renderList() {
    if (!this.#listEl) return;

    const items = this.#recentSearches.slice(0, this.#displayLimit);
    if (!items.length) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无搜索记录</li>';
      return;
    }

    this.#listEl.innerHTML = items.map(item => {
      const safeText = this.#escapeHtml(item.text);
      const timeStr = this.#formatTime(item.ts);
      return (
        `<li class="sidebar-item" data-text="${safeText}">`
        + `<span class="sidebar-item-icon">🔎</span>`
        + `<span class="sidebar-item-text">${safeText || '(全部)'}</span>`
        + `<span class="sidebar-item-time" title="${timeStr}">${timeStr}</span>`
        + `</li>`
      );
    }).join('\n');
  }

  // 私有：确保显示条数选择器存在
  #ensureLimitSelect() {
    if (!this.#containerEl) return;
    const titleEl = this.#containerEl.querySelector('.sidebar-section-title');
    if (!titleEl) return;

    // 若已存在则跳过
    if (this.#limitSelectEl && this.#limitSelectEl.isConnected) return;

    const select = document.createElement('select');
    select.className = 'sidebar-limit-select';
    [5, 10, 20, 50].forEach(n => {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `显示 ${n}`;
      select.appendChild(opt);
    });
    select.value = String(this.#displayLimit);
    titleEl.appendChild(select);
    this.#limitSelectEl = select;
  }

  // 私有：HTML转义
  #escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 私有：格式化时间
  #formatTime(ts) {
    try {
      const d = new Date(ts || Date.now());
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch (e) {
      return '';
    }
  }
}

export default RecentSearchesFeature;
