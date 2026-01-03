/**
 * WSClient 身份解析（纯逻辑）
 * @param {any} identityOptions
 * @param {{ logger?: any, location?: Location }} [deps]
 * @returns {{ client_name: string, client_id: string|null, module: string|null }}
 */
export function resolveWsClientIdentity(identityOptions, deps = {}) {
  const logger = deps?.logger;

  // 显式传入优先：允许调用方指定 client_name/client_id/module
  if (identityOptions && typeof identityOptions === "object") {
    const name = String(identityOptions.client_name || "").trim();
    const cid = (identityOptions.client_id !== null && identityOptions.client_id !== undefined)
      ? String(identityOptions.client_id).trim()
      : null;
    const mod = (identityOptions.module !== null && identityOptions.module !== undefined)
      ? String(identityOptions.module).trim()
      : null;
    if (name) {
      logger?.info?.(`[WSClient] 使用显式身份: ${name}:${cid || "none"} (module=${mod || "n/a"})`);
      return { client_name: name, client_id: cid, module: mod };
    }
  }

  // 浏览器环境下根据 URL 推断：pdf-viewer / pdf-home / 其他
  try {
    const loc = deps?.location || (typeof window !== "undefined" ? window.location : null);
    if (loc) {
      const pathname = String(loc.pathname || "");
      const params = new URLSearchParams(loc.search || "");
      const pdfId = (params.get("pdf-id") || params.get("pdf_id") || "").trim();

      if (pathname.includes("/pdf-viewer/")) {
        const name = pdfId ? `pdf-viewer-${pdfId}` : "pdf-viewer";
        const cid = pdfId || null;
        logger?.info?.(`[WSClient] 解析为 pdf-viewer 身份: ${name}:${cid || "none"}`);
        return { client_name: name, client_id: cid, module: "pdf-viewer" };
      }

      if (pathname.includes("/pdf-home/")) {
        const name = "pdf-home";
        // pdf-home 使用固定的 client_id（单例窗口，不可多开）
        const cid = "pdf-home";
        logger?.info?.(`[WSClient] 解析为 pdf-home 身份（固定ID）: ${name}:${cid}`);
        return { client_name: name, client_id: cid, module: "pdf-home" };
      }
    }
  } catch (e) {
    logger?.debug?.("[WSClient] 解析身份失败，使用默认身份", e);
  }

  // 通用 js-client
  const fallback = { client_name: "js-client", client_id: null, module: "generic" };
  logger?.info?.("[WSClient] 使用默认身份: js-client");
  return fallback;
}
