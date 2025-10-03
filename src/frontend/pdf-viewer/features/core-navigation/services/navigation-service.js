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

      // 3. 等待页面跳转完成（使用固定延迟而非事件监听，更可靠）
      await this.#waitForPageReady(actualPage);

      // 4. 如果指定了position，执行滚动
      let actualPosition = null;
      if (position !== null) {
        actualPosition = await this.scrollToPosition(position, actualPage);
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
   * @param {number} pageNumber - 目标页码(必填，由navigateTo方法提供)
   * @returns {Promise<number>} 实际滚动到的百分比
   *
   * @example
   * const actualPosition = await navigationService.scrollToPosition(50, 25);
   * // 50 (滚动到第25页的中间位置，并尽可能让目标位置显示在窗口中心)
   */
  async scrollToPosition(percentage, pageNumber) {
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

        // 获取目标页面元素(使用传入的pageNumber参数)
        const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
        if (!pageElement) {
          this.#logger.warn(`未找到页面 ${pageNumber} 的元素，跳过位置滚动`);
          resolve(0);
          return;
        }

        // 计算目标页面在文档中的绝对位置
        const pageOffsetTop = pageElement.offsetTop;
        const pageHeight = pageElement.offsetHeight;

        // 计算页面内的偏移量
        const offsetWithinPage = (pageHeight * clampedPercentage) / 100;

        // 目标位置在文档中的绝对Y坐标
        const targetPositionY = pageOffsetTop + offsetWithinPage;

        // 获取视口高度
        const viewportHeight = viewerContainer.clientHeight;

        // 计算滚动位置，让目标位置显示在视口中心
        // 理想情况：滚动位置 = 目标位置 - (视口高度 / 2)
        let targetScrollTop = targetPositionY - (viewportHeight / 2);

        // 边界处理：确保滚动位置在有效范围内
        const maxScrollTop = viewerContainer.scrollHeight - viewportHeight;
        const boundedScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

        // 计算实际居中偏移量（用于日志）
        const centerOffset = targetPositionY - boundedScrollTop - (viewportHeight / 2);
        const isCentered = Math.abs(centerOffset) < 1; // 允许1px误差

        this.#logger.debug(
          `滚动到页面 ${pageNumber} 的位置: ${clampedPercentage}%\n` +
          `  - 目标位置Y坐标: ${targetPositionY}px (页面顶部=${pageOffsetTop}px + 页面内偏移=${offsetWithinPage}px)\n` +
          `  - 视口高度: ${viewportHeight}px\n` +
          `  - 理想滚动位置: ${targetScrollTop.toFixed(0)}px (目标位置 - 视口高度/2)\n` +
          `  - 实际滚动位置: ${boundedScrollTop.toFixed(0)}px\n` +
          `  - 居中状态: ${isCentered ? '✓ 完全居中' : `偏移 ${centerOffset.toFixed(0)}px (${centerOffset > 0 ? '偏下' : '偏上'})`}\n` +
          `  - 边界限制: [0, ${maxScrollTop.toFixed(0)}px]`
        );

        // 使用平滑滚动
        this.#smoothScrollTo(viewerContainer, boundedScrollTop, this.#options.scrollDuration)
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
    return new Promise((resolve) => {
      const maxWaitTime = 3000; // 最大等待3秒
      const checkInterval = 50; // 每50ms检查一次
      const startTime = performance.now();

      const checkPageReady = () => {
        const elapsed = performance.now() - startTime;

        // 检查页面元素是否存在且已加载
        const viewerContainer = document.getElementById('viewerContainer');
        if (!viewerContainer) {
          this.#logger.warn('未找到viewerContainer，使用固定延迟');
          setTimeout(resolve, 200);
          return;
        }

        const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);

        if (pageElement) {
          // 页面元素存在，检查是否已渲染（有高度）
          const hasHeight = pageElement.offsetHeight > 0;

          if (hasHeight) {
            this.#logger.debug(`页面 ${pageNumber} 已渲染完成 (耗时 ${Math.round(elapsed)}ms)`);
            resolve();
            return;
          }
        }

        // 超时检查
        if (elapsed >= maxWaitTime) {
          this.#logger.warn(`页面 ${pageNumber} 等待超时 (${maxWaitTime}ms)，继续执行`);
          resolve();
          return;
        }

        // 继续等待
        setTimeout(checkPageReady, checkInterval);
      };

      this.#logger.debug(`开始等待页面 ${pageNumber} 渲染完成`);
      checkPageReady();
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
