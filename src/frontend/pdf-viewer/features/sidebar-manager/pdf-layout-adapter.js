/**
 * PDF布局适配器
 *
 * @description 监听侧边栏变化，动态调整PDF渲染区大小，确保不被遮挡
 */

import { getLogger } from '../../../common/utils/logger.js';

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

        // 监听侧边栏布局变化事件
        this.#eventBus.on('sidebar:layout:changed', ({ totalWidth }) => {
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

        // 为侧边栏让出右侧空间
        this.#pdfContainer.style.marginRight = `${sidebarWidth}px`;

        logger.info('PDF layout updated', {
            sidebarWidth,
            pdfContainerMarginRight: this.#pdfContainer.style.marginRight
        });
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
            this.#pdfContainer.style.marginRight = '0';
        }
        this.#currentSidebarWidth = 0;
        logger.info('PDFLayoutAdapter destroyed');
    }
}
