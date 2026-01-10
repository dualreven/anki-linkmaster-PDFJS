import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

/**
 * 等待 Outline 领域事件（不依赖 WEBSOCKET_EVENTS）。
 *
 * @param {Object} params
 * @param {any} params.eventBus - scoped/global eventBus（需支持 onGlobal 或 on）
 * @param {Array<string>} params.types - 允许的事件名集合（例如 OUTLINE.LOAD.SUCCESS/EMPTY/FAILED）
 * @param {string} [params.subscriberId]
 * @returns {Promise<{ eventName: string, data: any }>}
 */
export function awaitOutlineDomainEvent({ eventBus, types, subscriberId }) {
  if (!eventBus) {
    throw new Error("[OutlineAwait] eventBus is required");
  }
  if (!Array.isArray(types) || types.length === 0) {
    throw new Error("[OutlineAwait] types must be a non-empty array");
  }
  const allow = new Set(types);
  const sid = subscriberId || "OutlineFeature.await";

  return new Promise((resolve) => {
    const on = typeof eventBus.onGlobal === "function" ? eventBus.onGlobal.bind(eventBus) : eventBus.on.bind(eventBus);
    const unsubs = [];

    const handlerFactory = (eventName) => (data) => {
      try {
        unsubs.forEach((u) => { try { u?.(); } catch (e) { void e; /* logger-guard */ } });
      } catch (e) { void e; /* logger-guard */ }
      resolve({ eventName, data });
    };

    for (const eventName of allow) {
      if (typeof eventName !== "string" || !eventName) { continue; }
      unsubs.push(on(eventName, handlerFactory(eventName), { subscriberId: sid }));
    }
  });
}

export const OUTLINE_DOMAIN_EVENTS = {
  LOAD_SUCCESS: PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
  LOAD_EMPTY: PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY,
  LOAD_FAILED: PDF_VIEWER_EVENTS.OUTLINE.LOAD.FAILED,
};
