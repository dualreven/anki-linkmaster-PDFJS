import { removeFromPendingBuckets } from "./comment-tool-marker-restoration.js";

function hashCommentAnnotation(annotation) {
  const id = String(annotation?.id || "").trim();
  const pageNumber = Number(annotation?.pageNumber || 0);
  const content = String(annotation?.data?.content || "");
  const pp = annotation?.data?.positionPercent || null;
  const p = annotation?.data?.position || null;

  const xp = (pp && typeof pp.xPercent === "number") ? pp.xPercent : null;
  const yp = (pp && typeof pp.yPercent === "number") ? pp.yPercent : null;
  const px = (p && typeof p.x === "number") ? p.x : null;
  const py = (p && typeof p.y === "number") ? p.y : null;

  return `${id}|${pageNumber}|${content}|pp:${xp ?? "n"},${yp ?? "n"}|p:${px ?? "n"},${py ?? "n"}`;
}

export function createCommentToolStoreReactiveSync({
  logger,
  ensureOverlayFor,
  commentMarker,
  pendingMarkersByPage,
}) {
  if (!logger) { throw new Error("[CommentToolStoreReactive] logger is required"); }
  if (typeof ensureOverlayFor !== "function") { throw new Error("[CommentToolStoreReactive] ensureOverlayFor must be function"); }
  if (!commentMarker) { throw new Error("[CommentToolStoreReactive] commentMarker is required"); }
  if (!pendingMarkersByPage) { throw new Error("[CommentToolStoreReactive] pendingMarkersByPage is required"); }

  /** @type {Map<string, string>} */
  const hashById = new Map();

  const removeMarkerById = (id) => {
    try { commentMarker?.removeMarker?.(id); } catch (e) { void e; /* logger-guard */ }
    try { removeFromPendingBuckets({ pendingMarkersByPage, annotationId: id }); } catch (e) { void e; /* logger-guard */ }
  };

  return {
    handleAnnotationsChanged(annotations) {
      try {
        const list = Array.isArray(annotations) ? annotations : [];
        const next = new Map();

        for (const ann of list) {
          if (!ann || ann.type !== "comment") { continue; }
          const id = String(ann.id || "").trim();
          if (!id) { continue; }
          next.set(id, { ann, hash: hashCommentAnnotation(ann) });
        }

        // 删除：store 不再存在的 comment
        for (const [id] of hashById) {
          if (next.has(id)) { continue; }
          removeMarkerById(id);
          hashById.delete(id);
        }

        // 新增/变更：强制重建 marker（避免“已挂载则跳过”导致内容/位置变更不同步）
        for (const [id, { ann, hash }] of next) {
          const prev = hashById.get(id) || null;
          if (prev === hash) { continue; }
          if (prev !== null) {
            removeMarkerById(id);
          }
          hashById.set(id, hash);
          ensureOverlayFor(ann);
        }
      } catch (e) {
        logger?.warn?.("[CommentTool] store-driven sync failed", e);
      }
    },
    clear() {
      hashById.clear();
    }
  };
}

