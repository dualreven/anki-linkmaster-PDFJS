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

export const ANNO_META_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
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

function getAnnoMetaStatusLabelOrThrow(status) {
  const s = String(status || "");
  if (!Object.values(ANNO_META_STATUS).includes(s)) {
    throw new Error(`ANNO_META_STATUS 无效：${String(status)}`);
  }
  return s;
}

function validateMsgCenterStatusResponsePayloadOrThrow(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("MSG_CENTER.STATUS.RESPONSE payload 必须是对象");
  }

  const url = payload.url;
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("MSG_CENTER.STATUS.RESPONSE payload.url 必须为非空字符串");
  }

  const readyState = payload.readyState;
  if (readyState !== null && !Number.isFinite(readyState)) {
    throw new Error("MSG_CENTER.STATUS.RESPONSE payload.readyState 必须为 number 或 null");
  }

  const reconnectAttempts = payload.reconnectAttempts;
  if (!Number.isFinite(reconnectAttempts)) {
    throw new Error("MSG_CENTER.STATUS.RESPONSE payload.reconnectAttempts 必须为 number");
  }

  return {
    url: url.trim(),
    readyState,
    reconnectAttempts,
  };
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

  const selfCheckBtn = document.createElement("button");
  selfCheckBtn.type = "button";
  selfCheckBtn.setAttribute("data-testid", "ncs-ws-selfcheck");
  selfCheckBtn.textContent = "自检";
  selfCheckBtn.title = "请求 WSClient 状态（url/readyState/reconnectAttempts）";
  selfCheckBtn.style.fontSize = "12px";
  selfCheckBtn.style.padding = "0 6px";
  selfCheckBtn.style.border = "1px solid #ccc";
  selfCheckBtn.style.borderRadius = "4px";
  selfCheckBtn.style.background = "#fff";
  selfCheckBtn.style.cursor = "pointer";

  const line1 = document.createElement("div");
  const line2 = document.createElement("div");
  line2.style.maxWidth = "520px";
  line2.style.whiteSpace = "nowrap";
  line2.style.overflow = "hidden";
  line2.style.textOverflow = "ellipsis";

  wrap.appendChild(selfCheckBtn);
  wrap.appendChild(line1);
  wrap.appendChild(line2);
  toolbarEl.appendChild(wrap);

  const state = {
    status: WS_STATUS.DISCONNECTED,
    wsErrorMessage: "",
    regStatus: REG_STATUS.UNKNOWN,
    regErrorMessage: "",
    annoMetaStatus: ANNO_META_STATUS.IDLE,
    annoMetaRid: "",
    annoMetaErrorMessage: "",
    msgCenterStatusUrl: "",
    msgCenterReadyState: null,
    msgCenterReconnectAttempts: null,
  };

  const render = () => {
    const statusLabel = getWsStatusLabelOrThrow(state.status);
    const regLabel = getRegStatusLabelOrThrow(state.regStatus);
    const annoMetaLabel = getAnnoMetaStatusLabelOrThrow(state.annoMetaStatus);
    line1.textContent = `client_id=${clientId} | ws=${statusLabel} | reg=${regLabel} | anno_meta=${annoMetaLabel}`;

    const parts = [];
    if (state.wsErrorMessage) {
      parts.push(`ws_error=${state.wsErrorMessage}`);
    }
    if (state.regErrorMessage) {
      parts.push(`reg_error=${state.regErrorMessage}`);
    }
    if (state.annoMetaRid) {
      parts.push(`anno_rid=${state.annoMetaRid}`);
    }
    if (state.annoMetaErrorMessage) {
      parts.push(`anno_error=${state.annoMetaErrorMessage}`);
    }
    if (state.msgCenterStatusUrl) {
      parts.push(`ws_url=${state.msgCenterStatusUrl}`);
    }
    if (state.msgCenterReadyState !== null) {
      parts.push(`ws_readyState=${state.msgCenterReadyState}`);
    }
    if (state.msgCenterReconnectAttempts !== null) {
      parts.push(`ws_reconnectAttempts=${state.msgCenterReconnectAttempts}`);
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

  const setAnnoMetaStatus = ({ status, requestId = "", err = null }) => {
    const s = String(status || "");
    if (!Object.values(ANNO_META_STATUS).includes(s)) {
      throw new Error(`ANNO_META_STATUS 无效：${String(status)}`);
    }

    state.annoMetaStatus = s;
    state.annoMetaRid = typeof requestId === "string" ? requestId : String(requestId || "");
    state.annoMetaErrorMessage = normalizeErrorMessage(err);
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

  const onSelfCheckClick = () => {
    eventBus.emit(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST,
      { source: "NewCardScheduler.WsStatusPanel", client_id: clientId },
      { actorId: "NewCardScheduler.WsStatusPanel.SelfCheck" }
    );
  };
  selfCheckBtn.addEventListener("click", onSelfCheckClick);

  const unsubMsgCenterStatusResponse = eventBus.on(
    WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE,
    (payload) => {
      const p = validateMsgCenterStatusResponsePayloadOrThrow(payload);
      state.msgCenterStatusUrl = p.url;
      state.msgCenterReadyState = p.readyState;
      state.msgCenterReconnectAttempts = p.reconnectAttempts;
      render();
    },
    { subscriberId: "NewCardScheduler.WsStatus.MsgCenterStatusResponse" }
  );

  const initial = typeof wsClient.isConnected === "function" && wsClient.isConnected()
    ? WS_STATUS.CONNECTED
    : WS_STATUS.DISCONNECTED;
  setStatus(initial, null);
  setRegStatus(REG_STATUS.UNKNOWN, null);
  setAnnoMetaStatus({ status: ANNO_META_STATUS.IDLE, requestId: "", err: null });

  return {
    setConnecting: () => setStatus(WS_STATUS.CONNECTING, null),
    setDisconnected: () => setStatus(WS_STATUS.DISCONNECTED, null),
    setFailed: (err) => setStatus(WS_STATUS.FAILED, err),
    setRegUnknown: () => setRegStatus(REG_STATUS.UNKNOWN, null),
    setRegRegistering: () => setRegStatus(REG_STATUS.REGISTERING, null),
    setRegOk: () => setRegStatus(REG_STATUS.OK, null),
    setRegFailed: (err) => setRegStatus(REG_STATUS.FAILED, err),
    setAnnoMetaIdle: () => setAnnoMetaStatus({ status: ANNO_META_STATUS.IDLE, requestId: "", err: null }),
    setAnnoMetaLoading: (requestId) => setAnnoMetaStatus({ status: ANNO_META_STATUS.LOADING, requestId, err: null }),
    setAnnoMetaOk: (requestId) => setAnnoMetaStatus({ status: ANNO_META_STATUS.OK, requestId, err: null }),
    setAnnoMetaFailed: (requestId, err) => setAnnoMetaStatus({ status: ANNO_META_STATUS.FAILED, requestId, err }),
    destroy() {
      try { unsubEstablished?.(); } catch { /* ignore */ }
      try { unsubClosed?.(); } catch { /* ignore */ }
      try { unsubFailed?.(); } catch { /* ignore */ }
      try { unsubError?.(); } catch { /* ignore */ }
      try { unsubRegisterAck?.(); } catch { /* ignore */ }
      try { unsubMsgCenterStatusResponse?.(); } catch { /* ignore */ }
      try { selfCheckBtn.removeEventListener("click", onSelfCheckClick); } catch { /* ignore */ }
      try { wrap.remove(); } catch { /* ignore */ }
    }
  };
}
