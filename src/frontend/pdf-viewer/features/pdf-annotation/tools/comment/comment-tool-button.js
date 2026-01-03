import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

export function createCommentToolButton({ toolName, displayName, icon, eventBus, isActive, deactivate }) {
  const button = document.createElement("button");
  button.id = `${toolName}-tool-btn`;
  button.className = "annotation-tool-button";
  button.textContent = `${icon} ${displayName}`;
  button.title = `${displayName}工具`;

  button.style.cssText =
    "padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;" +
    "transition:background .2s,border-color .2s;display:flex;align-items:center;gap:6px;";

  button.addEventListener("click", () => {
    if (isActive()) {
      deactivate();
      button.style.background = "#fff";
      button.style.borderColor = "#ddd";
      return;
    }
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE,
      { tool: toolName },
      { actorId: "CommentTool" }
    );
    button.style.background = "#E3F2FD";
    button.style.borderColor = "#2196F3";
  });

  return button;
}

