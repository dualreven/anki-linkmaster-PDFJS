/**
 * 防抖工具函数
 * @file features/search/utils/debounce.js
 * @description 提供防抖功能，用于搜索输入框的性能优化
 */

/**
 * 防抖函数
 * 延迟执行函数，直到调用停止一段时间后才执行
 *
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行（首次触发时）
 * @returns {Function} 防抖后的函数
 *
 * @example
 * const debouncedSearch = debounce((query) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * // 用户快速输入时，只会在停止输入300ms后才执行一次
 * debouncedSearch('a');
 * debouncedSearch('ab');
 * debouncedSearch('abc'); // 只有这次会真正执行
 */
export function debounce(func, wait = 300, immediate = false) {
  let timeout;

  return function debounced(...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

/**
 * 节流函数
 * 限制函数在指定时间内最多执行一次
 *
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolling...');
 * }, 100);
 *
 * // 即使滚动事件频繁触发，每100ms最多执行一次
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, limit = 100) {
  let inThrottle;

  return function throttled(...args) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
