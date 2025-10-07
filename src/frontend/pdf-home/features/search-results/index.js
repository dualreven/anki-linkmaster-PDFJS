/**
 * SearchResults Feature - 搜索结果展示功能
 * 显示和管理PDF搜索结果列表
 */

import { ResultsRenderer } from './components/results-renderer.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, PDF_MANAGEMENT_EVENTS } from '../../../common/event/event-constants.js';
import { warning as toastWarning } from '../../../common/utils/thirdparty-toast.js';
import './styles/search-results.css';

export class SearchResultsFeature {
  name = 'search-results';
  version = '1.0.0';
  dependencies = [];
  // 测试可注入：桥接工厂（生产为 null => new QWebChannelBridge）
  static bridgeFactory = null;
  static setBridgeFactory(factory) { SearchResultsFeature.bridgeFactory = factory; }

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 渲染器
  #resultsRenderer = null;
  #resultsContainer = null;
  #headerElement = null;
  #qwcBridge = null;

  // 当前结果
  #currentResults = [];
  #pendingFocusIds = null;

  // 布局控制
  #layoutButtons = [];
  #layoutPreferenceKey = 'pdf-home:search-results:layout';
  #currentLayout = 'single';

  // 内部请求超时时间
  #requestTimeoutMs = 3000;
  // 是否允许当缺少 file_path 时通过 WS 向后端补全（默认关闭，遵循隔离优先）
  #allowWsDetailFallback = false;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SearchResultsFeature] Installing...');

    try {
      // 1. 创建结果容器
      this.#createResultsContainer();

      // 2. 初始化渲染器
      this.#resultsRenderer = new ResultsRenderer(this.#logger, this.#scopedEventBus);

      // 2.1 初始化 QWebChannel 桥接（供“阅读”按钮调用 PyQt 打开窗口）
      try {
        let factory = SearchResultsFeature.bridgeFactory;
        if (!factory) {
          // 动态导入，避免测试环境因 import.meta 等语法报错
          const mod = await import('../../qwebchannel/qwebchannel-bridge.js');
          const Bridge = mod?.QWebChannelBridge || mod?.default?.QWebChannelBridge || mod?.default;
          factory = () => new Bridge();
        }
        this.#qwcBridge = factory();
        await this.#qwcBridge.initialize();
        this.#logger.info('[SearchResultsFeature] QWebChannelBridge 已就绪');
      } catch (e) {
        this.#logger.warn('[SearchResultsFeature] QWebChannelBridge 初始化失败，阅读功能不可用', e);
      }

      // 3. 监听筛选结果更新事件（来自filter插件）
      this.#subscribeToFilterEvents();

      // 4. 监听条目事件（转发到全局）
      this.#setupEventBridge();

      // 5. 渲染初始空状态
      this.#resultsRenderer.render(this.#resultsContainer, []);

      this.#logger.info('[SearchResultsFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SearchResultsFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[SearchResultsFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁渲染器
    if (this.#resultsRenderer) {
      this.#resultsRenderer.destroy();
      this.#resultsRenderer = null;
    }

    // 移除DOM
    if (this.#resultsContainer) {
      this.#resultsContainer.remove();
      this.#resultsContainer = null;
    }

    this.#logger.info('[SearchResultsFeature] Uninstalled');
  }

  /**
   * 创建结果容器
   * @private
   */
  #createResultsContainer() {
    // 查找现有容器
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) {
      throw new Error('Main content container not found');
    }

    // 获取或创建header
    this.#headerElement = mainContent.querySelector('.search-results-header');
    if (!this.#headerElement) {
      throw new Error('Search results header not found in index.html');
    }

    // 在header中添加批量操作按钮
    this.#createBatchActionButtons();

    // 获取或创建结果容器
    this.#resultsContainer = mainContent.querySelector('#pdf-table-container');
    if (!this.#resultsContainer) {
      // 创建新容器（如果index.html中没有）
      this.#resultsContainer = document.createElement('div');
      this.#resultsContainer.id = 'pdf-table-container';
      this.#headerElement.insertAdjacentElement('afterend', this.#resultsContainer);
    }

    this.#resultsContainer.classList.add('search-results-container');

    this.#logger.debug('[SearchResultsFeature] Results container created');

    this.#restoreLayoutPreference();
  }

  /**
   * 创建批量操作按钮
   * @private
   */
  #createBatchActionButtons() {
    const existingActions = this.#headerElement.querySelector('.batch-actions');
    if (existingActions) {
      const existingToggle = existingActions.querySelector('.layout-toggle');
      if (existingToggle) {
        this.#bindLayoutButtons(existingToggle);
        this.#updateLayoutButtonsState();
      }
      return;
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'batch-actions';
    actionsDiv.innerHTML = `
      <button class="batch-action-btn batch-btn-review" title="批量复习选中项">
        🔁 复习
      </button>
      <button class="batch-action-btn batch-btn-read" title="批量阅读选中项">
        📖 阅读
      </button>
      <button class="batch-action-btn batch-btn-edit" title="批量编辑选中项">
        ✏️ 编辑
      </button>
      <button class="batch-action-btn batch-btn-delete" title="批量删除选中项">
        🗑️ 删除
      </button>
    `;

    const layoutToggle = document.createElement('div');
    layoutToggle.className = 'layout-toggle';
    layoutToggle.innerHTML = `
      <span class="layout-toggle__label">布局</span>
      <button type="button" class="layout-toggle__btn" data-layout="single" title="单栏">1栏</button>
      <button type="button" class="layout-toggle__btn" data-layout="double" title="双栏">2栏</button>
      <button type="button" class="layout-toggle__btn" data-layout="triple" title="三栏">3栏</button>
    `;
    actionsDiv.appendChild(layoutToggle);

    this.#headerElement.appendChild(actionsDiv);
    // 绑定“阅读”按钮
    const readBtn = actionsDiv.querySelector('.batch-btn-read');
    if (readBtn) {
      readBtn.addEventListener('click', async () => {
        try {
          const selectedIds = Array.from(document.querySelectorAll('.search-result-checkbox:checked'))
            .map(el => el.getAttribute('data-id'))
            .filter(Boolean);
          if (!selectedIds || selectedIds.length === 0) {
            this.#logger.info('[SearchResultsFeature] 未选择任何条目，阅读操作中止');
            return;
          }
          if (!this.#qwcBridge) {
            this.#logger.warn('[SearchResultsFeature] QWebChannel 未初始化，无法打开阅读窗口');
            return;
          }
          try { await this.#qwcBridge.initialize?.(); } catch {}
          if (this.#qwcBridge.isReady && !this.#qwcBridge.isReady()) {
            this.#logger.warn('[SearchResultsFeature] QWebChannel 未就绪，无法打开阅读窗口');
            return;
          }
          const idSet = new Set(selectedIds.map(String));
          const items = (this.#currentResults || [])
            .filter(r => idSet.has(String(r.id)))
            .map(r => ({ id: String(r.id), filename: r.filename || undefined, file_path: r.path || r.file_path || undefined, title: r.title || undefined }));
          this.#logger.info('[SearchResultsFeature] 发起阅读（批量）', { count: selectedIds.length, withMeta: items.length });
          const payload = { pdfIds: selectedIds.map(String), items };
          if (typeof this.#qwcBridge.openPdfViewersWithMeta === 'function') {
            await this.#qwcBridge.openPdfViewersWithMeta(payload);
          } else {
            await this.#qwcBridge.openPdfViewers(payload);
          }
        } catch (e) {
          this.#logger.error('[SearchResultsFeature] 执行阅读失败', e);
        }
      });
    }
    // 绑定“编辑”按钮（选中多条时，仅取第一条发起编辑）
    const editBtn = actionsDiv.querySelector('.batch-btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        try {
          const selectedIds = Array.from(document.querySelectorAll('.search-result-checkbox:checked'))
            .map(el => el.getAttribute('data-id'))
            .filter(Boolean);
          if (!selectedIds || selectedIds.length === 0) {
            this.#logger.info('[SearchResultsFeature] 未选择任何条目，编辑操作中止');
            toastWarning('未选择任何条目');
            return;
          }

          // 仅编辑第一条（与 pdf-edit 现有逻辑一致）
          const firstId = String(selectedIds[0]);
          const record = (this.#currentResults || []).find(r => String(r?.id) === firstId);
          if (!record) {
            this.#logger.warn('[SearchResultsFeature] 选中记录未在当前结果中找到', { id: firstId });
            toastWarning('无法获取选中的PDF记录');
            return;
          }

          this.#logger.info('[SearchResultsFeature] 触发编辑请求', { id: record.id, filename: record.filename });
          this.#globalEventBus.emit(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, record);
        } catch (e) {
          this.#logger.error('[SearchResultsFeature] 执行编辑失败', e);
        }
      });
    }

    this.#bindLayoutButtons(layoutToggle);
    this.#updateLayoutButtonsState();

    this.#logger.debug('[SearchResultsFeature] Batch action buttons created');
  }

  /**
   * 绑定布局切换按钮
   * @param {HTMLElement} container
   * @private
   */
  #bindLayoutButtons(container) {
    this.#layoutButtons = Array.from(container.querySelectorAll('[data-layout]')) || [];
    this.#layoutButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const layout = button.getAttribute('data-layout');
        this.#applyLayout(layout);
      });
    });
  }

  /**
   * 恢复布局偏好
   * @private
   */
  #restoreLayoutPreference() {
    let stored = null;
    try {
      stored = window.localStorage.getItem(this.#layoutPreferenceKey);
    } catch (error) {
      this.#logger?.warn('[SearchResultsFeature] Failed to read layout preference', error);
    }

    this.#applyLayout(stored || this.#currentLayout, { persist: false });
  }

  /**
   * 应用布局并可选持久化
   * @param {string} layout
   * @param {{ persist?: boolean }} [options]
   * @private
   */
  #applyLayout(layout, { persist = true } = {}) {
    const allowed = ['single', 'double', 'triple'];
    const targetLayout = allowed.includes(layout) ? layout : 'single';
    this.#currentLayout = targetLayout;

    if (this.#resultsContainer) {
      this.#resultsContainer.classList.remove('layout-single', 'layout-double', 'layout-triple');
      this.#resultsContainer.classList.add('layout-' + targetLayout);
    }

    this.#updateLayoutButtonsState();

    if (persist) {
      try {
        window.localStorage.setItem(this.#layoutPreferenceKey, targetLayout);
      } catch (error) {
        this.#logger?.warn('[SearchResultsFeature] Failed to persist layout preference', error);
      }
    }
  }

  /**
   * 更新布局按钮状态
   * @private
   */
  #updateLayoutButtonsState() {
    if (!this.#layoutButtons || this.#layoutButtons.length === 0) {
      return;
    }

    this.#layoutButtons.forEach((button) => {
      const layout = button.getAttribute('data-layout');
      if (!layout) {
        return;
      }
      if (layout === this.#currentLayout) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }

  /**
   * 订阅筛选事件
   * @private
   */
  #subscribeToFilterEvents() {
    // 监听搜索结果更新（来自search插件）
    const unsubSearchResults = this.#globalEventBus.on('search:results:updated', (data) => {
      this.#logger.info('[SearchResultsFeature] Search results received', {
        count: data.count,
        searchText: data.searchText
      });

      this.#handleResultsUpdate(data.records, data.count, data.searchText);
    });
    this.#unsubscribers.push(unsubSearchResults);

    // 监听筛选结果更新（来自filter插件）
    const unsubResults = this.#globalEventBus.on('filter:results:updated', (data) => {
      this.#logger.info('[SearchResultsFeature] Filter results received', {
        count: data.count,
        searchText: data.searchText
      });

      this.#handleResultsUpdate(data.results, data.count, data.searchText);
    });
    this.#unsubscribers.push(unsubResults);

    this.#logger.info('[SearchResultsFeature] Subscribed to search and filter events');

    // 监听外部请求聚焦事件（如“最近添加”点击后要求高亮/聚焦这些ID）
    const unsubFocusReq = this.#globalEventBus.on('search-results:focus:requested', (data) => {
      try {
        const ids = (data && Array.isArray(data.ids)) ? data.ids.map(x => String(x)) : [];
        this.#logger.info('[SearchResultsFeature] Focus request received', { count: ids.length });
        this.#pendingFocusIds = ids.length ? ids : null;
        // 若已有结果，立即尝试应用
        this.#applyPendingFocus();
      } catch (e) {
        this.#pendingFocusIds = null;
      }
    });
    this.#unsubscribers.push(unsubFocusReq);
  }

  /**
   * 设置事件桥接（内部事件 -> 全局事件）
   * @private
   */
  #setupEventBridge() {
    // 条目选中事件 -> 转发到全局
    const unsubSelected = this.#scopedEventBus.on('results:item:selected', (data) => {
      this.#logger.debug('[SearchResultsFeature] Item selected', data);
      this.#globalEventBus.emit('search-results:item:selected', data);
    });
    this.#unsubscribers.push(unsubSelected);

    // 条目打开事件 -> 转发到全局
    const unsubOpen = this.#scopedEventBus.on('results:item:open', async (data) => {
      this.#logger.info('[SearchResultsFeature] Item open requested', data);
      // 1) 转发为全局事件，便于其他模块感知
      this.#globalEventBus.emit('search-results:item:open', data);

      // 2) 直接触发打开 pdf-viewer（通过 QWebChannelBridge -> PyQtBridge）
      try {
        const pdfId = data?.result?.id || data?.id || data?.pdfId;
        const filename = data?.result?.filename || data?.filename || null;
        const title = data?.result?.title || data?.title || null;
        let filePath = data?.result?.path || data?.result?.file_path || data?.file_path || null;
        if (!pdfId) {
          this.#logger.warn('[SearchResultsFeature] Skip open: missing pdfId', { data });
          return;
        }

        if (!this.#qwcBridge) {
          this.#logger.warn('[SearchResultsFeature] QWebChannelBridge not available, cannot open viewer');
          return;
        }

        // ensure initialized (idempotent)
        try { await this.#qwcBridge.initialize?.(); } catch {}

        if (this.#qwcBridge.isReady && !this.#qwcBridge.isReady()) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (this.#qwcBridge.isReady && !this.#qwcBridge.isReady()) {
          this.#logger.warn('[SearchResultsFeature] QWebChannel not ready, cannot open viewer');
          return;
        }

        // 若缺少 file_path，尝试从后端查询一次详情（遵守隔离原则：通过 WS 访问）
        if (!filePath && this.#shouldFetchDetailFallback()) {
          try {
            const detail = await this.#fetchPdfDetail(String(pdfId));
            filePath = detail?.file_path || filePath;
          } catch (e) {
            this.#logger.warn('[SearchResultsFeature] fetch detail failed, continue without file_path', e);
          }
        }

        this.#logger.info('[SearchResultsFeature] Opening pdf-viewer by id', { pdfId, hasFile: !!filePath });
        // 携带 filename / file_path 元信息，便于 PyQt 侧直接带 file 加载
        const items = [{ id: String(pdfId), filename: filename || undefined, file_path: filePath || undefined, title: title || undefined }];
        const payload = { pdfIds: [String(pdfId)], items };
        if (typeof this.#qwcBridge.openPdfViewersWithMeta === 'function') {
          await this.#qwcBridge.openPdfViewersWithMeta(payload);
        } else {
          await this.#qwcBridge.openPdfViewers(payload);
        }
      } catch (e) {
        this.#logger.error('[SearchResultsFeature] Open viewer failed', e);
      }
    });
    this.#unsubscribers.push(unsubOpen);

    this.#logger.info('[SearchResultsFeature] Event bridge setup');
  }

  /**
   * 判断是否允许通过 WS 兜底查询 file_path（默认 false，可通过 localStorage 打开）
   * 开关键: PDF_HOME_FETCH_DETAIL_IF_MISSING = 'true' | 'false'
   * @private
   */
  #shouldFetchDetailFallback() {
    try {
      const v = window.localStorage.getItem('PDF_HOME_FETCH_DETAIL_IF_MISSING');
      if (typeof v === 'string') {
        return v === 'true';
      }
    } catch (_) {}
    return this.#allowWsDetailFallback === true;
  }

  /**
   * 通过 WS 请求获取 PDF 详情（包含 file_path）
   * @param {string} pdfId
   * @returns {Promise<{ file_path?: string, filename?: string }|null>}
   * @private
   */
  async #fetchPdfDetail(pdfId) {
    const rid = `sr-open-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.#logger.info('[SearchResultsFeature] Requesting pdf detail via WS', { pdfId, rid });

    return new Promise((resolve) => {
      let settled = false;
      const off = this.#globalEventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
        try {
          if (!message || message.request_id !== rid) return;
          if (message.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST.replace(':requested', ':completed') || message.type === 'pdf-library:info:completed') {
            settled = true;
            off();
            resolve(message.data || null);
          } else if (message.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST.replace(':requested', ':failed') || message.type === 'pdf-library:info:failed') {
            settled = true;
            off();
            resolve(null);
          }
        } catch (_) {}
      });

      // 发送请求
      const payload = { type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST, request_id: rid, data: { pdf_id: pdfId } };
      this.#scopedEventBus?.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, payload);

      // 超时兜底
      setTimeout(() => {
        if (!settled) {
          try { off(); } catch {}
          resolve(null);
        }
      }, this.#requestTimeoutMs);
    });
  }

  /**
   * 处理结果更新
   * @private
   */
  #handleResultsUpdate(results, count, searchText) {
    this.#currentResults = results || [];

    this.#logger.info('[SearchResultsFeature] ===== 处理结果更新 =====', {
      count,
      searchText,
      resultsLength: this.#currentResults.length,
      hasContainer: !!this.#resultsContainer,
      firstItem: this.#currentResults[0]
    });

    // 更新header统计
    this.#updateHeaderStats(count, searchText);

    // 渲染结果
    this.#resultsRenderer.render(this.#resultsContainer, this.#currentResults);

    // 渲染完成后应用待定聚焦/高亮
    this.#applyPendingFocus();
  }

  // 私有：将待定的聚焦/高亮应用到当前结果
  #applyPendingFocus() {
    try {
      if (!this.#pendingFocusIds || !this.#resultsContainer) return;
      const ids = this.#pendingFocusIds;
      let firstEl = null;
      ids.forEach(id => {
        const el = this.#resultsContainer.querySelector(`[data-id="${id}"]`);
        if (el) {
          el.classList.add('selected');
          if (!firstEl) firstEl = el;
        }
      });
      if (firstEl) {
        // 设置聚焦与滚动视图
        try {
          // 清除其他聚焦
          this.#resultsContainer.querySelectorAll('.search-result-item.focused').forEach(it => it.classList.remove('focused'));
        } catch (_) {}
        firstEl.classList.add('focused');
        try { firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      }
      // 应用一次后清空
      this.#pendingFocusIds = null;
    } catch (_) {}
  }

  /**
   * 更新header统计信息
   * @private
   */
  #updateHeaderStats(count, searchText) {
    const countBadge = this.#headerElement.querySelector('.result-count-badge');
    if (countBadge) {
      countBadge.textContent = `共 ${count} 条`;

      // 添加搜索文本提示
      if (searchText) {
        countBadge.setAttribute('title', `搜索: "${searchText}"`);
      } else {
        countBadge.removeAttribute('title');
      }
    }
  }
}

export default SearchResultsFeature;



