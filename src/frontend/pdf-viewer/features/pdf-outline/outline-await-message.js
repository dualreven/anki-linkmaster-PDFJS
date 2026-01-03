import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";

export function awaitOutlineWsMessage({ eventBus, types, subscriberId }) {
  if (!eventBus) {
    throw new Error("[OutlineAwait] eventBus is required");
  }
  if (!Array.isArray(types) || types.length === 0) {
    throw new Error("[OutlineAwait] types must be a non-empty array");
  }
  const allow = new Set(types);
  const sid = subscriberId || "OutlineFeature.await";

  return new Promise((resolve) => {
    const unsub = eventBus.onGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
      const t = String(message?.type || "");
      if (!allow.has(t)) { return; }
      try { unsub(); } catch (e) { void e; /* logger-guard */ }
      resolve(message);
    }, { subscriberId: sid });
  });
}

