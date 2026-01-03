import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * @param {{
 *  name: string,
 *  displayName: string,
 *  icon: string,
 *  eventBus: any,
 *  isActive: () => boolean,
 *  deactivate: () => void,
 * }} ctx
 * @returns {HTMLElement}
 */
export function createTextHighlightToolButton(ctx) {
  const { name, displayName, icon, eventBus, isActive, deactivate } = ctx;

  const button = document.createElement("button");
  button.id = `${name}-tool-btn`;
  button.className = "annotation-tool-button";
  button.innerHTML = `<span class="tool-icon">${icon}</span><span class="tool-name">${displayName}</span>`;
  button.title = `${displayName}工具 - 选择文本并高亮标注`;

  button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      margin: 4px 0;
    `;

  button.addEventListener("mouseenter", () => {
    if (!isActive()) {
      button.style.backgroundColor = "#e8e8e8";
    }
  });

  button.addEventListener("mouseleave", () => {
    if (!isActive()) {
      button.style.backgroundColor = "#f5f5f5";
    }
  });

  button.addEventListener("click", () => {
    if (isActive()) {
      deactivate();
      button.style.backgroundColor = "#f5f5f5";
      button.style.borderColor = "#ddd";
    } else {
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE, { tool: name });
      button.style.backgroundColor = "#e3f2fd";
      button.style.borderColor = "#2196F3";
    }
  });

  eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED, (data) => {
    if (data.tool === name) {
      button.style.backgroundColor = "#e3f2fd";
      button.style.borderColor = "#2196F3";
    } else {
      button.style.backgroundColor = "#f5f5f5";
      button.style.borderColor = "#ddd";
    }
  });

  eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED, (data) => {
    if (data.tool === name) {
      button.style.backgroundColor = "#f5f5f5";
      button.style.borderColor = "#ddd";
    }
  });

  return button;
}

