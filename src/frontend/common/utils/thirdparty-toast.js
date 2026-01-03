/**
 * 第三方 Toast 适配器（iziToast）
 * - 统一右上角位置
 * - 提供 pending（可编程关闭）、success、error 能力
 * - 内部基于 request_id 映射 DOM 句柄，方便关闭
 */

import iziToast from "izitoast";
import "izitoast/dist/css/iziToast.min.css";

// 简单内存映射：request_id -> toast DOM（第三方或降级DOM）
const pendingMap = new Map();

// 统一日志（避免与 logger.js 形成循环依赖，这里使用轻量控制台封装）
const gConsole = (typeof globalThis !== "undefined" && globalThis.console) ? globalThis.console : null;
const tpLogger = {
  info: (...args) => { try { const c = gConsole; if (c && c.info) { c.info("[ThirdpartyToast][INFO]", ...args); } else if (c && c.log) { c.log("[ThirdpartyToast][INFO]", ...args); } } catch (e) { void e; /* logger-guard */ } },
  warn: (...args) => { try { const c = gConsole; if (c && c.warn) { c.warn("[ThirdpartyToast][WARN]", ...args); } else if (c && c.log) { c.log("[ThirdpartyToast][WARN]", ...args); } } catch (e) { void e; /* logger-guard */ } },
  error: (...args) => { try { const c = gConsole; if (c && c.error) { c.error("[ThirdpartyToast][ERROR]", ...args); } else if (c && c.log) { c.log("[ThirdpartyToast][ERROR]", ...args); } } catch (e) { void e; /* logger-guard */ } },
};
try {
  const has = !!iziToast;
  const keys = has ? Object.keys(iziToast || {}) : [];
  tpLogger.info("iziToast import status", { has, keys, fallbackDisabled: true });
} catch (e) { void e; /* logger-guard */ }

// 调试/验证开关：禁用 fallback 渲染，仅允许 iziToast 路径
// 目的：验证“当前是否真的走到了 izitoast”，如禁用后仍看到 toast，则说明来源非本模块
const DISABLE_TOAST_FALLBACK = true;
function fallbackDisabled() {
  try {
    // 允许用全局变量在运行时覆盖：window.__DISABLE_TOAST_FALLBACK === true|false
    if (typeof window !== "undefined" && "__DISABLE_TOAST_FALLBACK" in window) {
      return Boolean(window.__DISABLE_TOAST_FALLBACK);
    }
  } catch (e) { void e; /* logger-guard */ }
  return DISABLE_TOAST_FALLBACK;
}

// ---- 降级渲染（当第三方库不可用或抛错时）----
function fallbackContainer() {
  if (fallbackDisabled()) {
    return null;
  }
  let c = document.getElementById("fallback-toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "fallback-toast-container";
    c.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:16px",
      "z-index:2147483647",
      "pointer-events:none",
      "display:flex",
      "flex-direction:column",
      "align-items:flex-end",  // 确保子元素右对齐
      "gap:8px",
    ].join(";");
    document.body.appendChild(c);
  }
  return c;
}

function fallbackToast(message, { background = "#323232", color = "#fff", ms = 3000 } = {}) {
  if (fallbackDisabled()) {
    return null;
  }
  try {
    const c = fallbackContainer();
    if (!c) { return null; }
    const el = document.createElement("div");
    el.textContent = String(message || "");
    el.style.cssText = [
      "pointer-events:auto",
      "min-width:160px",
      "max-width:360px",
      "padding:10px 14px",
      "border-radius:6px",
      "box-shadow:0 4px 12px rgba(0,0,0,0.2)",
      `background:${background}`,
      `color:${color}`,
      "font-size:13px",
      "line-height:1.4",
      "opacity:0",
      "transform:translateY(-6px)",
      "transition:opacity .15s ease, transform .15s ease",
    ].join(";");
    c.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    const t = setTimeout(() => {
      try {
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => el.remove(), 180);
      } catch (e) { void e; /* logger-guard */ }
    }, ms === 0 ? 3000 : ms);
    return { el, timer: t };
  } catch {
    return null;
  }
}

// 为 QtWebEngine 等环境提供稳定的挂载点，避免目标为空导致的 style 访问报错
// 返回“DOM 元素”而不是选择器字符串，以避免第三方库基于 querySelector 返回 null 后访问 style 报错
const TARGET_SELECTOR = "#izi-toast-root";
function ensureIziTarget() {
  try {
    // 确保 document.body 已就绪
    if (!document.body) {
      // 文档未就绪时直接使用降级渲染
      return undefined;
    }

    let c = document.getElementById("izi-toast-root");
    if (!c) {
      c = document.createElement("div");
      c.id = "izi-toast-root";
      c.style.cssText = [
        "position:fixed",
        "top:16px",
        "right:16px",
        "z-index:2147483647",
        // 重要：容器必须允许指针事件，否则子元素（由 iziToast 注入）无法接收 hover/click，
        // 导致“悬停暂停”与关闭按钮失效，看起来像“没有 hover 暂停”的回归。
        "pointer-events:auto",
        "display:flex",
        "flex-direction:column",
        "align-items:flex-end",  // 确保子元素右对齐
        "gap:8px",
        "max-width:400px",       // 限制最大宽度
      ].join(";");
      document.body.appendChild(c);

      // 强制浏览器重排，确保元素已完全挂载
      void c.offsetHeight;
    }

    // 验证容器仍然存在于 DOM 中
    const verify = document.getElementById("izi-toast-root");
    if (!verify) {
      return undefined; // 验证失败时走降级渲染
    }

    // 返回选择器字符串，确保第三方内部按预期 querySelector
    return TARGET_SELECTOR;
  } catch {
    // 保守回退
    return undefined;
  }
}

/**
 * 显示"进行中"粘性提示
 * @param {string} id - 业务侧自定义ID（建议使用 request_id）
 * @param {string} message - 显示文案
 * @returns {string} 返回 id，便于链路统一
 */
export function pending(id, message = "进行中", timeoutMs = 0) {
  const targetEl = ensureIziTarget();

  // 如果容器创建失败：在“禁用 fallback”模式下直接不显示，仅登记占位
  if (!targetEl) {
    tpLogger.warn("ensureIziTarget() failed (pending) - no container", { id });
    if (!fallbackDisabled()) {
      const fb = fallbackToast(message, { background: "#2b6cb0", color: "#fff", ms: 5000 });
      if (fb && fb.el) {
        pendingMap.set(id, fb.el);
      }
    }
    return id;
  }

  try {
    iziToast.info({
      message,
      position: "topRight",
      target: TARGET_SELECTOR,
      // timeout: 0/false 表示不自动关闭
      timeout: (timeoutMs === 0 ? false : timeoutMs),
      close: true,
      maxWidth: 400,
      transitionIn: "fadeInLeft",
      // 捕获 DOM 句柄，供后续关闭
      onOpening: (_instance, toast) => {
        pendingMap.set(id, toast);
      }
    });
  } catch (e) {
    tpLogger.warn("iziToast.info failed (pending), will fallback if enabled", { id, error: e?.message });
    // 降级渲染（静默）——若未禁用
    if (!fallbackDisabled()) {
      const fb = fallbackToast(message, { background: "#2b6cb0", color: "#fff", ms: 5000 });
      if (fb && fb.el) {
        pendingMap.set(id, fb.el);
      }
    }
  }
  return id;
}

/**
 * 成功提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 3000ms）
 */
export function success(message, ms = 3000) {
  const targetEl = ensureIziTarget();

  // 如果容器创建失败：禁用 fallback 时不显示
  if (!targetEl) {
    tpLogger.warn("ensureIziTarget() failed (success) - no container");
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#2f855a", color: "#fff", ms }); }
    return;
  }

  try {
    iziToast.success({
      message,
      position: "topRight",
      target: TARGET_SELECTOR,
      timeout: ms,
      close: true,
      maxWidth: 400,  // 强制限制最大宽度
      transitionIn: "fadeInLeft"  // 从左侧滑入，更符合右对齐
    });
  } catch (e) {
    tpLogger.warn("iziToast.success failed", { error: e?.message });
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#2f855a", color: "#fff", ms }); }
  }
}

/**
 * 信息提示（info）
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 3000ms）
 */
export function info(message, ms = 3000) {
  const targetEl = ensureIziTarget();

  // 如果容器创建失败：禁用 fallback 时不显示
  if (!targetEl) {
    tpLogger.warn("ensureIziTarget() failed (info) - no container");
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#2b6cb0", color: "#fff", ms }); }
    return;
  }

  try {
    iziToast.info({
      message,
      position: "topRight",
      target: TARGET_SELECTOR,
      timeout: ms,
      close: true,
      maxWidth: 400,
      transitionIn: "fadeInLeft"
    });
  } catch (e) {
    tpLogger.warn("iziToast.info failed", { error: e?.message });
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#2b6cb0", color: "#fff", ms }); }
  }
}

/**
 * 警告提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 4000ms）
 */
export function warning(message, ms = 4000) {
  const targetEl = ensureIziTarget();

  // 如果容器创建失败：禁用 fallback 时不显示
  if (!targetEl) {
    tpLogger.warn("ensureIziTarget() failed (warning) - no container");
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#b7791f", color: "#fff", ms }); }
    return;
  }

  try {
    iziToast.warning({
      message,
      position: "topRight",
      target: TARGET_SELECTOR,
      timeout: ms,
      close: true,
      maxWidth: 400,
      transitionIn: "fadeInLeft"
    });
  } catch (e) {
    tpLogger.warn("iziToast.warning failed", { error: e?.message });
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#b7791f", color: "#fff", ms }); }
  }
}

/**
 * 错误提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 5000ms）
 */
export function error(message, ms = 5000) {
  const targetEl = ensureIziTarget();

  // 如果容器创建失败：禁用 fallback 时不显示
  if (!targetEl) {
    tpLogger.warn("ensureIziTarget() failed (error) - no container");
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#c53030", color: "#fff", ms }); }
    return;
  }

  try {
    iziToast.error({
      message,
      position: "topRight",
      target: TARGET_SELECTOR,
      timeout: ms,
      close: true,
      maxWidth: 400,
      transitionIn: "fadeInLeft"
    });
  } catch (e) {
    tpLogger.warn("iziToast.error failed", { error: e?.message });
    if (!fallbackDisabled()) { fallbackToast(message, { background: "#c53030", color: "#fff", ms }); }
  }
}

/**
 * 关闭通过 pending(id) 创建的进行中提示
 * @param {string} id - pending 时的 id（通常是 request_id）
 * @returns {boolean}
 */
export function dismissById(id) {
  const toast = pendingMap.get(id);
  if (!toast) {return false;}
  try {
    // 尝试第三方关闭
    try { iziToast.hide({}, toast); } catch (e) { void e; /* logger-guard */ }
    // 若是降级DOM，直接移除
    if (toast && toast.parentElement) {
      toast.remove();
    }
  } catch {
    // 容忍关闭异常
  } finally {
    pendingMap.delete(id);
  }
  return true;
}

export default { pending, success, info, warning, error, dismissById };
