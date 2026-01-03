/**
 * Pending highlight queue by page (Map<number, Map<string, Annotation>>)
 */

export class PendingHighlightQueue {
  /** @type {Map<number, Map<string, any>>} */
  #pendingByPage = new Map();

  clear() {
    this.#pendingByPage.clear();
  }

  /**
   * @param {{ id?: string, pageNumber?: number }} annotation
   */
  enqueue(annotation) {
    if (!annotation?.id || !annotation?.pageNumber) {
      return;
    }
    const pageNumber = Number(annotation.pageNumber);
    let bucket = this.#pendingByPage.get(pageNumber);
    if (!bucket) {
      bucket = new Map();
      this.#pendingByPage.set(pageNumber, bucket);
    }
    bucket.set(annotation.id, annotation);
  }

  /**
   * @param {string} annotationId
   * @param {number} pageNumber
   */
  remove(annotationId, pageNumber) {
    if (!annotationId || !pageNumber) {
      return;
    }
    const bucket = this.#pendingByPage.get(pageNumber);
    if (!bucket) {
      return;
    }
    bucket.delete(annotationId);
    if (bucket.size === 0) {
      this.#pendingByPage.delete(pageNumber);
    }
  }

  /**
   * @param {number} pageNumber
   * @returns {any[]}
   */
  drainPage(pageNumber) {
    const bucket = this.#pendingByPage.get(pageNumber);
    if (!bucket || bucket.size === 0) {
      return [];
    }
    return Array.from(bucket.values());
  }
}

