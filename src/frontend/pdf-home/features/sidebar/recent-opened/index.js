/**
 * RecentOpened Feature - 最近阅读功能
 * 显示并管理最近阅读的 PDF（按 visited_at 降序）。
 */

import { RecentOpenedFeatureConfig } from './feature.config.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';
import './styles/recent-opened.css';

export class RecentOpenedFeature {
  name = RecentOpenedFeatureConfig.name;
  version = RecentOpenedFeatureConfig.version;
  dependencies = RecentOpenedFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentOpened = [];
  #displayLimit = RecentOpenedFeatureConfig.config.defaultDisplayLimit;
  #containerEl = null;
  #listEl = null;
  #limitSelectEl = null;
  #pendingReqId = null;

  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentOpenedFeature] Installing...');

    try {
      // 1) 绑定容器元素
      this.#containerEl = document.getElementById('recent-opened-section');
      this.#listEl = document.getElementById('recent-opened-list');
      if (!this.#containerEl || !this.#listEl) {
        this.#logger.warn('[RecentOpenedFeature] Container or list element not found');
      }

      // 2) 读取显示条数设置
      this.#loadDisplayLimit();
      this.#ensureLimitSelect();

      // 3) 监听 WS 响应与交互事件
      this.#setupEventListeners();

      // 4) 首次加载最近阅读
      this.#requestRecentOpened();

      this.#logger.info('[RecentOpenedFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentOpenedFeature] Installation failed', error);
      throw error;
    }
  }

  async uninstall() {
    this.#logger.info('[RecentOpenedFeature] Uninstalling...');
    this.#unsubscribers.forEach(fn => fn && fn());
    this.#unsubscribers = [];
    if (this.#listEl) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无阅读记录</li>';
    }
    if (this.#limitSelectEl && this.#limitSelectEl.parentNode) {
      this.#limitSelectEl.parentNode.removeChild(this.#limitSelectEl);
      this.#limitSelectEl = null;
    }
    this.#logger.info('[RecentOpenedFeature] Uninstalled');
  }

  // =============== 私有：事件/渲染/请求 ===============

  #setupEventListeners() {
    // 监听 WS 通用响应：仅处理本功能发起的搜索请求（按 request_id 归属）
    const unsubResp = this.#globalEventBus.on('websocket:message:response', (message) => {
      try {
        if (message?.type !== WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_COMPLETED) return;
        const rid = message?.request_id;
        if (!rid || rid !== this.#pendingReqId) return;
        const files = message?.data?.files || [];
        this.#logger.info('[RecentOpenedFeature] Search completed for recent-opened', { count: files.length });
        this.#recentOpened = Array.isArray(files) ? files : [];
        this.#renderList();
        this.#pendingReqId = null;
      } catch (e) {
        // 忽略解析错误，避免打断其它监听
      }
    }, { subscriberId: 'RecentOpenedFeature' });
    this.#unsubscribers.push(unsubResp);

    // 列表点击：触发“全量、按 visited_at 降序”的标准搜索（交由 SearchManager 发起与派发结果）
    if (this.#listEl) {
      const clickHandler = (e) => {
        const item = e.target.closest('.sidebar-item');
        if (!item) return;
        const focusId = item.getAttribute('data-id') || '';
        this.#logger.info('[RecentOpenedFeature] Item clicked → trigger global sort search with focusId', { focusId });
        this.#globalEventBus.emit('search:query:requested', {
          searchText: '',
          sort: [{ field: 'visited_at', direction: 'desc' }],
          pagination: { limit: 0, offset: 0, need_total: true },
          focusId
        });
      };
      this.#listEl.addEventListener('click', clickHandler);
      this.#unsubscribers.push(() => this.#listEl.removeEventListener('click', clickHandler));
    }

    // 显示条数变更
    if (this.#limitSelectEl) {
      const changeHandler = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!Number.isNaN(val) && val > 0) {
          this.#displayLimit = val;
          try { localStorage.setItem(`${RecentOpenedFeatureConfig.config.storageKey}:display-limit`, String(val)); } catch {}
          this.#requestRecentOpened();
        }
      };
      this.#limitSelectEl.addEventListener('change', changeHandler);
      this.#unsubscribers.push(() => this.#limitSelectEl.removeEventListener('change', changeHandler));
    }
  }

  #renderList() {
    if (!this.#listEl) return;
    const items = this.#recentOpened.slice(0, this.#displayLimit);
    if (!items.length) {
      this.#listEl.innerHTML = '<li class="sidebar-empty">暂无阅读记录</li>';
      return;
    }
    this.#listEl.innerHTML = items.map((rec) => {
      const title = this.#escapeHtml(rec?.title || rec?.filename || '(未命名)');
      return (
        `<li class="sidebar-item" data-id="${this.#escapeHtml(rec?.id || '')}">`
        + `<span class="sidebar-item-icon">📖</span>`
        + `<span class="sidebar-item-text">${title}</span>`
        + `</li>`
      );
    }).join('\n');
  }

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
    select.value = String(this.#displayLimit);
    titleEl.appendChild(select);
    this.#limitSelectEl = select;
  }

  #loadDisplayLimit() {
    try {
      const v = localStorage.getItem(`${RecentOpenedFeatureConfig.config.storageKey}:display-limit`);
      if (v) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n) && n > 0) this.#displayLimit = n;
      }
    } catch (_) { /* ignore */ }
  }

  #requestRecentOpened() {
    const reqId = `recent_opened_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.#pendingReqId = reqId;
    const payload = {
      type: WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF,
      request_id: reqId,
      data: {
        query: '',
        tokens: [],
        sort: [{ field: 'visited_at', direction: 'desc' }],
        pagination: { limit: this.#displayLimit, offset: 0, need_total: false }
      }
    };
    this.#logger.debug('[RecentOpenedFeature] Sending recent-opened request', { request_id: reqId, limit: this.#displayLimit });
    this.#globalEventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, payload);
  }

  #escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export default RecentOpenedFeature;

