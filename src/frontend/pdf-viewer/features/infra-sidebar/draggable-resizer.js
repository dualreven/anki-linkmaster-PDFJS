/**
 * DraggableResizer
 *
 * 目标：把“拖拽调整宽度”的 DOM 监听细节从 SidebarManagerFeature 中抽离出来，
 * 形成可复用、可单测、生命周期清晰的组件。
 *
 * 约束：
 * - destroy() 必须在“拖拽中途销毁”时清理 document mousemove/mouseup 监听。
 */

export class DraggableResizer {
  /** @type {HTMLElement} */
  #handle;
  /** @type {() => number} */
  #getWidth;
  /** @type {(newWidth:number) => void} */
  #onWidth;
  /** @type {number|null} */
  #minWidth;
  /** @type {number|null} */
  #maxWidth;

  #isDragging = false;
  #startX = 0;
  #startWidth = 0;

  #onMouseDown;
  #onDocumentMouseMove = null;
  #onDocumentMouseUp = null;

  #prevBodyCursor = "";
  #prevBodyUserSelect = "";

  /**
   * @param {{
   *   handle: HTMLElement,
   *   getWidth: () => number,
   *   onWidth: (newWidth:number) => void,
   *   minWidth?: number | null,
   *   maxWidth?: number | null,
   *   cursor?: string,
   * }} options
   */
  constructor({ handle, getWidth, onWidth, minWidth = null, maxWidth = null, cursor = "col-resize" }) {
    if (!(handle instanceof HTMLElement)) {
      throw new Error("[infra-sidebar] DraggableResizer: handle must be an HTMLElement");
    }
    if (typeof getWidth !== "function") {
      throw new Error("[infra-sidebar] DraggableResizer: getWidth is required");
    }
    if (typeof onWidth !== "function") {
      throw new Error("[infra-sidebar] DraggableResizer: onWidth is required");
    }

    this.#handle = handle;
    this.#getWidth = getWidth;
    this.#onWidth = onWidth;
    this.#minWidth = (typeof minWidth === "number" && Number.isFinite(minWidth)) ? minWidth : null;
    this.#maxWidth = (typeof maxWidth === "number" && Number.isFinite(maxWidth)) ? maxWidth : null;

    this.#onMouseDown = (e) => {
      if (this.#isDragging) { return; }
      e.preventDefault();
      this.#beginDragging(e, cursor);
    };

    this.#handle.addEventListener("mousedown", this.#onMouseDown);
  }

  destroy() {
    this.#handle.removeEventListener("mousedown", this.#onMouseDown);
    this.#stopDragging();
  }

  #beginDragging(mouseEvent, cursor) {
    this.#isDragging = true;
    this.#startX = mouseEvent.clientX;
    this.#startWidth = this.#getWidth();

    this.#handle.classList.add("resizing");
    this.#prevBodyCursor = document.body.style.cursor || "";
    this.#prevBodyUserSelect = document.body.style.userSelect || "";
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    this.#onDocumentMouseMove = (e) => {
      if (!this.#isDragging) { return; }
      const deltaX = e.clientX - this.#startX;
      let nextWidth = this.#startWidth + deltaX;
      if (this.#minWidth !== null) { nextWidth = Math.max(this.#minWidth, nextWidth); }
      if (this.#maxWidth !== null) { nextWidth = Math.min(this.#maxWidth, nextWidth); }
      this.#onWidth(nextWidth);
    };

    this.#onDocumentMouseUp = () => {
      this.#stopDragging();
    };

    document.addEventListener("mousemove", this.#onDocumentMouseMove);
    document.addEventListener("mouseup", this.#onDocumentMouseUp);
  }

  #stopDragging() {
    if (!this.#isDragging) { return; }
    this.#isDragging = false;

    if (this.#onDocumentMouseMove) {
      document.removeEventListener("mousemove", this.#onDocumentMouseMove);
      this.#onDocumentMouseMove = null;
    }
    if (this.#onDocumentMouseUp) {
      document.removeEventListener("mouseup", this.#onDocumentMouseUp);
      this.#onDocumentMouseUp = null;
    }

    this.#handle.classList.remove("resizing");
    document.body.style.cursor = this.#prevBodyCursor;
    document.body.style.userSelect = this.#prevBodyUserSelect;
  }
}

export default DraggableResizer;

