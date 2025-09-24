/* global __WS_SERVER_LOG_PATH__ */
/**
 * @file WebSocket端口解析工具
 * @description 从 ws-server.log 中解析 WebSocket 服务端口，供 pdf-home 模块复用
 */

const DEFAULT_WS_PORT = 8765;
const LOG_PATH = typeof __WS_SERVER_LOG_PATH__ !== "undefined" ? __WS_SERVER_LOG_PATH__ : null;

/**
 * 从 ws-server.log 解析 WebSocket 端口。
 * @param {object} [options]
 * @param {object} [options.logger] - 可选 logger，用于输出诊断信息
 * @param {number} [options.fallbackPort=DEFAULT_WS_PORT] - 解析失败时的默认端口
 * @returns {Promise<number>} 解析得到的端口号
 */

function getQueryParam(name) {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || params.get(name.replace(/_/g, '-')) || params.get(name.replace(/-/g, '_'));
}

export function resolvePDFServerPortSync({ logger, fallbackPort = 8080 } = {}) {
  const activeLogger = logger && typeof logger === "object" ? logger : null;
  const fromQuery = getQueryParam('pdf_port') || getQueryParam('pdfs') || getQueryParam('pdf');
  if (fromQuery) {
    const portNum = parseInt(fromQuery, 10);
    if (Number.isInteger(portNum) && portNum > 0 && portNum < 65536) {
      activeLogger?.info?.(`Resolved PDF server port from query: ${portNum}`);
      return portNum;
    }
  }
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.pdf_server_port) {
    const portNum = parseInt(window.RUNTIME_CONFIG.pdf_server_port, 10);
    if (Number.isInteger(portNum) && portNum > 0 && portNum < 65536) {
      activeLogger?.info?.(`Resolved PDF server port from runtime config: ${portNum}`);
      return portNum;
    }
  }
  return fallbackPort;
}

export function resolveWebSocketPortSync({ logger, fallbackPort = DEFAULT_WS_PORT } = {}) {
  const activeLogger = logger && typeof logger === "object" ? logger : null;
  const fromQuery = getQueryParam('ws_port') || getQueryParam('ws');
  if (fromQuery) {
    const portNum = parseInt(fromQuery, 10);
    if (Number.isInteger(portNum) && portNum > 0 && portNum < 65536) {
      activeLogger?.info?.(`Resolved WebSocket port from query: ${portNum}`);
      return portNum;
    }
  }
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.ws_port) {
    const portNum = parseInt(window.RUNTIME_CONFIG.ws_port, 10);
    if (Number.isInteger(portNum) && portNum > 0 && portNum < 65536) {
      activeLogger?.info?.(`Resolved WebSocket port from runtime config: ${portNum}`);
      return portNum;
    }
  }
  return fallbackPort;
}

export async function resolveWebSocketPort({ logger, fallbackPort = DEFAULT_WS_PORT } = {}) {
  // 优先从查询参数/运行时注入中解析（生产环境可靠）
  try {
    const immediate = resolveWebSocketPortSync({ logger, fallbackPort: NaN });
    if (Number.isInteger(immediate) && immediate > 0 && immediate < 65536) {
      return immediate;
    }
  } catch (e) { /* ignore and fallback to log-based in dev */ }

  const activeLogger = logger && typeof logger === "object" ? logger : null;
  const safeFallback = Number.isInteger(fallbackPort) ? fallbackPort : DEFAULT_WS_PORT;

  if (import.meta.env.PROD || !LOG_PATH) {
    activeLogger?.debug?.("WebSocket port resolver fallback: production mode or log path missing");
    return safeFallback;
  }

  const encodedPath = encodeURI(LOG_PATH);
  const logUrl = `/@fs/${encodedPath}`;

  try {
    const response = await fetch(logUrl, { cache: "no-store" });
    if (!response.ok) {
      activeLogger?.warn?.(`Failed to fetch ws-server.log (status ${response.status})`, { logUrl });
      return safeFallback;
    }

    const content = await response.text();
    const matches = [...content.matchAll(/ws:\/\/[\w-.]+:(\d+)/gi)];
    if (!matches.length) {
      activeLogger?.warn?.("No WebSocket port entry found in ws-server.log");
      return safeFallback;
    }

    const [, lastPort] = matches[matches.length - 1];
    const parsedPort = parseInt(lastPort, 10);

    if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
      activeLogger?.info?.(`Resolved WebSocket port from log: ${parsedPort}`);
      return parsedPort;
    }

    activeLogger?.warn?.("Parsed WebSocket port invalid, falling back", { lastPort });
    return safeFallback;
  } catch (error) {
    activeLogger?.warn?.("Error while resolving WebSocket port from log", { error: error?.message || error });
    return safeFallback;
  }
}

export { DEFAULT_WS_PORT };
