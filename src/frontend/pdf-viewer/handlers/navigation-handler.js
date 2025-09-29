/**
 * @file 导航事件处理器
 * @module NavigationHandler
 * @description 处理PDF查看器的页面导航相关事件
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * 导航处理器类
 * 负责处理所有页面导航相关的事件
 */
export class NavigationHandler {
  #app;
  #logger;

  constructor(app) {
    this.#app = app;
    this.#logger = getLogger("NavigationHandler");
  }

  /**
   * 设置导航相关的事件监听器
   */
  setupEventListeners() {
    const eventBus = this.#app.eventBus;

    // 页面跳转
    eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => {
      this.handleGoto(data);
    }, { subscriberId: 'NavigationHandler' });

    // 上一页
    eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => {
      this.handlePrevious();
    }, { subscriberId: 'NavigationHandler' });

    // 下一页
    eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => {
      this.handleNext();
    }, { subscriberId: 'NavigationHandler' });

    // 注意: FIRST 和 LAST 事件在当前版本中未定义
    // 如果需要，可以通过 GOTO 事件实现相同功能

    this.#logger.info("Navigation event listeners setup complete");
  }

  /**
   * 处理页面跳转
   * @param {Object} data - 跳转数据
   * @param {number} data.pageNumber - 目标页码
   */
  async handleGoto(data) {
    const pageNumber = parseInt(data.pageNumber);

    if (!this.#validatePageNumber(pageNumber)) {
      this.#logger.warn(`Invalid page number: ${pageNumber}`);
      return;
    }

    try {
      this.#logger.info(`Navigating to page ${pageNumber}`);
      this.#app.currentPage = pageNumber;
      await this.#renderPage(pageNumber);
      this.#emitNavigationChanged();
    } catch (error) {
      this.#logger.error(`Failed to navigate to page ${pageNumber}:`, error);
      this.#app.errorHandler.handleError(error, "PageNavigation");
    }
  }

  /**
   * 处理上一页导航
   */
  async handlePrevious() {
    if (this.#app.currentPage > 1) {
      await this.handleGoto({ pageNumber: this.#app.currentPage - 1 });
    } else {
      this.#logger.debug("Already at first page");
    }
  }

  /**
   * 处理下一页导航
   */
  async handleNext() {
    if (this.#app.currentPage < this.#app.totalPages) {
      await this.handleGoto({ pageNumber: this.#app.currentPage + 1 });
    } else {
      this.#logger.debug("Already at last page");
    }
  }

  /**
   * 处理跳转到第一页
   */
  async handleFirst() {
    if (this.#app.currentPage !== 1) {
      await this.handleGoto({ pageNumber: 1 });
    }
  }

  /**
   * 处理跳转到最后一页
   */
  async handleLast() {
    if (this.#app.currentPage !== this.#app.totalPages) {
      await this.handleGoto({ pageNumber: this.#app.totalPages });
    }
  }

  /**
   * 验证页码有效性
   * @param {number} pageNumber - 页码
   * @returns {boolean} 是否有效
   * @private
   */
  #validatePageNumber(pageNumber) {
    return pageNumber >= 1 &&
           pageNumber <= this.#app.totalPages &&
           !isNaN(pageNumber);
  }

  /**
   * 渲染指定页面
   * @param {number} pageNumber - 页面编号
   * @private
   */
  async #renderPage(pageNumber) {
    // 发送渲染请求事件
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.RENDER.PAGE_REQUESTED,
      {
        pageNumber,
        totalPages: this.#app.totalPages
      },
      { actorId: 'NavigationHandler' }
    );

    try {
      // 获取页面
      const page = await this.#app.pdfManager.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.#app.zoomLevel });

      // 渲染页面
      await this.#app.uiManager.renderPage(page, viewport);

      // 发送渲染完成事件
      this.#app.eventBus.emit(
        PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED,
        {
          pageNumber,
          viewport
        },
        { actorId: 'NavigationHandler' }
      );

      this.#logger.debug(`Page ${pageNumber} rendered successfully`);

    } catch (error) {
      this.#logger.error(`Failed to render page ${pageNumber}:`, error);

      // 发送渲染失败事件
      this.#app.eventBus.emit(
        PDF_VIEWER_EVENTS.RENDER.PAGE_FAILED,
        {
          pageNumber,
          error: error.message
        },
        { actorId: 'NavigationHandler' }
      );

      throw error;
    }
  }

  /**
   * 发送导航变更事件
   * @private
   */
  #emitNavigationChanged() {
    // 发送导航变更事件
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGED,
      {
        pageNumber: this.#app.currentPage,
        totalPages: this.#app.totalPages
      },
      { actorId: 'NavigationHandler' }
    );

    // 更新UI管理器中的页面信息
    this.#app.uiManager.updatePageInfo(
      this.#app.currentPage,
      this.#app.totalPages
    );

    this.#logger.info(`Navigation changed: ${this.#app.currentPage}/${this.#app.totalPages}`);
  }

  /**
   * 获取当前页码
   * @returns {number} 当前页码
   */
  getCurrentPage() {
    return this.#app.currentPage;
  }

  /**
   * 获取总页数
   * @returns {number} 总页数
   */
  getTotalPages() {
    return this.#app.totalPages;
  }

  /**
   * 销毁处理器
   */
  destroy() {
    this.#logger.info("Navigation handler destroyed");
  }
}