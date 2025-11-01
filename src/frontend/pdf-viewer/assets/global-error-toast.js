// 全局错误 → toast 展示（尽量早加载）
// - 依赖第三方 toast 适配器；若失败则使用最小降级 UI
// - 提供简单去抖与速率限制，避免错误风暴

import { showError } from "../../common/utils/notification.js";

const STATE = {
  lastText: null,
  lastTime: 0,
  countInWindow: 0,
  windowStart: 0
};

const DEDUP_WINDOW_MS = 1500;       // 相同文案 1.5s 内去重
const RATE_WINDOW_MS = 3000;        // 速率窗口 3s
const RATE_MAX_TOAST = 4;           // 每个窗口最多 4 条

function now() { return Date.now(); }

function fallbackToast(text) {
  try {
    let c = document.getElementById("fallback-toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "fallback-toast-container";
      c.style.cssText = [
        "position:fixed","top:16px","right:16px","z-index:2147483647",
        "pointer-events:none","display:flex","flex-direction:column",
        "align-items:flex-end","gap:8px","max-width:400px"
      ].join(";");
      document.body && document.body.appendChild(c);
    }
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = [
      "pointer-events:auto","min-width:160px","max-width:360px",
      "padding:10px 14px","border-radius:6px","box-shadow:0 4px 12px rgba(0,0,0,.2)",
      "background:#c53030","color:#fff","font-size:13px","line-height:1.4",
      "opacity:0","transform:translateY(-6px)","transition:opacity .15s ease, transform .15s ease"
    ].join(";");
    c.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => {
      try { el.style.opacity = "0"; el.style.transform = "translateY(-6px)"; setTimeout(() => el.remove(), 180); } catch(_) {}
    }, 6000);
  } catch(_) {}
}

function showToast(text) {
  try { showError(text, 6000); }
  catch(_) { fallbackToast(text); }
}

function shouldToast(text) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (window.localStorage.getItem("GLOBAL_ERROR_TOAST_DISABLED") === "true") {
        return false;
      }
    }
  } catch(_) {}

  const t = now();
  // 去重
  if (STATE.lastText === text && (t - STATE.lastTime) <= DEDUP_WINDOW_MS) {
    return false;
  }
  STATE.lastText = text;
  STATE.lastTime = t;

  // 速率限制
  if ((t - STATE.windowStart) > RATE_WINDOW_MS) {
    STATE.windowStart = t;
    STATE.countInWindow = 0;
  }
  if (STATE.countInWindow >= RATE_MAX_TOAST) {
    return false;
  }
  STATE.countInWindow++;
  return true;
}

function formatOnError(ev) {
  const filename = ev?.filename ? String(ev.filename).split(/[\\/]/).pop() : "unknown";
  const line = ev?.lineno ?? "?";
  const col = ev?.colno ?? "?";
  const msg = ev?.message || "Uncaught Error";
  return `[前端错误] ${msg} @ ${filename}:${line}:${col}`;
}

function formatOnRejection(ev) {
  let msg = "Unhandled Promise Rejection";
  const r = ev?.reason;
  if (r) {
    if (typeof r === "string") {msg = r;}
    else if (r && typeof r === "object") {msg = r.message || (r.toString ? r.toString() : msg);}
  }
  return `[前端异常] ${msg}`;
}

window.addEventListener("error", (e) => {
  try {
    const text = formatOnError(e);
    // 控制台保留
    console.error("[GlobalErrorToast]", text, e?.error?.stack || "");
    if (shouldToast(text)) {showToast(text);}
  } catch(_) {}
}, true);

window.addEventListener("unhandledrejection", (e) => {
  try {
    const text = formatOnRejection(e);
    console.error("[GlobalErrorToast]", text, e?.reason?.stack || "");
    if (shouldToast(text)) {showToast(text);}
  } catch(_) {}
}, true);
