import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { showInfo } from "../../../../../common/utils/notification.js";

const TOOL_LIST = [
  { id: "screenshot", icon: "📷", title: "截图标注", kind: "tool" },
  { id: "text-highlight", icon: "✏️", title: "选字高亮", kind: "tool" },
  { id: "comment", icon: "📝", title: "批注", kind: "tool" },
  { id: "filter", icon: "🔍", title: "筛选标注", kind: "utility" },
  { id: "sort", icon: "↕️", title: "排序标注", kind: "utility" },
  { id: "settings", icon: "⚙️", title: "设置", kind: "utility" },
];

function showModeToast(toolId) {
  const modeNames = {
    screenshot: "📷 已启动截图模式",
    "text-highlight": "✏️ 已启动选字模式",
    comment: "📝 已启动批注模式",
  };

  const message = modeNames[toolId] || `已启动${toolId}模式`;
  showInfo(message);
}

export function createAnnotationSidebarToolbarController({
  eventBus,
  logger,
  getContainer,
  getActiveTool,
  setActiveTool,
}) {
  function updateToolbarState() {
    const container = getContainer();
    if (!container) {
      return;
    }

    const activeTool = getActiveTool();
    const buttons = container.querySelectorAll(".annotation-tool-btn[data-is-tool=\"true\"]");
    buttons.forEach((btn) => {
      const toolId = btn.dataset.tool;
      if (toolId === activeTool) {
        btn.style.background = "#e3f2fd";
        btn.style.borderColor = "#2196f3";
        btn.style.color = "#1976d2";
        btn.style.fontWeight = "500";
      } else {
        btn.style.background = "#fff";
        btn.style.borderColor = "#ddd";
        btn.style.color = "#666";
        btn.style.fontWeight = "normal";
      }
    });

    logger.debug(`Toolbar state updated, active tool: ${activeTool || "none"}`);
  }

  function handleToolClick(toolId) {
    const currentActive = getActiveTool();
    logger.debug(`Tool clicked: ${toolId}, current active: ${currentActive}`);

    if (currentActive === toolId) {
      setActiveTool(null);
      updateToolbarState();
      logger.info(`Tool deactivated: ${toolId}`);
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, { tool: toolId });
      return;
    }

    if (currentActive) {
      logger.debug(`Switching from ${currentActive} to ${toolId}`);
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, { tool: currentActive });
    }

    setActiveTool(toolId);
    updateToolbarState();
    logger.info(`Tool activated: ${toolId}`);
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE, { tool: toolId });
    showModeToast(toolId);
  }

  function handleUtilityButtonClick(buttonId) {
    logger.debug(`Utility button clicked: ${buttonId}`);

    switch (buttonId) {
    case "filter":
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.FILTER_TOGGLE, {});
      showInfo("筛选功能开发中...");
      break;
    case "sort":
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SORT_TOGGLE, {});
      showInfo("排序功能开发中...");
      break;
    case "settings":
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SETTINGS_OPEN, {});
      showInfo("设置功能开发中...");
      break;
    default:
      logger.warn(`Unknown utility button: ${buttonId}`);
      break;
    }
  }

  function createToolbarElement() {
    const toolbar = document.createElement("div");
    toolbar.className = "annotation-toolbar";
    toolbar.style.cssText = ["display: flex", "gap: 4px", "align-items: center"].join(";");

    TOOL_LIST.forEach((tool) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `annotation-tool-btn annotation-tool-${tool.id}`;
      btn.dataset.tool = tool.id;
      btn.title = tool.title;

      if (tool.kind === "tool") {
        btn.dataset.isTool = "true";
      }

      btn.style.cssText = [
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "width: 28px",
        "height: 28px",
        "padding: 0",
        "border: 1px solid #ddd",
        "background: #fff",
        "border-radius: 4px",
        "cursor: pointer",
        "transition: all 0.2s",
        "font-size: 16px",
        "color: #666",
      ].join(";");

      const iconSpan = document.createElement("span");
      iconSpan.textContent = tool.icon;
      iconSpan.style.lineHeight = "1";
      btn.appendChild(iconSpan);

      if (tool.kind === "utility") {
        btn.addEventListener("click", () => handleUtilityButtonClick(tool.id));
      } else {
        btn.addEventListener("click", () => handleToolClick(tool.id));
      }

      btn.addEventListener("mouseenter", () => {
        if (getActiveTool() !== tool.id) {
          btn.style.background = "#f5f5f5";
          btn.style.borderColor = "#bbb";
        }
      });
      btn.addEventListener("mouseleave", () => {
        if (getActiveTool() !== tool.id) {
          btn.style.background = "#fff";
          btn.style.borderColor = "#ddd";
        }
      });

      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  function createHeaderElement() {
    const header = document.createElement("div");
    header.className = "annotation-sidebar-header";
    header.style.cssText = [
      "padding: 8px",
      "border-bottom: 1px solid #eee",
      "background: #fafafa",
      "box-sizing: border-box",
      "flex-shrink: 0",
    ].join(";");

    const toolbar = createToolbarElement();
    header.appendChild(toolbar);
    return header;
  }

  return {
    createHeaderElement,
    updateToolbarState,
    handleToolClick,
    handleUtilityButtonClick,
  };
}
