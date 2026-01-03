import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * @param {{
 *  annotation: any,
 *  eventBus: any,
 *  confirmAction: (message: string) => Promise<boolean>,
 * }} ctx
 * @returns {HTMLElement}
 */
export function createTextHighlightAnnotationCard(ctx) {
  const { annotation, eventBus, confirmAction } = ctx;

  if (!annotation?.id) {
    throw new Error("[TextHighlightTool] createAnnotationCard requires annotation.id");
  }
  if (typeof confirmAction !== "function") {
    throw new Error("[TextHighlightTool] createAnnotationCard requires confirmAction()");
  }

  const card = document.createElement("div");
  card.className = "annotation-card text-highlight-card";
  card.dataset.annotationId = annotation.id;

  card.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

  card.addEventListener("mouseenter", () => {
    card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    card.style.borderColor = "#2196F3";
  });

  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = "none";
    card.style.borderColor = "#e0e0e0";
  });

  const colorIndicator = document.createElement("div");
  colorIndicator.style.cssText = `
      width: 100%;
      height: 4px;
      background-color: ${annotation.data.color};
      border-radius: 2px;
      margin-bottom: 8px;
    `;
  card.appendChild(colorIndicator);

  const textContent = document.createElement("div");
  textContent.className = "annotation-text";
  const displayText = annotation.data.text.length > 100
    ? annotation.data.text.substring(0, 100) + "..."
    : annotation.data.text;
  textContent.textContent = displayText;
  textContent.style.cssText = `
      font-size: 14px;
      color: #333;
      line-height: 1.5;
      margin-bottom: 8px;
      word-break: break-word;
    `;
  card.appendChild(textContent);

  const infoBar = document.createElement("div");
  infoBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    `;

  const pageInfo = document.createElement("span");
  pageInfo.textContent = `页码: ${annotation.pageNumber}`;
  infoBar.appendChild(pageInfo);

  const timeInfo = document.createElement("span");
  timeInfo.textContent = annotation.getFormattedDate();
  infoBar.appendChild(timeInfo);

  card.appendChild(infoBar);

  const actionBar = document.createElement("div");
  actionBar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
    `;

  const jumpButton = document.createElement("button");
  jumpButton.textContent = "跳转";
  jumpButton.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s ease;
    `;
  jumpButton.addEventListener("mouseenter", () => {
    jumpButton.style.backgroundColor = "#1976D2";
  });
  jumpButton.addEventListener("mouseleave", () => {
    jumpButton.style.backgroundColor = "#2196F3";
  });
  jumpButton.addEventListener("click", (e) => {
    e.stopPropagation();
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation });
  });
  actionBar.appendChild(jumpButton);

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "删除";
  deleteButton.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s ease;
    `;
  deleteButton.addEventListener("mouseenter", () => {
    deleteButton.style.backgroundColor = "#d32f2f";
  });
  deleteButton.addEventListener("mouseleave", () => {
    deleteButton.style.backgroundColor = "#f44336";
  });
  deleteButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await confirmAction("确定要删除这个标注吗？");
    if (ok) {
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotation.id });
    }
  });
  actionBar.appendChild(deleteButton);

  card.appendChild(actionBar);

  card.addEventListener("click", () => {
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation });
  });

  return card;
}

