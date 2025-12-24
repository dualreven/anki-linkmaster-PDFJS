/**
 * @file Text-highlight DOM centering helper
 * @description
 * 为历史高亮标注（缺少 lineRects）提供跳转居中兜底：等待高亮 DOM 容器渲染后，
 * 计算其在 page 内的中心百分比并调用 NavigationService.scrollToPosition 居中滚动。
 */

/**
 * @param {Object} params
 * @param {string} params.annotationId
 * @param {number} params.pageNumber
 * @param {{ scrollToPosition:(percent:number, pageNumber:number)=>Promise<any> }} params.navigationService
 * @param {number} [params.timeoutMs=1200]
 * @returns {Promise<{ ok: boolean, percent: (number|null) }>}
 */
export async function centerTextHighlightViaDom({
  annotationId,
  pageNumber,
  navigationService,
  timeoutMs = 1200
} = {}) {
  if (!annotationId) {
    throw new Error("centerTextHighlightViaDom requires annotationId");
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`centerTextHighlightViaDom invalid pageNumber: ${pageNumber}`);
  }
  if (!navigationService || typeof navigationService.scrollToPosition !== "function") {
    throw new Error("centerTextHighlightViaDom requires navigationService.scrollToPosition()");
  }

  const start = Date.now();
  const selector = `.text-highlight-container[data-annotation-id="${annotationId}"]`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * 注意：`.text-highlight-container` 在渲染时是“覆盖整页”的容器（100% 宽高），
   * 其自身的 DOMRect 不能用于定位高亮中心。必须使用其内部的 `.text-highlight` 子块矩形。
   * @param {HTMLElement} containerEl
   * @param {HTMLElement} pageEl
   * @returns {number|null}
   */
  const computePercentFromHighlightChildren = (containerEl, pageEl) => {
    const pageRect = pageEl.getBoundingClientRect?.();
    const pageHeight = Number(pageEl.offsetHeight || pageRect?.height || 0);
    if (!pageRect || pageHeight <= 0) {
      return null;
    }

    const blocks = Array.from(containerEl.querySelectorAll(".text-highlight"));
    if (blocks.length === 0) {
      return null;
    }

    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const el of blocks) {
      const r = el.getBoundingClientRect?.();
      if (!r || !Number.isFinite(r.top) || !Number.isFinite(r.bottom)) {
        continue;
      }
      minTop = Math.min(minTop, r.top);
      maxBottom = Math.max(maxBottom, r.bottom);
    }

    if (!Number.isFinite(minTop) || !Number.isFinite(maxBottom) || maxBottom <= minTop) {
      return null;
    }

    const centerPx = ((minTop + maxBottom) / 2) - pageRect.top;
    const percent = Math.max(0, Math.min(100, (centerPx / pageHeight) * 100));
    return Number.isFinite(percent) ? percent : null;
  };

  // 先尝试一次“立即命中”，再进入轮询等待（避免无谓 sleep）
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) {
      const pageEl = el.closest?.(".page");
      if (!pageEl) {
        return { ok: false, percent: null };
      }

      const percent = computePercentFromHighlightChildren(el, pageEl);
      if (percent !== null) {
        await navigationService.scrollToPosition(percent, pageNumber);
        return { ok: true, percent };
      }
    }

    await sleep(50);
  }

  return { ok: false, percent: null };
}
