const SIDEBAR_WIDTH_PX = 280;
const SIDEBAR_TOGGLE_BTN_ID = "planner-sidebar-toggle-btn";
const TOGGLE_BTN_WIDTH_PX = 32;
const TOGGLE_BTN_GAP_PX = 8;

function assertHTMLElementOrThrow(el, name) {
  if (!el || typeof el !== "object") {
    throw new Error(`${name} 缺失或类型不正确`);
  }
  if (!(el instanceof HTMLElement)) {
    throw new Error(`${name} 必须是 HTMLElement`);
  }
}

function assertOptionalLoggerOrThrow(logger) {
  if (logger === undefined || logger === null) {
    return;
  }
  if (typeof logger !== "object") {
    throw new Error("logger 类型不正确");
  }
  if (logger.info && typeof logger.info !== "function") {
    throw new Error("logger.info 必须是函数");
  }
  if (logger.warn && typeof logger.warn !== "function") {
    throw new Error("logger.warn 必须是函数");
  }
}

function applyPushLayoutOrThrow({ mainEl }) {
  const offset = SIDEBAR_WIDTH_PX + TOGGLE_BTN_WIDTH_PX + TOGGLE_BTN_GAP_PX;
  mainEl.style.marginLeft = `${offset}px`;
  mainEl.style.width = `calc(100% - ${offset}px)`;
}

function clearPushLayoutOrThrow({ mainEl }) {
  const offset = TOGGLE_BTN_WIDTH_PX + TOGGLE_BTN_GAP_PX;
  mainEl.style.marginLeft = `${offset}px`;
  mainEl.style.width = `calc(100% - ${offset}px)`;
}

/**
 * @param {object} args
 * @param {HTMLElement} args.sidebarEl
 * @param {HTMLElement} args.mainEl
 * @param {HTMLElement} args.toolbarEl
 * @param {{info?: Function, warn?: Function}} [args.logger]
 * @returns {{ dispose: Function, setCollapsedOrThrow: Function, isCollapsed: Function }}
 */
export function installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl, logger } = {}) {
  assertHTMLElementOrThrow(sidebarEl, "sidebarEl");
  assertHTMLElementOrThrow(mainEl, "mainEl");
  assertHTMLElementOrThrow(toolbarEl, "toolbarEl");
  assertOptionalLoggerOrThrow(logger);

  let toggleBtn = toolbarEl.querySelector(`#${SIDEBAR_TOGGLE_BTN_ID}`);
  if (toggleBtn && !(toggleBtn instanceof HTMLButtonElement)) {
    throw new Error(`#${SIDEBAR_TOGGLE_BTN_ID} 必须是 <button> 元素`);
  }

  let disposed = false;
  let collapsed = false;

  function ensureToggleBtnOrThrow() {
    if (toggleBtn) {
      return toggleBtn;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = SIDEBAR_TOGGLE_BTN_ID;
    btn.className = "planner-sidebar-toggle-btn";
    toolbarEl.appendChild(btn);
    toggleBtn = btn;
    return btn;
  }

  function syncButtonTextOrThrow() {
    const btn = ensureToggleBtnOrThrow();
    btn.textContent = collapsed ? "▶" : "◀";
    btn.title = collapsed ? "展开工具栏" : "收起工具栏";
    btn.classList.toggle("collapsed", collapsed);
  }

  function setCollapsedOrThrow(nextCollapsed) {
    if (disposed) {
      throw new Error("PlannerSidebarController 已 dispose，禁止继续操作");
    }
    if (typeof nextCollapsed !== "boolean") {
      throw new Error("collapsed 参数必须是 boolean");
    }

    collapsed = nextCollapsed;
    sidebarEl.classList.toggle("collapsed", collapsed);

    if (collapsed) {
      clearPushLayoutOrThrow({ mainEl });
    } else {
      applyPushLayoutOrThrow({ mainEl });
    }

    syncButtonTextOrThrow();
  }

  function onToggleClick() {
    setCollapsedOrThrow(!collapsed);
  }

  const btn = ensureToggleBtnOrThrow();
  btn.addEventListener("click", onToggleClick);

  setCollapsedOrThrow(false);

  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      if (toggleBtn) {
        toggleBtn.removeEventListener("click", onToggleClick);
        toggleBtn.remove();
        toggleBtn = null;
      }
      if (logger?.info) {
        logger.info("[PlannerSidebarController] disposed");
      }
    },
    setCollapsedOrThrow,
    isCollapsed() {
      return collapsed;
    }
  };
}
