import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { removeFromPendingBuckets } from "./comment-tool-marker-restoration.js";

export function installCommentToolAnnotationEventListeners({
  eventBus,
  logger,
  ensureOverlayFor,
  commentMarker,
  pendingMarkersByPage
}) {
  if (!eventBus) {
    throw new Error("[CommentTool] eventBus is required");
  }

  const unsubs = [];

  const unsubCreated = eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.CREATED,
    (data) => {
      const { annotation } = data;
      logger.info(`📢 [Event] annotation:create:success received for ${annotation.id} (type: ${annotation.type})`);
      if (annotation.type !== "comment") {
        logger.debug("  ⏭️ Skipping non-comment annotation");
        return;
      }
      logger.info("  ✅ Comment annotation created successfully, rendering marker...");
      ensureOverlayFor(annotation);
    },
    { subscriberId: "CommentTool" }
  );
  if (typeof unsubCreated !== "function") {
    throw new Error("[CommentTool] eventBus.on must return an unsubscribe function");
  }
  unsubs.push(unsubCreated);

  const unsubDeleted = eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.DELETED,
    (data) => {
      const { id } = data;
      logger.info(`📢 [Event] annotation:delete:success received for ${id}`);
      try {
        commentMarker?.removeMarker?.(id);
        logger.info(`  ✅ Marker removed for deleted annotation: ${id}`);
      } catch (e) {
        logger.warn("[CommentTool] removeMarker failed", e);
      }
      try {
        removeFromPendingBuckets({ pendingMarkersByPage, annotationId: id });
      } catch (e) {
        void e; /* logger-guard */
      }
    },
    { subscriberId: "CommentTool" }
  );
  if (typeof unsubDeleted !== "function") {
    throw new Error("[CommentTool] eventBus.on must return an unsubscribe function");
  }
  unsubs.push(unsubDeleted);

  logger.info("✅ Annotation event listeners setup complete");
  return unsubs;
}

