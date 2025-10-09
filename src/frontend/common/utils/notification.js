import { getLogger } from './logger.js';
import { getToastManager } from './toast-manager.js';
import { pending as iziPending, success as iziSuccess, warning as iziWarning, error as iziError, info as iziInfo, dismissById as iziDismissById } from './thirdparty-toast.js';

/**
 * @file 通知工具（可切换引擎：优先使用 iziToast，失败时回退内建 ToastManager）
 * @module Notification
 * @description 提供统一的 toast 提示：成功、错误、信息、隐藏全部
 */

const notificationLogger = getLogger('Notification');

// 内建 ToastManager 作为回退
const TM = getToastManager();
function toDuration(duration){ return typeof duration === 'number' ? duration : 3000; }

function getEngine() {
  try {
    // 允许通过全局开关切换：window.__NOTIFY_ENGINE in ('izi' | 'tm')
    const e = typeof window !== 'undefined' ? (window.__NOTIFY_ENGINE || 'izi') : 'izi';
    return (e === 'izi' || e === 'tm') ? e : 'izi';
  } catch(_) { return 'izi'; }
}

export function showInfoWithId(id, message, duration = 0) {
  try { dismissById(id); } catch(_) {}
  const engine = getEngine();
  if (engine === 'izi') {
    // 使用第三方 pending 作为可关闭的信息提示（可指定超时）
    try { return iziPending(id, String(message), toDuration(duration)); } catch (e) {
      notificationLogger.warn('iziToast pending failed, fallback to TM:', e?.message);
    }
  }
  // 回退到内建
  try { TM.show(String(message), { type: 'info', duration: toDuration(duration) }); return id; }
  catch(e){ notificationLogger.warn('ToastManager info(withId) failed:', e?.message); return id; }
}

export function dismissById(id) {
  const engine = getEngine();
  if (engine === 'izi') {
    try { return iziDismissById(id); } catch(_) { /* fallthrough */ }
  }
  try { return TM.dismiss(id); } catch(_) { return false; }
}

export function showSuccess(message, duration = 3000) {
  const engine = getEngine();
  if (engine === 'izi') {
    try { return void iziSuccess(String(message), toDuration(duration)); } catch(e) {
      notificationLogger.warn('iziToast success failed, fallback to TM:', e?.message);
    }
  }
  try { TM.show(String(message), { type: 'success', duration: toDuration(duration) }); }
  catch(e){ notificationLogger.warn('ToastManager success failed:', e?.message); }
}

export function showError(message, duration = 5000) {
  const engine = getEngine();
  if (engine === 'izi') {
    try { return void iziError(String(message), toDuration(duration)); } catch(e) {
      notificationLogger.warn('iziToast error failed, fallback to TM:', e?.message);
    }
  }
  try { TM.show(String(message), { type: 'error', duration: toDuration(duration) }); }
  catch(e){ notificationLogger.warn('ToastManager error failed:', e?.message); }
}

export function showInfo(message, duration = 3000) {
  const engine = getEngine();
  if (engine === 'izi') {
    try { return void iziInfo(String(message), toDuration(duration)); } catch(e) {
      notificationLogger.warn('iziToast info failed, fallback to TM:', e?.message);
    }
  }
  try { TM.show(String(message), { type: 'info', duration: toDuration(duration) }); }
  catch(e){ notificationLogger.warn('ToastManager info failed:', e?.message); }
}

export function hideAll() {
  const engine = getEngine();
  if (engine === 'izi') {
    try { /* 软清理：多数场景用不到 */ }
    catch(_) {}
  }
  notificationLogger.info('hideAll invoked');
}

