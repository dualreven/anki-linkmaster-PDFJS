export function removeFromPendingBuckets({ pendingMarkersByPage, annotationId }) {
  pendingMarkersByPage.forEach((bucket, page) => {
    if (bucket?.has?.(annotationId)) {
      bucket.delete(annotationId);
      if (bucket.size === 0) {
        pendingMarkersByPage.delete(page);
      }
    }
  });
}

export function ensureOverlayOrQueue({
  annotation,
  isPageReady,
  pendingMarkersByPage,
  renderMarkerForAnnotation,
  logger
}) {
  if (!annotation || annotation.type !== "comment") {
    return;
  }
  const page = Number(annotation.pageNumber || 0);
  if (isPageReady(page)) {
    logger.debug("[CommentTool] Page ready → render now", { id: annotation.id, page });
    renderMarkerForAnnotation(annotation);
    return;
  }

  let bucket = pendingMarkersByPage.get(page);
  if (!bucket) {
    bucket = new Map();
    pendingMarkersByPage.set(page, bucket);
  }
  bucket.set(annotation.id, annotation);
  logger.debug("[CommentTool] Page not ready → queued", { id: annotation.id, page });
}

export function flushPendingMarkersForPage({
  pageNumber,
  pendingMarkersByPage,
  renderMarkerForAnnotation,
  logger
}) {
  const bucket = pendingMarkersByPage.get(pageNumber);
  if (!bucket || bucket.size === 0) {
    return;
  }
  const items = Array.from(bucket.values());
  pendingMarkersByPage.delete(pageNumber);
  logger.info(`🔁 [FlushPending] page=${pageNumber} count=${items.length}`);
  items.forEach((ann) => {
    try {
      renderMarkerForAnnotation(ann);
    } catch (e) {
      void e; /* logger-guard */
    }
  });
}

export function restoreMarkersForPage({
  pageNumber,
  annotationManager,
  renderMarkerForAnnotation,
  logger
}) {
  logger.info(`🔄 [RestoreMarkers] Starting restoration for page ${pageNumber}`);

  if (!annotationManager) {
    logger.error("❌ Cannot restore markers: AnnotationManager not available");
    return;
  }

  const annotations = annotationManager.getAnnotationsByPage(pageNumber);
  logger.info(`📋 Found ${annotations.length} total annotations on page ${pageNumber}`);

  const commentAnnotations = annotations.filter((ann) => ann.type === "comment");
  logger.info(`📝 Found ${commentAnnotations.length} comment annotations on page ${pageNumber}`);

  if (commentAnnotations.length === 0) {
    logger.debug(`ℹ️ No comment annotations to restore on page ${pageNumber}`);
    return;
  }

  logger.info(`✨ Restoring ${commentAnnotations.length} markers for page ${pageNumber}`);
  commentAnnotations.forEach((annotation, index) => {
    logger.debug(`  [${index + 1}/${commentAnnotations.length}] Restoring marker for annotation ${annotation.id}`);
    renderMarkerForAnnotation(annotation);
  });
  logger.info(`✅ Marker restoration complete for page ${pageNumber}`);
}

export function renderCommentMarkerForAnnotation({
  annotation,
  commentMarker,
  getPageElement,
  onMarkerClick,
  logger
}) {
  logger.debug(`🎨 [RenderMarker] Rendering marker for annotation ${annotation.id}`);

  const existingMarker = commentMarker.getMarker(annotation.id);
  if (existingMarker) {
    const hasParent = existingMarker.parentElement !== null;
    logger.debug(`  Existing marker found: hasParent=${hasParent}`);
    if (hasParent) {
      logger.debug("  ✅ Marker already attached to DOM, skipping");
      return;
    }
    logger.debug("  ⚠️ Marker exists but detached from DOM, will recreate");
  } else {
    logger.debug("  ℹ️ No existing marker, creating new one");
  }

  logger.debug("  Creating marker...");
  const marker = commentMarker.createMarker(annotation);

  logger.debug(`  Finding page element for page ${annotation.pageNumber}...`);
  const pageElement = getPageElement(annotation.pageNumber);
  if (!pageElement) {
    logger.error(`  ❌ Page element not found for annotation ${annotation.id} (page ${annotation.pageNumber})`);
    return;
  }
  logger.debug("  ✅ Page element found");

  try {
    const data = annotation?.data || {};
    const hasPercent =
      data?.positionPercent &&
      typeof data.positionPercent.xPercent === "number" &&
      typeof data.positionPercent.yPercent === "number";
    const hasPixel = data?.position && typeof data.position.x === "number" && typeof data.position.y === "number";
    if (!hasPercent && hasPixel) {
      const x = data.position.x;
      const y = data.position.y;
      const looksLikePercent = x >= 0 && x <= 100 && y >= 0 && y <= 100;
      if (looksLikePercent) {
        annotation.data.positionPercent = { xPercent: x, yPercent: y };
        logger.debug(`  ↻ position(as-percent) → positionPercent: (${x.toFixed(2)}%,${y.toFixed(2)}%)`);
      } else {
        const w = pageElement.clientWidth || pageElement.offsetWidth || 1;
        const h = pageElement.clientHeight || pageElement.offsetHeight || 1;
        const xp = Math.max(0, Math.min(100, (x / Math.max(1, w)) * 100));
        const yp = Math.max(0, Math.min(100, (y / Math.max(1, h)) * 100));
        annotation.data.positionPercent = { xPercent: xp, yPercent: yp };
        logger.debug(`  ↻ position(px)→percent: (${x},${y}) → (${xp.toFixed(2)}%,${yp.toFixed(2)}%)`);
      }
    }
  } catch (e) {
    void e; /* logger-guard */
  }

  logger.debug("  Appending marker to page...");
  const success = commentMarker.renderToPage(annotation.id, pageElement);
  if (!success) {
    logger.error("  ❌ Failed to render marker to page");
    return;
  }

  marker.addEventListener("click", (e) => {
    e.stopPropagation();
    onMarkerClick(annotation.id);
  });

  logger.info(`  ✅ Marker successfully rendered for annotation ${annotation.id} on page ${annotation.pageNumber}`);
}
