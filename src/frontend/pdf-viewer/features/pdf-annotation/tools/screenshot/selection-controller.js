import { getRectFromPoints } from "./rect-utils.js";

/**
 * ScreenshotTool 框选与鼠标事件控制器（从 screenshot/index.js 抽离）
 * - 负责创建/移除选择遮罩层
 * - 负责注册/注销 document 级鼠标与键盘事件
 * - 选区完成后调用 onSelectionFinished(viewportRect)
 */
export class ScreenshotSelectionController {
  #logger;
  #onSelectionFinished;
  #onRequestDeactivate;

  #isActive = false;
  #selectionOverlay = null;
  #startPos = null;
  #endPos = null;
  #mouseListeners = null;

  constructor({ logger, onSelectionFinished, onRequestDeactivate }) {
    if (!logger) {
      throw new Error("[ScreenshotSelectionController] logger is required");
    }
    if (typeof onSelectionFinished !== "function") {
      throw new Error("[ScreenshotSelectionController] onSelectionFinished must be a function");
    }
    if (typeof onRequestDeactivate !== "function") {
      throw new Error("[ScreenshotSelectionController] onRequestDeactivate must be a function");
    }

    this.#logger = logger;
    this.#onSelectionFinished = onSelectionFinished;
    this.#onRequestDeactivate = onRequestDeactivate;
  }

  activate() {
    if (this.#isActive) {
      this.#logger.warn("[ScreenshotSelectionController] Already active");
      return;
    }

    this.#isActive = true;
    this.#createSelectionOverlay();
    this.#setupMouseEvents();
  }

  deactivate() {
    if (!this.#isActive) {
      return;
    }
    this.#cleanup();
    this.#isActive = false;
  }

  destroy() {
    this.deactivate();
  }

  #createSelectionOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "screenshot-selection-overlay";
    overlay.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100%",
      "height: 100%",
      "z-index: 9999",
      "pointer-events: none"
    ].join(";");

    const rect = document.createElement("div");
    rect.className = "selection-rect";
    rect.style.cssText = [
      "position: absolute",
      "border: 2px dashed #2196f3",
      "background: rgba(33, 150, 243, 0.1)",
      "display: none",
      "pointer-events: none"
    ].join(";");

    overlay.appendChild(rect);
    document.body.appendChild(overlay);
    this.#selectionOverlay = overlay;
  }

  #setupMouseEvents() {
    const onMouseDown = (e) => this.#handleMouseDown(e);
    const onMouseMove = (e) => this.#handleMouseMove(e);
    const onMouseUp = (e) => void this.#handleMouseUp(e);
    const onKeyDown = (e) => {
      if (e.key === "Escape" && this.#isActive) {
        this.#onRequestDeactivate();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);

    this.#mouseListeners = { onMouseDown, onMouseMove, onMouseUp, onKeyDown };
  }

  #handleMouseDown(e) {
    if (!this.#isActive) {
      return;
    }

    const pageElement = e.target?.closest?.(".page");
    if (!pageElement) {
      this.#logger.debug("[ScreenshotSelectionController] Click not within a PDF page element, ignoring");
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.#startPos = { x: e.clientX, y: e.clientY };
    this.#endPos = null;

    const rect = this.#selectionOverlay?.querySelector?.(".selection-rect");
    if (!rect) {
      throw new Error("[ScreenshotSelectionController] selection rect element not found");
    }
    rect.style.display = "block";
    rect.style.left = `${e.clientX}px`;
    rect.style.top = `${e.clientY}px`;
    rect.style.width = "0px";
    rect.style.height = "0px";
  }

  #handleMouseMove(e) {
    if (!this.#startPos || !this.#isActive) {
      return;
    }

    e.preventDefault();

    this.#endPos = { x: e.clientX, y: e.clientY };

    const rect = this.#selectionOverlay?.querySelector?.(".selection-rect");
    if (!rect) {
      throw new Error("[ScreenshotSelectionController] selection rect element not found");
    }

    const bounds = getRectFromPoints(this.#startPos, this.#endPos);
    rect.style.left = `${bounds.x}px`;
    rect.style.top = `${bounds.y}px`;
    rect.style.width = `${bounds.width}px`;
    rect.style.height = `${bounds.height}px`;
  }

  async #handleMouseUp(e) {
    if (!this.#startPos || !this.#isActive) {
      return;
    }

    this.#endPos = { x: e.clientX, y: e.clientY };
    const rect = getRectFromPoints(this.#startPos, this.#endPos);

    if (rect.width < 10 || rect.height < 10) {
      this.#logger.warn("[ScreenshotSelectionController] Selection too small, ignoring");
      this.#resetSelection();
      return;
    }

    this.#resetSelection();
    await this.#onSelectionFinished(rect);
  }

  #resetSelection() {
    this.#startPos = null;
    this.#endPos = null;

    if (this.#selectionOverlay) {
      const rect = this.#selectionOverlay.querySelector(".selection-rect");
      if (rect) {
        rect.style.display = "none";
      }
    }

    this.#logger.info("[ScreenshotSelectionController] Selection reset, ready for next capture");
  }

  #cleanup() {
    if (this.#mouseListeners) {
      document.removeEventListener("mousedown", this.#mouseListeners.onMouseDown);
      document.removeEventListener("mousemove", this.#mouseListeners.onMouseMove);
      document.removeEventListener("mouseup", this.#mouseListeners.onMouseUp);
      document.removeEventListener("keydown", this.#mouseListeners.onKeyDown);
      this.#mouseListeners = null;
    }

    if (this.#selectionOverlay) {
      this.#selectionOverlay.remove();
      this.#selectionOverlay = null;
    }

    this.#startPos = null;
    this.#endPos = null;
  }
}

