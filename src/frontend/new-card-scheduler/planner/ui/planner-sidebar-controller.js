const SIDEBAR_WIDTH_PX = 280;
const SIDEBAR_TOGGLE_BTN_ID = "planner-sidebar-toggle-btn";

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
  mainEl.style.marginLeft = `${SIDEBAR_WIDTH_PX}px`;
  mainEl.style.width = `calc(100% - ${SIDEBAR_WIDTH_PX}px)`;
}

function clearPushLayoutOrThrow({ mainEl }) {
  mainEl.style.marginLeft = "";
  mainEl.style.width = "";
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

  const toggleBtn = toolbarEl.querySelector(`#${SIDEBAR_TOGGLE_BTN_ID}`);
  if (!toggleBtn) {
    throw new Error(`缺少 #${SIDEBAR_TOGGLE_BTN_ID}，无法安装侧边栏折叠按钮`);
  }
  if (!(toggleBtn instanceof HTMLButtonElement)) {
    throw new Error(`#${SIDEBAR_TOGGLE_BTN_ID} 必须是 <button> 元素`);
  }

  let disposed = false;
  let collapsed = false;

  function syncButtonTextOrThrow() {
    toggleBtn.textContent = collapsed ? "展开工具栏" : "收起工具栏";
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

  toggleBtn.addEventListener("click", onToggleClick);

  setCollapsedOrThrow(false);

  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      toggleBtn.removeEventListener("click", onToggleClick);
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

