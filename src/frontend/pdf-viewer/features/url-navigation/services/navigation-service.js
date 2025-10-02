/**
 * 导航服务
 * @module NavigationService
 * @description 负责执行PDF页面导航和位置滚动操作
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

/**
 * 导航服务类
 * @class NavigationService
 */
export class NavigationService {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('NavigationService');

  /** @type {EventBus} */
  #eventBus;

  /** @type {Object} 配置选项 */
  #options;

  /** @type {number|null} 当前PDF的总页数 */
  #totalPages = null;

  /** @type {boolean} 是否正在导航 */
  #isNavigating = false;

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线实例
   * @param {Object} [options={}] - 配置选项
   * @param {number} [options.navigationTimeout=5000] - 导航超时时间(ms)
   * @param {number} [options.scrollDuration=300] - 滚动动画持续时间(ms)
   */
  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#options = {
      navigationTimeout: options.navigationTimeout || 5000,
      scrollDuration: options.scrollDuration || 300,
    };

    this.#setupEventListeners();
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听总页数更新事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      ({ totalPages }) => {
        this.#totalPages = totalPages;
        this.#logger.debug(`总页数更新: ${totalPages}`);
      },
      { subscriberId: 'NavigationService' }
    );
  }

  /**
   * 执行导航到指定页面和位置
   * @param {Object} params - 导航参数
   * @param {number} params.pageAt - 目标页码（从1开始）
   * @param {number|null} [params.position=null] - 页面内位置百分比（0-100）
   * @returns {Promise<Object>} 导航结果
   * @returns {boolean} return.success - 是否成功
   * @returns {number} return.actualPage - 实际页码
   * @returns {number|null} return.actualPosition - 实际位置百分比
   * @returns {number} return.duration - 导航耗时(ms)
   * @returns {string} [return.error] - 错误信息（如果失败）
   *
   * @example
   * const result = await navigationService.navigateTo({ pageAt: 5, position: 50 });
   * // { success: true, actualPage: 5, actualPosition: 50, duration: 450 }
   */
  async navigateTo(params) {
    if (this.#isNavigating) {
      this.#logger.warn('已有导航正在进行中，忽略新的导航请求');
      return {
        success: false,
        error: '导航正在进行中',
      };
    }

    const startTime = performance.now();
    this.#isNavigating = true;

    try {
      const { pageAt, position = null } = params;

      // 1. 验证并标准化页码
      let actualPage = pageAt;
      if (this.#totalPages !== null) {
        if (pageAt > this.#totalPages) {
          this.#logger.warn(`请求页码 ${pageAt} 超出总页数 ${this.#totalPages}，跳转到最后一页`);
          actualPage = this.#totalPages;
        } else if (pageAt < 1) {
          this.#logger.warn(`请求页码 ${pageAt} < 1，跳转到第1页`);
          actualPage = 1;
        }
      }

      // 2. 触发页面跳转事件
      this.#logger.info(`开始导航到第 ${actualPage} 页`);
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
        { pageNumber: actualPage },
        { actorId: 'NavigationService' }
      );

      // 3. 等待页面渲染完成
      await this.#waitForPageReady(actualPage);

      // 4. 如果指定了position，执行滚动
      let actualPosition = null;
      if (position !== null) {
        actualPosition = await this.scrollToPosition(position);
      }

      const duration = Math.round(performance.now() - startTime);

      this.#logger.info(`导航完成: 页码=${actualPage}, 位置=${actualPosition}%, 耗时=${duration}ms`);

      return {
        success: true,
        actualPage,
        actualPosition,
        duration,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.#logger.error('导航失败:', error);

      return {
        success: false,
        error: error.message,
        duration,
      };
    } finally {
      this.#isNavigating = false;
    }
  }

  /**
   * 滚动到页面内指定位置百分比
   * @param {number} percentage - 位置百分比（0-100）
   * @returns {Promise<number>} 实际滚动到的百分比
   *
   * @example
   * const actualPosition = await navigationService.scrollToPosition(50);
   * // 50 (滚动到页面中间)
   */
  async scrollToPosition(percentage) {
    return new Promise((resolve) => {
      try {
        // 限制百分比在0-100之间
        const clampedPercentage = Math.max(0, Math.min(100, percentage));

        // 获取viewer容器
        const viewerContainer = document.getElementById('viewerContainer');
        if (!viewerContainer) {
          this.#logger.warn('未找到viewerContainer元素，跳过位置滚动');
          resolve(0);
          return;
        }

        // 获取当前显示的页面元素
        const currentPage = viewerContainer.querySelector('.page[data-loaded="true"]');
        if (!currentPage) {
          this.#logger.warn('未找到已加载的页面元素，跳过位置滚动');
          resolve(0);
          return;
        }

        // 计算目标滚动位置
        const pageHeight = currentPage.offsetHeight;
        const targetScrollTop = (pageHeight * clampedPercentage) / 100;

        this.#logger.debug(`滚动到位置: ${clampedPercentage}% (${targetScrollTop}px / ${pageHeight}px)`);

        // 使用平滑滚动
        this.#smoothScrollTo(viewerContainer, targetScrollTop, this.#options.scrollDuration)
          .then(() => {
            resolve(clampedPercentage);
          })
          .catch((error) => {
            this.#logger.error('滚动失败:', error);
            resolve(0);
          });
      } catch (error) {
        this.#logger.error('scrollToPosition错误:', error);
        resolve(0);
      }
    });
  }

  /**
   * 平滑滚动到指定位置
   * @param {HTMLElement} element - 滚动容器元素
   * @param {number} targetScrollTop - 目标滚动位置
   * @param {number} duration - 动画持续时间(ms)
   * @returns {Promise<void>}
   * @private
   */
  #smoothScrollTo(element, targetScrollTop, duration) {
    return new Promise((resolve) => {
      const startScrollTop = element.scrollTop;
      const distance = targetScrollTop - startScrollTop;
      const startTime = performance.now();

      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用easeInOutQuad缓动函数
        const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        element.scrollTop = startScrollTop + distance * easeProgress;

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animateScroll);
    });
  }

  /**
   * 等待页面渲染完成
   * @param {number} pageNumber - 页码
   * @returns {Promise<void>}
   * @private
   */
  #waitForPageReady(pageNumber) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#logger.warn(`等待页面 ${pageNumber} 渲染超时`);
        reject(new Error(`页面渲染超时: ${pageNumber}`));
      }, this.#options.navigationTimeout);

      // 监听页面变化事件
      const handlePageChanging = ({ pageNumber: currentPage }) => {
        if (currentPage === pageNumber) {
          clearTimeout(timeout);
          this.#eventBus.off(PDF_VIEWER_EVENTS.PAGE.CHANGING, handlePageChanging);

          // 等待一帧确保渲染完成
          requestAnimationFrame(() => {
            this.#logger.debug(`页面 ${pageNumber} 渲染完成`);
            resolve();
          });
        }
      };

      this.#eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, handlePageChanging, {
        subscriberId: 'NavigationService',
      });
    });
  }

  /**
   * 获取当前总页数
   * @returns {number|null} 总页数
   */
  getTotalPages() {
    return this.#totalPages;
  }

  /**
   * 清理资源
   */
  destroy() {
    this.#logger.info('NavigationService销毁');
    this.#totalPages = null;
    this.#isNavigating = false;
  }
}

export default NavigationService;
