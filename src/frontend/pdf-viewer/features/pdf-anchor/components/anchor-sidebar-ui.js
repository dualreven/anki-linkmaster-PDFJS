/**
 * 锚点侧边栏 UI
 * @file 渲染锚点工具栏与表格列表
 * @module features/pdf-anchor/components/anchor-sidebar-ui
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
import { success as toastSuccess, error as toastError } from '../../../../common/utils/thirdparty-toast.js';

export class AnchorSidebarUI {
  #eventBus;
  #logger;
  #sidebarContent; // 整个侧栏内容容器（工具栏 + 表格）
  #toolbar;
  #table;
  #emptyDiv;
  #loadingDiv;
  #errorDiv;
  #loadTimeoutTimer;
  #lastRequestPayload;
  #anchors = [];
  #selectedId = null;
  #unsubs = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('AnchorSidebarUI');
  }

  initialize() {
    // 内容容器
    this.#sidebarContent = document.createElement('div');
    this.#sidebarContent.style.cssText = 'height:100%;display:flex;flex-direction:column;box-sizing:border-box;';

    // 工具栏
    this.#toolbar = this.#createToolbar();
    this.#sidebarContent.appendChild(this.#toolbar);

    // 表格
    this.#table = this.#createTable();
    this.#sidebarContent.appendChild(this.#table);

    // 初始渲染空态
    try { this.#renderAnchors([]); } catch (_) {}

    // 事件订阅：加载请求（用于显示“加载中/超时”并记录最近一次请求参数）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      (payload) => {
        this.#lastRequestPayload = payload || {};
        this.#showLoading();
        this.#clearError();
        this.#startLoadTimeout();
      },
      { subscriberId: 'AnchorSidebarUI' }
    ));

    // 事件订阅：数据加载
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        this.#logger.info('Anchor data loaded', { count: anchors?.length || 0 });
        this.#hideLoading();
        this.#clearError();
        this.#clearLoadTimeout();
        this.#renderAnchors(Array.isArray(anchors) ? anchors : []);
      },
      { subscriberId: 'AnchorSidebarUI' }
    ));

    // 事件订阅：数据加载失败（来自 WS 适配器桥接 anchor:get/list:failed）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED,
      ({ error, type }) => {
        this.#hideLoading();
        this.#clearLoadTimeout();
        const msg = (error && (error.message || error.err || error.detail)) ? (error.message || error.err || error.detail) : '无法加载锚点数据';
        this.#showError(`[${type || 'anchor:load:failed'}] ${msg}`);
      },
      { subscriberId: 'AnchorSidebarUI' }
    ));

    // 监听锚点更新与激活状态变更以刷新表格
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      ({ anchorId, page_at, position }) => {
        const idx = this.#anchors.findIndex(a => a.uuid === anchorId);
        if (idx >= 0) {
          this.#anchors[idx].page_at = page_at;
          if (typeof position === 'number') { this.#anchors[idx].position = position; }
          this.#renderAnchors(this.#anchors);
        }
      },
      { subscriberId: 'AnchorSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      ({ anchorId, active }) => {
        const idx = this.#anchors.findIndex(a => a.uuid === anchorId);
        if (idx >= 0) {
          this.#anchors[idx].is_active = !!active;
          this.#renderAnchors(this.#anchors);
        }
      },
      { subscriberId: 'AnchorSidebarUI' }
    ));

    // 打开侧栏后基于 URL 的 pdf-id 主动请求一次列表，防止第一次列表在侧栏订阅前已发出
    try {
      const params = new URLSearchParams(window.location.search);
      const pdfId = params.get('pdf-id');
      if (pdfId) {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
          { pdf_uuid: pdfId },
          { actorId: 'AnchorSidebarUI' }
        );
      }
    } catch (e) { this.#logger.warn('request list on init failed', e); }

    this.#logger.info('AnchorSidebarUI initialized');
  }

  getContentElement() { return this.#sidebarContent; }

  destroy() {
    if (Array.isArray(this.#unsubs)) {
      try { this.#unsubs.forEach(off => { try { off && off(); } catch(_) {} }); } catch (_) {}
    }
    this.#unsubs = [];
    this.#sidebarContent = null;
    this.#toolbar = null;
    this.#table = null;
    if (this.#loadTimeoutTimer) { try { clearTimeout(this.#loadTimeoutTimer); } catch(_){} this.#loadTimeoutTimer = null; }
    this.#anchors = [];
    this.#selectedId = null;
    this.#logger.info('AnchorSidebarUI destroyed');
  }

  #createToolbar() {
    const bar = document.createElement('div');
    bar.className = 'anchor-toolbar';
    bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #ddd;background:#f5f5f5;';

    const mkBtn = (id, label, tooltip) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.action = id;
      btn.textContent = label;
      btn.title = tooltip || label;
      btn.style.cssText = 'padding:4px 10px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;';
      return btn;
    };

    const addBtn = mkBtn('add', '添加', '添加锚点');
    addBtn.addEventListener('click', () => {
      this.#logger.info('Anchor add clicked');
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { source: 'toolbar' }, { actorId: 'AnchorToolbar' });
    });

    const delBtn = mkBtn('delete', '删除', '删除选中锚点');
    delBtn.addEventListener('click', () => {
      if (!this.#selectedId) return;
      this.#logger.info('Anchor delete clicked', { id: this.#selectedId });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DELETE, { anchorId: this.#selectedId }, { actorId: 'AnchorToolbar' });
    });

    const editBtn = mkBtn('edit', '修改', '修改选中锚点');
    editBtn.addEventListener('click', () => {
      if (!this.#selectedId) return;
      this.#logger.info('Anchor update clicked', { id: this.#selectedId });
      const current = (this.#anchors.find(a => a.uuid === this.#selectedId)?.name) || '';
      let name = '';
      try { name = prompt('请输入新的锚点名称：', current) || ''; } catch(_) { name = current; }
      if (!name.trim()) return;
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATE, { anchorId: this.#selectedId, update: { name } }, { actorId: 'AnchorToolbar' });
    });

    // 复制下拉按钮
    const copyTextRobust = async (text, labelForToast) => {
      // 关键点：先在用户手势的同步栈内尝试 execCommand，避免因异步等待丢失“用户激活”导致失败
      try {
        const ta = document.createElement('textarea');
        ta.value = String(text);
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        try { ta.focus(); } catch(_) {}
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          try { toastSuccess(`已复制${labelForToast ? `(${labelForToast})` : ''}`); } catch(_) {}
          return true;
        }
      } catch (_) {}

      // 次选：Clipboard API（某些浏览器/上下文可用）
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(String(text));
          try { toastSuccess(`已复制${labelForToast ? `(${labelForToast})` : ''}`); } catch(_) {}
          return true;
        }
      } catch (_) {}

      // 最后：QWebChannel（仅 PyQt 环境可用）
      try {
        const ok = await new Promise((resolve) => {
          try {
            if (typeof qt === 'undefined' || !qt.webChannelTransport) { resolve(false); return; }
            if (typeof QWebChannel === 'undefined') { resolve(false); return; }
            new QWebChannel(qt.webChannelTransport, (channel) => {
              try {
                const bridge = channel?.objects?.pdfViewerBridge;
                if (bridge && typeof bridge.setClipboardText === 'function') {
                  Promise.resolve(bridge.setClipboardText(String(text)))
                    .then((res) => resolve(!!res))
                    .catch(() => resolve(false));
                } else {
                  resolve(false);
                }
              } catch(_) { resolve(false); }
            });
          } catch(_) { resolve(false); }
        });
        if (ok) {
          try { toastSuccess(`已复制${labelForToast ? `(${labelForToast})` : ''}`); } catch(_) {}
          return true;
        }
      } catch(_) {}

      try { toastError('复制失败，请手动选择并复制'); } catch(_) {}
      return false;
    };
    const copyWrap = document.createElement('div');
    copyWrap.style.cssText = 'position:relative; display:inline-block;';
    const copyBtn = mkBtn('copy', '复制', '复制/拷贝选项');
    const menu = document.createElement('div');
    menu.style.cssText = [
      'display:none','position:absolute','top:100%','left:0',
      'background:#fff','border:1px solid #ddd','border-radius:4px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)','min-width:140px','z-index:1000'
    ].join(';');
    const mkMenuItem = (text, title, onClick) => {
      const item = document.createElement('div');
      item.textContent = text; item.title = title;
      item.style.cssText = 'padding:6px 10px; cursor:pointer; white-space:nowrap;';
      item.addEventListener('mouseenter', () => item.style.background = '#f6f6f6');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', () => { menu.style.display = 'none'; onClick && onClick(); });
      return item;
    };
    const toggleMenu = () => { menu.style.display = (menu.style.display === 'none' ? 'block' : 'none'); };
    const hideMenu = () => { menu.style.display = 'none'; };

    // 1) 拷贝副本
    menu.appendChild(mkMenuItem('拷贝副本', '基于当前锚点创建副本', () => {
      if (!this.#selectedId) return;
      const src = this.#anchors.find(a => a && a.uuid === this.#selectedId); if (!src) return;
      const name = (src.name ? `${src.name}(副本)` : `${src.uuid}(副本)`);
      const newAnchor = {
        name,
        page_at: parseInt(src.page_at || 1, 10),
        position: (typeof src.position === 'number' ? (src.position > 1 ? (src.position / 100) : src.position) : 0)
      };
      this.#logger.info('Anchor clone requested', { from: this.#selectedId, newAnchor });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor: newAnchor }, { actorId: 'AnchorToolbar' });
    }));

    // 2) 复制锚点ID
    menu.appendChild(mkMenuItem('复制锚点ID', '复制选中锚点ID', async () => {
      if (!this.#selectedId) return;
      await copyTextRobust(this.#selectedId, '锚点ID');
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPY, { anchorId: this.#selectedId }, { actorId: 'AnchorToolbar' });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: this.#selectedId }, { actorId: 'AnchorToolbar' });
    }));

    // 3) 复制文内链接 [[锚点id]]
    menu.appendChild(mkMenuItem('复制文内链接', '复制 [[锚点id]]', async () => {
      if (!this.#selectedId) return;
      const link = `[[${this.#selectedId}]]`;
      await copyTextRobust(link, '文内链接');
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPY, { anchorId: this.#selectedId, wiki: true }, { actorId: 'AnchorToolbar' });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: this.#selectedId, wiki: true }, { actorId: 'AnchorToolbar' });
    }));

    copyBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', hideMenu);
    copyWrap.appendChild(copyBtn);
    copyWrap.appendChild(menu);

    bar.appendChild(addBtn);
    bar.appendChild(delBtn);
    bar.appendChild(editBtn);

    bar.appendChild(copyWrap);

    // 激活按钮（设为当前使用的锚点，以便滚动时更新页码/位置）
    const activateBtn = mkBtn('activate', '激活', '激活选中锚点');
    activateBtn.addEventListener('click', () => {
      if (!this.#selectedId) return;
      this.#logger.info('Anchor activate clicked', { id: this.#selectedId });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE, { anchorId: this.#selectedId, active: true }, { actorId: 'AnchorToolbar' });
    });
    bar.appendChild(activateBtn);

    return bar;
  }

  #createTable() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;overflow:auto;padding:8px;';

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';

    // 表头
    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    const thName = document.createElement('th'); thName.textContent = '名称';
    const thPage = document.createElement('th'); thPage.textContent = '页码';
    const thPos = document.createElement('th'); thPos.textContent = '页内位置(%)';
    [thName, thPage, thPos].forEach(th => { th.style.cssText = 'text-align:left;border-bottom:1px solid #eee;padding:6px;color:#444;'; thr.appendChild(th); });
    thead.appendChild(thr);

    const tbody = document.createElement('tbody');
    tbody.dataset.role = 'anchor-tbody';

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  #showLoading() {
    try {
      if (!this.#table) return;
      if (!this.#loadingDiv) {
        this.#loadingDiv = document.createElement('div');
        this.#loadingDiv.className = 'anchor-loading';
        this.#loadingDiv.textContent = '正在加载锚点…';
        this.#loadingDiv.style.cssText = 'margin:10px;color:#666;';
      }
      // 插入到表格容器顶部（确保与空态/错误态同层级）
      this.#table.insertBefore(this.#loadingDiv, this.#table.firstChild);
    } catch(_) {}
  }

  #hideLoading() {
    if (this.#loadingDiv && this.#loadingDiv.parentNode) {
      try { this.#loadingDiv.parentNode.removeChild(this.#loadingDiv); } catch(_) {}
    }
  }

  #showError(message) {
    try {
      if (!this.#table) return;
      if (!this.#errorDiv) {
        this.#errorDiv = document.createElement('div');
        this.#errorDiv.className = 'anchor-error';
        this.#errorDiv.style.cssText = 'margin:10px;color:#c00;background:#fff4f4;border:1px solid #f3c0c0;padding:8px;border-radius:4px;';
      } else {
        this.#errorDiv.innerHTML = '';
      }

      const msgSpan = document.createElement('span');
      msgSpan.textContent = `加载锚点失败：${String(message || '未知错误')}`;
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.textContent = '重试';
      retryBtn.style.cssText = 'margin-left:8px;padding:2px 8px;';
      retryBtn.addEventListener('click', () => this.#retryLastRequest());

      this.#errorDiv.appendChild(msgSpan);
      this.#errorDiv.appendChild(retryBtn);

      this.#table.insertBefore(this.#errorDiv, this.#table.firstChild);
    } catch(_) {}
  }

  #clearError() {
    if (this.#errorDiv && this.#errorDiv.parentNode) {
      try { this.#errorDiv.parentNode.removeChild(this.#errorDiv); } catch(_) {}
    }
  }

  #startLoadTimeout() {
    try { if (this.#loadTimeoutTimer) { clearTimeout(this.#loadTimeoutTimer); } } catch(_) {}
    const timeoutMs = 5000;
    this.#loadTimeoutTimer = setTimeout(() => {
      // 若超时且仍未加载成功，显示错误提示
      try {
        // 仅当尚未有数据渲染时提示（以 #anchors 是否为空粗略判断）
        if (!Array.isArray(this.#anchors) || this.#anchors.length === 0) {
          this.#showError('请求超时，未能从后端获取锚点数据');
        }
      } catch(_) {}
    }, timeoutMs);
  }

  #clearLoadTimeout() { if (this.#loadTimeoutTimer) { try { clearTimeout(this.#loadTimeoutTimer); } catch(_) {} this.#loadTimeoutTimer = null; } }

  #retryLastRequest() {
    try {
      const payload = this.#lastRequestPayload || {};
      // 优先复用最近一次请求；若无则从 URL 推断 pdf-id 发起列表请求
      let req = payload;
      if (!req || Object.keys(req).length === 0) {
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get('pdf-id');
          if (pdfId) { req = { pdf_uuid: pdfId }; }
        } catch(_) {}
      }
      // 清理错误并重新发起
      this.#clearError();
      this.#showLoading();
      this.#startLoadTimeout();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, req || {}, { actorId: 'AnchorSidebarUI' });
    } catch(_) {}
  }

  #renderAnchors(anchors) {
    this.#anchors = anchors || [];
    const tbody = this.#sidebarContent?.querySelector('tbody[data-role="anchor-tbody"]');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(this.#anchors) || this.#anchors.length === 0) {
      if (!this.#emptyDiv) {
        this.#emptyDiv = document.createElement('div');
        this.#emptyDiv.className = 'anchor-empty';
        this.#emptyDiv.textContent = '暂无锚点，点击“添加”创建';
        this.#emptyDiv.style.cssText = 'margin:10px;color:#999;';
        // 在表格容器上方提示
        const wrap = this.#table;
        wrap.insertBefore(this.#emptyDiv, wrap.firstChild);
      }
      return;
    } else {
      // 移除空态
      if (this.#emptyDiv && this.#emptyDiv.parentNode) {
        try { this.#emptyDiv.parentNode.removeChild(this.#emptyDiv); } catch(_) {}
        this.#emptyDiv = null;
      }
    }

    this.#anchors.forEach(a => {
      const tr = document.createElement('tr');
      tr.dataset.anchorId = a.uuid;
      tr.style.cssText = 'cursor:pointer;';
      tr.addEventListener('click', () => {
        this.#selectedId = a.uuid;
        this.#highlightSelection(a.uuid);
      });

      const tdName = document.createElement('td'); tdName.textContent = a.name || '(未命名)'; tdName.title = a?.uuid ? String(a.uuid) : ''; tdName.style.cssText = 'padding:6px;border-bottom:1px solid #f2f2f2;';
      const tdPage = document.createElement('td'); tdPage.textContent = String(a.page_at || ''); tdPage.style.cssText = 'padding:6px;border-bottom:1px solid #f2f2f2;';
      const tdPos = document.createElement('td');
      let posText = '';
      try {
        if (typeof a?.position === 'number' && !Number.isNaN(a.position)) {
          let p = a.position;
          if (p <= 1) { p = p * 100; }
          posText = String(Math.round(p));
        }
      } catch(_) { posText = ''; }
      tdPos.textContent = posText;
      tdPos.style.cssText = 'padding:6px;border-bottom:1px solid #f2f2f2;';

      tr.appendChild(tdName);
      tr.appendChild(tdPage);
      tr.appendChild(tdPos);
      tbody.appendChild(tr);
    });

    // 若无选中项则默认选中第一条，方便直接使用“复制ID/复制副本”等操作
    if (!this.#selectedId && this.#anchors.length > 0) {
      this.#selectedId = String(this.#anchors[0].uuid);
      this.#highlightSelection(this.#selectedId);
    }
  }

  #highlightSelection(id) {
    const rows = this.#sidebarContent?.querySelectorAll('tbody[data-role="anchor-tbody"] tr') || [];
    rows.forEach(r => {
      if (r.dataset.anchorId === id) {
        r.style.background = '#e3f2fd';
      } else {
        r.style.background = '';
      }
    });
  }
}

export default AnchorSidebarUI;
