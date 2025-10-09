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

    const addBtn = mkBtn('add', '添加', '添加锚点（名称/页码/位置）');
    addBtn.addEventListener('click', () => this.#openCreateDialog());

    const delBtn = mkBtn('delete', '删除', '删除选中锚点');
    delBtn.addEventListener('click', () => {
      if (!this.#selectedId) return;
      this.#logger.info('Anchor delete clicked', { id: this.#selectedId });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DELETE, { anchorId: this.#selectedId }, { actorId: 'AnchorToolbar' });
    });

    const editBtn = mkBtn('edit', '修改', '修改选中锚点（名称/页码/位置）');
    editBtn.addEventListener('click', () => this.#openEditDialog());

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

    return bar;
  }

  #openCreateDialog() {
    const curr = (() => {
      try {
        const viewer = document.getElementById("viewerContainer");
        if (!viewer) { return { pageAt: 1, position: "" }; }
        const centerY = viewer.scrollTop + viewer.clientHeight / 2;
        const pages = Array.from(viewer.querySelectorAll(".page"));
        let best = { pageAt: 1, position: "", dist: Number.POSITIVE_INFINITY };
        for (const el of pages) {
          const pageNo = parseInt(el.getAttribute("data-page-number") || "1", 10) || 1;
          const top = el.offsetTop; const height = el.offsetHeight || 1; const bottom = top + height;
          if (centerY >= top && centerY <= bottom) {
            const rel = (centerY - top) / height;
            return { pageAt: pageNo, position: String(Math.round(rel * 100)) };
          }
          const dist = Math.min(Math.abs(centerY - top), Math.abs(centerY - bottom));
          if (dist < best.dist) { best = { pageAt: pageNo, position: centerY < top ? "0" : "100", dist }; }
        }
        return { pageAt: best.pageAt, position: best.position };
      } catch { return { pageAt: 1, position: "" }; }
    })();

    this.#showAnchorDialog({
      title: "添加锚点",
      initial: { name: "", page_at: String(curr.pageAt), position: String(curr.position) },
      onConfirm: (vals) => {
        const name = String(vals.name || "").trim();
        if (!name) { return; }
        let page_at = parseInt(String(vals.page_at || "1").trim(), 10); if (!Number.isFinite(page_at) || page_at < 1) { page_at = 1; }
        const posStr = String(vals.position || "").trim();
        const anchor = { name, page_at };
        if (posStr !== "") {
          let position = Number(posStr); if (!Number.isFinite(position)) { position = 0; }
          position = Math.max(0, Math.min(100, position));
          anchor.position = position;
        }
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor }, { actorId: "AnchorToolbar" });
      }
    });
  }

  #openEditDialog() {
    if (!this.#selectedId) { return; }
    const a = this.#anchors.find(x => x && x.uuid === this.#selectedId) || {};
    const currName = a.name || "";
    const currPage = parseInt(a.page_at || 1, 10) || 1;
    const currPos = (() => {
      const p = a.position;
      if (typeof p !== "number") return "";
      return (p <= 1 ? String(Math.round(p * 100)) : String(Math.round(p)));
    })();

    this.#showAnchorDialog({
      title: "修改锚点",
      initial: { name: currName, page_at: String(currPage), position: String(currPos) },
      onConfirm: (vals) => {
        const update = {};
        const name = String(vals.name || "").trim();
        if (name && name !== currName) { update.name = name; }
        let page_at = parseInt(String(vals.page_at || "").trim(), 10);
        if (Number.isFinite(page_at) && page_at >= 1 && page_at !== currPage) { update.page_at = page_at; }
        const posStr = String(vals.position || "").trim();
        if (posStr !== "") {
          let position = Number(posStr);
          if (Number.isFinite(position)) {
            position = Math.max(0, Math.min(100, position));
            // 只有变化时才写入
            const oldPct = (typeof a.position === "number" ? (a.position <= 1 ? Math.round(a.position * 100) : Math.round(a.position)) : null);
            if (oldPct === null || oldPct !== Math.round(position)) { update.position = position; }
          }
        }
        if (Object.keys(update).length === 0) { return; }
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATE, { anchorId: this.#selectedId, update }, { actorId: "AnchorToolbar" });
        // 本地即时刷新
        try {
          const idx = this.#anchors.findIndex(x => x && x.uuid === this.#selectedId);
          if (idx >= 0) {
            if (update.name) { this.#anchors[idx].name = update.name; }
            if (typeof update.page_at === "number") { this.#anchors[idx].page_at = update.page_at; }
            if (typeof update.position === "number") { this.#anchors[idx].position = (update.position > 1 ? (update.position / 100) : update.position); }
            this.#renderAnchors(this.#anchors);
          }
        } catch (_) {}
      }
    });
  }

  #showAnchorDialog({ title, initial, onConfirm }) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";
    const dialog = document.createElement("div");
    dialog.style.cssText = "background:#fff;border-radius:8px;min-width:320px;max-width:420px;padding:16px 16px 12px;box-shadow:0 8px 24px rgba(0,0,0,.2);";
    const h3 = document.createElement("div"); h3.textContent = title || ""; h3.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:12px;color:#333;";

    const mkRow = (label, id, type, value, placeholder) => {
      const row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;margin:8px 0;gap:8px;";
      const lab = document.createElement("label"); lab.textContent = label; lab.style.cssText = "width:72px;color:#555;"; lab.setAttribute("for", id);
      const inp = document.createElement("input"); inp.type = type; inp.id = id; inp.value = value ?? ""; inp.placeholder = placeholder || ""; inp.style.cssText = "flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;";
      row.appendChild(lab); row.appendChild(inp);
      return { row, inp };
    };

    const rName = mkRow("名称", "anchor-name", "text", initial?.name ?? "", "示例：章节A");
    const rPage = mkRow("页码", "anchor-page", "number", initial?.page_at ?? "1", "例如：12"); rPage.inp.min = "1";
    const rPos  = mkRow("位置(%)", "anchor-pos", "number", initial?.position ?? "", "0~100，可留空"); rPos.inp.min = "0"; rPos.inp.max = "100";

    const btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:14px;";
    const cancelBtn = document.createElement("button"); cancelBtn.type = "button"; cancelBtn.textContent = "取消"; cancelBtn.style.cssText = "padding:6px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;";
    const saveBtn   = document.createElement("button"); saveBtn.type = "button"; saveBtn.textContent = "保存"; saveBtn.style.cssText   = "padding:6px 12px;border:1px solid #1976d2;border-radius:4px;background:#1976d2;color:#fff;cursor:pointer;";

    const close = () => { try { document.body.removeChild(overlay); } catch(_){} };
    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", () => {
      const vals = { name: rName.inp.value, page_at: rPage.inp.value, position: rPos.inp.value };
      try { onConfirm && onConfirm(vals); } catch(_) {}
      close();
    });

    dialog.appendChild(h3);
    dialog.appendChild(rName.row);
    dialog.appendChild(rPage.row);
    dialog.appendChild(rPos.row);
    btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    try { rName.inp.focus(); } catch(_) {}
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
