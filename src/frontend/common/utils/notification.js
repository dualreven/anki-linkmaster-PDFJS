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

