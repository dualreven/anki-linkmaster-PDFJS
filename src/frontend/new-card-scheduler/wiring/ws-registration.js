import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";

function assertNonEmptyStringOrThrow(v, name) {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`${name} 必须为非空字符串`);
  }
}

function assertStringArrayNonEmptyOrThrow(arr, name) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`${name} 必须为非空数组`);
  }
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`${name}[${i}] 必须为非空字符串`);
    }
  }
}

function createRequestId() {
  return `ncs_reg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeErrorMessage(err) {
  if (!err) {
    return "";
  }
  if (typeof err === "string") {
    return err;
  }
  const msg = err?.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function buildRegisterPayloadOrThrow({ clientId }) {
  assertNonEmptyStringOrThrow(clientId, "clientId");
  const payload = {
    client_id: clientId,
    client_type: ["window:new-card-scheduler", "editable"],
    capabilities: ["card-planner"],
    metadata: { module: "new-card-scheduler" }
  };
  assertNonEmptyStringOrThrow(payload.client_id, "data.client_id");
  assertStringArrayNonEmptyOrThrow(payload.client_type, "data.client_type");
  return payload;
}

export function installWsRegistrationWiringOrThrow({
  eventBus,
  wsClient,
  clientId,
  timeoutMs = 2500,
  logger,
  notification,
  onStatus = null
}) {
  if (!eventBus) {
    throw new Error("installWsRegistrationWiringOrThrow: eventBus 必填");
  }
  if (!wsClient || typeof wsClient.send !== "function") {
    throw new Error("installWsRegistrationWiringOrThrow: wsClient.send 必填");
  }
  assertNonEmptyStringOrThrow(clientId, "clientId");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("installWsRegistrationWiringOrThrow: timeoutMs 必须为正数");
  }
  if (onStatus !== null && typeof onStatus !== "function") {
    throw new Error("installWsRegistrationWiringOrThrow: onStatus 必须为函数或 null");
  }

  const setStatus = (status, err = null) => {
    try { onStatus?.({ status, errorMessage: normalizeErrorMessage(err) }); } catch { /* ignore */ }
  };

  let inFlight = false;

  const registerOnceOrThrow = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    setStatus("registering", null);

    const rid = createRequestId();
    const data = buildRegisterPayloadOrThrow({ clientId });
    const msg = {
      type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
      request_id: rid,
      data
    };
    if ("to" in msg) {
      throw new Error("client:register:requested 禁止包含 to 字段");
    }

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { unsub(); } catch { /* ignore */ }
        reject(new Error("client:register 超时"));
      }, timeoutMs);

      const unsub = eventBus.on(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        (resp) => {
          const type = String(resp?.type || "");
          const respRid = resp?.request_id;
          if (respRid !== rid) {
            return;
          }
          if (type === WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED) {
            clearTimeout(timer);
            try { unsub(); } catch { /* ignore */ }
            resolve();
            return;
          }
          if (type === WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED) {
            clearTimeout(timer);
            try { unsub(); } catch { /* ignore */ }
            const err = resp?.error?.message || resp?.data?.message || "client:register 失败";
            reject(new Error(String(err)));
          }
        },
        { subscriberId: `NewCardScheduler.WsRegistration.${rid}` }
      );

      try {
        wsClient.send(msg);
      } catch (e) {
        clearTimeout(timer);
        try { unsub(); } catch { /* ignore */ }
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  };

  const onEstablished = async () => {
    try {
      await registerOnceOrThrow();
      setStatus("ok", null);
    } catch (e) {
      setStatus("failed", e);
      notification?.showError?.(`注册失败：${normalizeErrorMessage(e)}`, 3000);
      logger?.error?.("[NewCardScheduler] client register failed", e);
    } finally {
      inFlight = false;
    }
  };

  const onClosed = () => {
    inFlight = false;
    setStatus("unknown", null);
  };

  const unsubEstablished = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
    () => { void onEstablished(); },
    { subscriberId: "NewCardScheduler.WsRegistration.OnEstablished" }
  );
  const unsubClosed = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.CLOSED,
    onClosed,
    { subscriberId: "NewCardScheduler.WsRegistration.OnClosed" }
  );

  return () => {
    try { unsubEstablished?.(); } catch { /* ignore */ }
    try { unsubClosed?.(); } catch { /* ignore */ }
  };
}

