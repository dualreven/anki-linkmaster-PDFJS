/**
 * @file 通知工具
 * @module Notification
 * @description 提供页面内通知功能，使用现有的 global-success 和 global-error 元素
 */

/**
 * 显示成功消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒），默认3000ms，0表示不自动隐藏
 */
export function showSuccess(message, duration = 3000) {
  const element = document.getElementById('global-success');
  if (!element) {
    console.warn('Success notification element not found');
    return;
  }

  element.textContent = message;
  element.classList.add('show');

  if (duration > 0) {
    setTimeout(() => {
      element.classList.remove('show');
    }, duration);
  }
}

/**
 * 显示错误消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒），默认5000ms，0表示不自动隐藏
 */
export function showError(message, duration = 5000) {
  const element = document.getElementById('global-error');
  if (!element) {
    console.warn('Error notification element not found');
    return;
  }

  element.textContent = message;
  element.classList.add('show');

  if (duration > 0) {
    setTimeout(() => {
      element.classList.remove('show');
    }, duration);
  }
}

/**
 * 显示信息消息（使用成功样式但可自定义时长）
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒），默认3000ms
 */
export function showInfo(message, duration = 3000) {
  showSuccess(message, duration);
}

/**
 * 隐藏所有通知
 */
export function hideAll() {
  const successElement = document.getElementById('global-success');
  const errorElement = document.getElementById('global-error');

  if (successElement) successElement.classList.remove('show');
  if (errorElement) errorElement.classList.remove('show');
}
