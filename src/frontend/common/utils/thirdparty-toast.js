/**
 * 第三方 Toast 适配器（iziToast）
 * - 统一右上角位置
 * - 提供 pending（可编程关闭）、success、error 能力
 * - 内部基于 request_id 映射 DOM 句柄，方便关闭
 */

import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';

// 简单内存映射：request_id -> toast DOM（第三方或降级DOM）
const pendingMap = new Map();

// ---- 降级渲染（当第三方库不可用或抛错时）----
function fallbackContainer() {
  let c = document.getElementById('fallback-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'fallback-toast-container';
    c.style.cssText = [
      'position:fixed',
      'top:16px',
      'right:16px',
      'z-index:2147483647',
      'pointer-events:none',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
    ].join(';');
    document.body.appendChild(c);
  }
  return c;
}

function fallbackToast(message, { background = '#323232', color = '#fff', ms = 3000 } = {}) {
  try {
    const c = fallbackContainer();
    const el = document.createElement('div');
    el.textContent = String(message || '');
    el.style.cssText = [
      'pointer-events:auto',
      'min-width:160px',
      'max-width:360px',
      'padding:10px 14px',
      'border-radius:6px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
      `background:${background}`,
      `color:${color}`,
      'font-size:13px',
      'line-height:1.4',
      'opacity:0',
      'transform:translateY(-6px)',
      'transition:opacity .15s ease, transform .15s ease',
    ].join(';');
    c.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    const t = setTimeout(() => {
      try {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => el.remove(), 180);
      } catch (_) {}
    }, ms === 0 ? 3000 : ms);
    return { el, timer: t };
  } catch (_) {
    return null;
  }
}

// 为 QtWebEngine 等环境提供稳定的挂载点，避免目标为空导致的 style 访问报错
function ensureIziTarget() {
  try {
    let c = document.getElementById('izi-toast-root');
    if (!c) {
      c = document.createElement('div');
      c.id = 'izi-toast-root';
      c.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:16px',
        'z-index:2147483647',
        'pointer-events:none',
        'display:flex',
        'flex-direction:column',
        'gap:8px',
      ].join(';');
      (document.body || document.documentElement).appendChild(c);
    }
    // 返回 CSS 选择器字符串，保证 iziToast 内部 querySelector 能正常解析
    return '#izi-toast-root';
  } catch (_) {
    return undefined;
  }
}

/**
 * 显示"进行中"粘性提示
 * @param {string} id - 业务侧自定义ID（建议使用 request_id）
 * @param {string} message - 显示文案
 * @returns {string} 返回 id，便于链路统一
 */
export function pending(id, message = '进行中', timeoutMs = 0) {
  try {
    iziToast.info({
      message,
      position: 'topRight',
      target: ensureIziTarget(),
      // timeout: 0/false 表示不自动关闭
      timeout: (timeoutMs === 0 ? false : timeoutMs),
      close: true,
      // 捕获 DOM 句柄，供后续关闭
      onOpening: (_instance, toast) => {
        pendingMap.set(id, toast);
      }
    });
  } catch (_) {
    // 降级渲染
    const fb = fallbackToast(message, { background: '#2b6cb0', color: '#fff', ms: 5000 });
    if (fb && fb.el) {
      pendingMap.set(id, fb.el);
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
  try {
    iziToast.success({ message, position: 'topRight', target: ensureIziTarget(), timeout: ms, close: true });
  } catch (_) {
    fallbackToast(message, { background: '#2f855a', color: '#fff', ms });
  }
}

/**
 * 信息提示（info）
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 3000ms）
 */
export function info(message, ms = 3000) {
  try {
    iziToast.info({ message, position: 'topRight', target: ensureIziTarget(), timeout: ms, close: true });
  } catch (_) {
    fallbackToast(message, { background: '#2b6cb0', color: '#fff', ms });
  }
}

/**
 * 警告提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 4000ms）
 */
export function warning(message, ms = 4000) {
  try {
    iziToast.warning({ message, position: 'topRight', target: ensureIziTarget(), timeout: ms, close: true });
  } catch (_) {
    fallbackToast(message, { background: '#b7791f', color: '#fff', ms });
  }
}

/**
 * 错误提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 5000ms）
 */
export function error(message, ms = 5000) {
  try {
    iziToast.error({ message, position: 'topRight', target: ensureIziTarget(), timeout: ms, close: true });
  } catch (_) {
    fallbackToast(message, { background: '#c53030', color: '#fff', ms });
  }
}

/**
 * 关闭通过 pending(id) 创建的进行中提示
 * @param {string} id - pending 时的 id（通常是 request_id）
 * @returns {boolean}
 */
export function dismissById(id) {
  const toast = pendingMap.get(id);
  if (!toast) return false;
  try {
    // 尝试第三方关闭
    try { iziToast.hide({}, toast); } catch (_) {}
    // 若是降级DOM，直接移除
    if (toast && toast.parentElement) {
      toast.remove();
    }
  } catch (_) {
    // 容忍关闭异常
  } finally {
    pendingMap.delete(id);
  }
  return true;
}

export default { pending, success, info, warning, error, dismissById };
