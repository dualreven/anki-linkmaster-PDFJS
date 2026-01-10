import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";

export const WS_STATUS = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  FAILED: "failed",
};

export const REG_STATUS = {
  UNKNOWN: "unknown",
  REGISTERING: "registering",
  OK: "ok",
  FAILED: "failed",
};

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

export function getWsStatusLabelOrThrow(status) {
  const s = String(status || "");
  if (!Object.values(WS_STATUS).includes(s)) {
    throw new Error(`WS_STATUS 无效：${String(status)}`);
  }
  if (s === WS_STATUS.CONNECTED) {
    return "connected";
  }
  if (s === WS_STATUS.CONNECTING) {
    return "connecting";
  }
  if (s === WS_STATUS.DISCONNECTED) {
    return "disconnected";
  }
  return "failed";
}

function getRegStatusLabelOrThrow(status) {
  const s = String(status || "");
  if (!Object.values(REG_STATUS).includes(s)) {
    throw new Error(`REG_STATUS 无效：${String(status)}`);
  }
  return s;
}

export function mountWsStatusPanelOrThrow({ toolbarEl, clientId, eventBus, wsClient }) {
  if (!toolbarEl) {
    throw new Error("mountWsStatusPanelOrThrow: toolbarEl 必填");
  }
  if (!eventBus) {
    throw new Error("mountWsStatusPanelOrThrow: eventBus 必填");
  }
  if (!wsClient) {
    throw new Error("mountWsStatusPanelOrThrow: wsClient 必填");
  }
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("mountWsStatusPanelOrThrow: clientId 必须为非空字符串");
  }

  const wrap = document.createElement("div");
  wrap.setAttribute("data-testid", "ncs-ws-status");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "flex-end";
  wrap.style.gap = "2px";
  wrap.style.marginLeft = "12px";
  wrap.style.fontSize = "12px";
  wrap.style.color = "#666";

  const line1 = document.createElement("div");
  const line2 = document.createElement("div");
  line2.style.maxWidth = "520px";
  line2.style.whiteSpace = "nowrap";
  line2.style.overflow = "hidden";
  line2.style.textOverflow = "ellipsis";

  wrap.appendChild(line1);
  wrap.appendChild(line2);
  toolbarEl.appendChild(wrap);

  const state = {
    status: WS_STATUS.DISCONNECTED,
    wsErrorMessage: "",
    regStatus: REG_STATUS.UNKNOWN,
    regErrorMessage: "",
  };

  const render = () => {
    const statusLabel = getWsStatusLabelOrThrow(state.status);
    const regLabel = getRegStatusLabelOrThrow(state.regStatus);
    line1.textContent = `client_id=${clientId} | ws=${statusLabel} | reg=${regLabel}`;

    const parts = [];
    if (state.wsErrorMessage) {
      parts.push(`ws_error=${state.wsErrorMessage}`);
    }
    if (state.regErrorMessage) {
      parts.push(`reg_error=${state.regErrorMessage}`);
    }
    line2.textContent = parts.join(" | ");
    line2.style.display = parts.length > 0 ? "block" : "none";
  };

  const setStatus = (status, err = null) => {
    state.status = status;
    state.wsErrorMessage = normalizeErrorMessage(err);
    render();
  };

  const setRegStatus = (regStatus, err = null) => {
    const s = String(regStatus || "");
    if (!Object.values(REG_STATUS).includes(s)) {
      throw new Error(`REG_STATUS 无效：${String(regStatus)}`);
    }
    state.regStatus = s;
    state.regErrorMessage = normalizeErrorMessage(err);
    render();
  };

  const unsubEstablished = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
    () => setStatus(WS_STATUS.CONNECTED, null),
    { subscriberId: "NewCardScheduler.WsStatus.Established" }
  );
  const unsubClosed = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.CLOSED,
    () => setStatus(WS_STATUS.DISCONNECTED, null),
    { subscriberId: "NewCardScheduler.WsStatus.Closed" }
  );
  const unsubFailed = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.FAILED,
    (error) => setStatus(WS_STATUS.FAILED, error),
    { subscriberId: "NewCardScheduler.WsStatus.Failed" }
  );
  const unsubError = eventBus.on(
    WEBSOCKET_EVENTS.CONNECTION.ERROR,
    (errorInfo) => setStatus(WS_STATUS.FAILED, errorInfo),
    { subscriberId: "NewCardScheduler.WsStatus.Error" }
  );

  const unsubRegisterAck = eventBus.on(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    (message) => {
      const type = String(message?.type || "");
      if (type !== WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED && type !== WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED) {
        return;
      }

      const msgClientId = message?.data?.client_id;
      if (typeof msgClientId === "string" && msgClientId.trim() && msgClientId.trim() !== clientId) {
        return;
      }

      if (type === WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED) {
        setRegStatus(REG_STATUS.OK, null);
        return;
      }

      const errMsg = message?.error?.message || message?.error || message?.data?.message || message?.data || message;
      setRegStatus(REG_STATUS.FAILED, errMsg);
    },
    { subscriberId: "NewCardScheduler.WsStatus.RegisterAck" }
  );

  const initial = typeof wsClient.isConnected === "function" && wsClient.isConnected()
    ? WS_STATUS.CONNECTED
    : WS_STATUS.DISCONNECTED;
  setStatus(initial, null);
  setRegStatus(REG_STATUS.UNKNOWN, null);

  return {
    setConnecting: () => setStatus(WS_STATUS.CONNECTING, null),
    setDisconnected: () => setStatus(WS_STATUS.DISCONNECTED, null),
    setFailed: (err) => setStatus(WS_STATUS.FAILED, err),
    setRegUnknown: () => setRegStatus(REG_STATUS.UNKNOWN, null),
    setRegRegistering: () => setRegStatus(REG_STATUS.REGISTERING, null),
    setRegOk: () => setRegStatus(REG_STATUS.OK, null),
    setRegFailed: (err) => setRegStatus(REG_STATUS.FAILED, err),
    destroy() {
      try { unsubEstablished?.(); } catch { /* ignore */ }
      try { unsubClosed?.(); } catch { /* ignore */ }
      try { unsubFailed?.(); } catch { /* ignore */ }
      try { unsubError?.(); } catch { /* ignore */ }
      try { unsubRegisterAck?.(); } catch { /* ignore */ }
      try { wrap.remove(); } catch { /* ignore */ }
    }
  };
}
