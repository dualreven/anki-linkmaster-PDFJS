import eventBusSingleton, { EventBus } from '../../common/event/event-bus.js';
import WSClient from '../../common/ws/ws-client.js';
// utf-8
// pdf-home container: uses common EventBus and WSClient

export function createPDFHomeContainer({ root, wsUrl, logger } = {}) {
  const log = normalizeLogger(logger);
  const state = {
    root: resolveRoot(root),
    ws: null,
    wsUrl: wsUrl || buildWsUrlFromQuery(),
    connected: false,
    disposed: false,
  };

  // lazy imports to avoid cyclic costs at module parse
  let uiManager = null; let eventBus = null; let wsClient = null;

  function connect() {
    if (state.disposed) return;
    try {
      if (!wsClientUrl) wsClientUrl = buildWsUrlFromQuery();
      log.info(`[pdf-home] connecting WS: ${wsClientUrl}`);
      // use common WSClient bound to eventBus
      ensureInfra();
      wsClient = new WSClient(wsClientUrl, eventBus);
      wsClient.connect();
      });
    } catch (e) {
      log.warn('[pdf-home] connect failed', e);
    }
  }

  function disconnect() { try { wsClient?.disconnect?.(); } catch {} }\n    state.connected = false;
  }

  function dispose() {
    state.disposed = true;
    disconnect();
    try { uiManager?.dispose?.(); } catch {}
    uiManager = null;
  }

  function reloadData() { requestList(); }

  // UI init (mount) — called once on first use
  ensureUI();

  return { connect, disconnect, reloadData, dispose };

  // ---------------- helpers ----------------
  function ensureUI() {
    if (uiManager) return;
    try {
      // dynamic import local UI manager to avoid top-level dependency churn
      // eslint-disable-next-line no-undef
      const modPromise = import('../ui-manager.js');
      modPromise.then((mod) => {
        const UIManager = mod.UIManager || mod.default;
        uiManager = new UIManager({ root: state.root, logger: log, send });
        uiManager.on?.('action:open-pdf', (payload) => send({ type: 'pdf/open', payload }));
        uiManager.on?.('action:remove-pdf', (payload) => send({ type: 'pdf/remove', payload }));
        uiManager.on?.('action:refresh', () => requestList());
      }).catch((e) => log.warn('UI manager load failed', e));
    } catch (e) { log.warn('ensureUI failed', e); }
  }

  function requestList() { wsClient?.send?.({ type: 'pdf/list', data: {} }); }

  function send(msg) { try { wsClient?.send?.({ type: msg.type, data: msg.payload || msg.data || {} }); } catch (e) { log.warn('send failed', e); } }\n\n  function 
function resolveRoot(root) {
  if (root instanceof HTMLElement) return root;
  if (typeof root === 'string') return document.querySelector(root);
  return document.getElementById('app') || document.body;
}

function normalizeLogger(logger) {
  const l = logger || console;
  return {
    info: (...a) => l.info?.(...a) ?? l.log?.(...a),
    warn: (...a) => l.warn?.(...a) ?? l.log?.(...a),
    debug: (...a) => l.debug?.(...a) ?? l.log?.(...a),
    error: (...a) => l.error?.(...a) ?? l.log?.(...a),
    log: (...a) => l.log?.(...a),
  };
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

function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}



function ensureInfra() {
  if (!eventBus) eventBus = eventBusSingleton; // use shared singleton
}
