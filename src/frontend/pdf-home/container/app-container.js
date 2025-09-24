import Logger from '../../common/utils/logger.js';
import { WEBSOCKET_MESSAGE_EVENTS } from '../../common/event/event-constants.js';
import eventBusSingleton from '../../common/event/event-bus.js';
import WSClient from '../../common/ws/ws-client.js';
// utf-8
// pdf-home container: uses common EventBus, WSClient, and Logger

export function createPDFHomeContainer({ root, wsUrl, logger } = {}) {
  const log = logger || new Logger('pdf-home.container');
  const state = {
    root: resolveRoot(root),
    wsUrl: wsUrl || buildWsUrlFromQuery(),
    disposed: false,
  };

  let uiManager = null;
  let eventBus = null;
  let wsClient = null;

  function connect() {
    if (state.disposed) return;
    try {
      if (!state.wsUrl) state.wsUrl = buildWsUrlFromQuery();
      log.info(`[pdf-home] connecting WS: ${state.wsUrl}`);
      ensureInfra();
      wsClient = new WSClient(state.wsUrl, eventBus);
      wsClient.connect();
      // initial data
      requestList();
    } catch (e) {
      log.warn('[pdf-home] connect failed', e);
    }
  }

  function disconnect() {
    try { wsClient?.disconnect?.(); } catch {}
  }

  function dispose() {
    state.disposed = true;
    disconnect();
    try { uiManager?.dispose?.(); } catch {}
    uiManager = null;
  }

  function reloadData() { requestList(); }

  // mount UI and bridge events
  ensureUI();
  ensureEventBridges();

  return { connect, disconnect, reloadData, dispose };

  // ---------------- helpers ----------------
  function ensureUI() {
    if (uiManager) return;
    import('../ui-manager.js').then((mod) => {
      const UIManager = mod.UIManager || mod.default;
      uiManager = new UIManager({ root: state.root, logger: log, send });
      uiManager.on?.('action:open-pdf', (payload) => send({ type: 'pdf/open', payload }));
      uiManager.on?.('action:remove-pdf', (payload) => send({ type: 'pdf/remove', payload }));
      uiManager.on?.('action:refresh', () => requestList());
    }).catch((e) => log.warn('UI manager load failed', e));
  }

  function ensureInfra() {
    if (!eventBus) eventBus = eventBusSingleton; // shared singleton
  }

  function ensureEventBridges() {
    ensureInfra();
    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, (message) => {
      try { uiManager?.setData?.(Array.isArray(message.data?.items) ? message.data.items : []); } catch {}
    }, { subscriberId: 'pdf-home.container' });

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, (message) => {
      try { uiManager?.setData?.(Array.isArray(message.data?.items) ? message.data.items : []); } catch {}
    }, { subscriberId: 'pdf-home.container' });

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (message) => {
      try { uiManager?.notify?.({ level: 'info', message: message?.data?.message || 'OK' }); } catch {}
    }, { subscriberId: 'pdf-home.container' });

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => {
      try { uiManager?.notify?.({ level: 'error', message: message?.data?.message || '操作失败' }); } catch {}
    }, { subscriberId: 'pdf-home.container' });
  }

  function requestList() { send({ type: 'pdf/list', data: {} }); }

  function send(msg) {
    try { wsClient?.send?.({ type: msg.type, data: msg.payload || msg.data || {} }); } catch (e) { log.warn('send failed', e); }
  }
}

function resolveRoot(root) {
  if (root instanceof HTMLElement) return root;
  if (typeof root === 'string') return document.querySelector(root);
  return document.getElementById('app') || document.body;
}

function buildWsUrlFromQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const wsPort = params.get('ws') || '8765';
    const host = location.hostname || '127.0.0.1';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host}:${wsPort}/`;
  } catch { return null; }
}
