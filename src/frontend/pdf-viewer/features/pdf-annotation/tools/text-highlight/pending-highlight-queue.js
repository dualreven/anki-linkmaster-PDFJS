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
   * 移除所有不在 nextIds 中的待渲染项（用于 store snapshot diff 的删除同步）
   * @param {Set<string>} nextIds
   */
  pruneNotIn(nextIds) {
    if (!nextIds || !(nextIds instanceof Set)) {
      throw new Error("[PendingHighlightQueue] pruneNotIn: nextIds must be a Set");
    }

    for (const [pageNumber, bucket] of this.#pendingByPage.entries()) {
      for (const id of bucket.keys()) {
        if (!nextIds.has(id)) {
          bucket.delete(id);
        }
      }
      if (bucket.size === 0) {
        this.#pendingByPage.delete(pageNumber);
      }
    }
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
