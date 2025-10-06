/**
 * 第三方 Toast 适配器（iziToast）
 * - 统一右上角位置
 * - 提供 pending（可编程关闭）、success、error 能力
 * - 内部基于 request_id 映射 DOM 句柄，方便关闭
 */

import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';

// 简单内存映射：request_id -> toast DOM
const pendingMap = new Map();

/**
 * 显示"进行中"粘性提示
 * @param {string} id - 业务侧自定义ID（建议使用 request_id）
 * @param {string} message - 显示文案
 * @returns {string} 返回 id，便于链路统一
 */
export function pending(id, message = '进行中') {
  try {
    iziToast.info({
      message,
      position: 'topRight',
      timeout: 5000, // 5秒自动关闭
      close: true,
      // 捕获 DOM 句柄，供后续关闭
      onOpening: (_instance, toast) => {
        pendingMap.set(id, toast);
      }
    });
  } catch (_) {
    // 忽略渲染异常，保持流程不中断
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
    iziToast.success({ message, position: 'topRight', timeout: ms, close: true });
  } catch (_) {}
}

/**
 * 警告提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 4000ms）
 */
export function warning(message, ms = 4000) {
  try {
    iziToast.warning({ message, position: 'topRight', timeout: ms, close: true });
  } catch (_) {}
}

/**
 * 错误提示
 * @param {string} message - 文案
 * @param {number} ms - 显示时长（默认 5000ms）
 */
export function error(message, ms = 5000) {
  try {
    iziToast.error({ message, position: 'topRight', timeout: ms, close: true });
  } catch (_) {}
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
    iziToast.hide({}, toast);
  } catch (_) {
    // 容忍关闭异常
  } finally {
    pendingMap.delete(id);
  }
  return true;
}

export default { pending, success, warning, error, dismissById };
