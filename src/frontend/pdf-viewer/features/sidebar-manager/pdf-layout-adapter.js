/**
 * PDF布局适配器
 *
 * @description 监听侧边栏变化，动态调整PDF渲染区大小，确保不被遮挡
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
const logger = getLogger('PDFLayoutAdapter');


export class PDFLayoutAdapter {
    #eventBus;
    #pdfContainer;
    #currentSidebarWidth = 0;

    /**
     * 构造函数
     * @param {EventBus} eventBus - 事件总线
     */
    constructor(eventBus) {
        this.#eventBus = eventBus;
        this.#pdfContainer = null;
    }

    /**
     * 初始化
     */
    initialize() {
        // 获取PDF容器
        this.#pdfContainer = document.querySelector('.pdf-container') || document.getElementById('viewerContainer');

        if (!this.#pdfContainer) {
            logger.warn('PDF container not found, layout adaptation disabled');
            return;
        }

        // 监听侧边栏布局变化事件（使用常量，保持与白名单一致）
        this.#eventBus.on(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, ({ totalWidth }) => {
            this.#updatePDFLayout(totalWidth);
        }, { subscriberId: 'PDFLayoutAdapter' });

        logger.info('PDFLayoutAdapter initialized');
    }

    /**
     * 更新PDF布局
     * @param {number} sidebarWidth - 侧边栏总宽度
     */
    #updatePDFLayout(sidebarWidth) {
        if (!this.#pdfContainer) {
            logger.warn('PDF container not available');
            return;
        }

        this.#currentSidebarWidth = sidebarWidth;

        // 为侧边栏让出左侧空间（使用left属性）
        this.#pdfContainer.style.left = `${sidebarWidth}px`;

        logger.info(`PDF layout updated: sidebarWidth=${sidebarWidth}px, left=${this.#pdfContainer.style.left}, container=${this.#pdfContainer.className}`);
    }

    /**
     * 获取当前侧边栏宽度
     * @returns {number}
     */
    getCurrentSidebarWidth() {
        return this.#currentSidebarWidth;
    }

    /**
     * 清理
     */
    destroy() {
        if (this.#pdfContainer) {
            this.#pdfContainer.style.left = '0';
        }
        this.#currentSidebarWidth = 0;
        logger.info('PDFLayoutAdapter destroyed');
    }
}
