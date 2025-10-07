import { getLogger } from './logger.js';
import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';

/**
 * @file 通知工具（使用三方库 iziToast）
 * @module Notification
 * @description 提供统一的 toast 提示：成功、错误、信息、隐藏全部
 */

const notificationLogger = getLogger('Notification');

// 统一默认设置（可按需调整）
try {
  iziToast.settings({
    position: 'topRight',
    close: true,
    progressBar: true,
    transitionIn: 'fadeInDown',
    transitionOut: 'fadeOutUp',
  });
} catch (e) {
  // 静默：避免运行环境缺库时阻断页面
  notificationLogger.warn('iziToast settings failed (non-fatal):', e);
}

function toTimeout(duration) {
  // duration=0 表示不自动关闭；iziToast 使用 false
  return duration === 0 ? false : duration;
}

// 记录 id -> toast DOM，便于仅关闭与当前业务相关的提示
const toastMap = new Map();
const toastShownAt = new Map();
const toastTimers = new Map();
const MIN_VISIBLE_MS = 1200; // 最短可见时长，避免“瞬间消失”的体验

export function showInfoWithId(id, message, duration = 0) {
  try {
    // 若已存在同ID的提示，先关闭，避免叠加残留
    try { dismissById(id); } catch (_) {}
    iziToast.info({
      message: String(message),
      timeout: toTimeout(duration),
      position: 'topRight',
      close: true,
      onOpening: (_instance, toast) => {
        try {
          toastMap.set(id, toast);
          toastShownAt.set(id, Date.now());
        } catch (_) {}
      },
      onClosing: (_instance, toast) => {
        try {
          const mapped = toastMap.get(id);
          if (mapped === toast) {
            toastMap.delete(id);
            toastShownAt.delete(id);
            const t = toastTimers.get(id);
            if (t) { clearTimeout(t); toastTimers.delete(id); }
          }
        } catch (_) {}
      }
    });
  } catch (e) {
    notificationLogger.warn('iziToast.info (withId) failed, message=', message, e);
  }
  return id;
}

export function dismissById(id) {
  const toast = toastMap.get(id);
  if (!toast) return false;
  try {
    const shownAt = toastShownAt.get(id) || 0;
    const elapsed = Date.now() - shownAt;
    if (elapsed < MIN_VISIBLE_MS) {
      // 保证最短可见时长后再关闭
      const wait = MIN_VISIBLE_MS - elapsed;
      const timer = setTimeout(() => {
        try { iziToast.hide({}, toast); } catch (e) { notificationLogger.warn('iziToast.hide (delay) failed:', e); }
        toastMap.delete(id);
        toastShownAt.delete(id);
        toastTimers.delete(id);
      }, wait);
      toastTimers.set(id, timer);
    } else {
      iziToast.hide({}, toast);
      toastMap.delete(id);
      toastShownAt.delete(id);
    }
  } catch (e) {
    notificationLogger.warn('iziToast.hide (byId) failed:', e);
    toastMap.delete(id);
    toastShownAt.delete(id);
  }
  return true;
}

export function showSuccess(message, duration = 3000) {
  try {
    iziToast.success({ message: String(message), timeout: toTimeout(duration) });
  } catch (e) {
    notificationLogger.warn('iziToast.success failed, message=', message, e);
  }
}

export function showError(message, duration = 5000) {
  try {
    iziToast.error({ message: String(message), timeout: toTimeout(duration) });
  } catch (e) {
    notificationLogger.warn('iziToast.error failed, message=', message, e);
  }
}

export function showInfo(message, duration = 3000) {
  try {
    iziToast.info({ message: String(message), timeout: toTimeout(duration) });
  } catch (e) {
    notificationLogger.warn('iziToast.info failed, message=', message, e);
  }
}

export function hideAll() {
  try {
    // 销毁所有 toast
    iziToast.destroy();
  } catch (e) {
    notificationLogger.warn('iziToast.destroy failed:', e);
  }
}

