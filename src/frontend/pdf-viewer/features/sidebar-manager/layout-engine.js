/**
 * 侧边栏布局引擎
 *
 * @description 负责计算和应用侧边栏的位置和宽度
 */

import { getLogger } from '../../../common/utils/logger.js';

const logger = getLogger('LayoutEngine');

/**
 * 布局数据类型
 * @typedef {Object} LayoutData
 * @property {string} id - 侧边栏ID
 * @property {number} left - 左侧位置（px）
 * @property {number} width - 宽度（px）
 * @property {number} zIndex - 层级
 */

export class LayoutEngine {
    /**
     * 计算均分布局（无自定义宽度）
     * @param {string[]} openSidebarIds - 打开的侧边栏ID列表
     * @param {number} containerWidth - 容器宽度
     * @returns {LayoutData[]} 布局数据数组
     */
    calculateLayout(openSidebarIds, containerWidth) {
        const count = openSidebarIds.length;
        if (count === 0) {
            return [];
        }

        const layouts = [];
        const baseWidth = Math.floor(containerWidth / count);

        for (let i = 0; i < count; i++) {
            const isLast = i === count - 1;
            const left = i * baseWidth; // 从左到右排列
            const width = isLast ? containerWidth - left : baseWidth;

            layouts.push({
                id: openSidebarIds[i],
                left: left,
                width: width,
                zIndex: 100 + i // 最左侧z-index最低，最右侧最高
            });
        }

        logger.debug('Calculated equal-width layout (left-aligned)', {
            count,
            containerWidth,
            layouts
        });

        return layouts;
    }

    /**
     * 计算自定义宽度布局
     * @param {string[]} openSidebarIds - 打开的侧边栏ID列表
     * @param {Map<string, number>} widthMap - 宽度映射表
     * @param {number} containerWidth - 容器宽度
     * @returns {LayoutData[]} 布局数据数组
     */
    calculateLayoutWithCustomWidths(openSidebarIds, widthMap, containerWidth) {
        const layouts = [];
        let currentLeft = 0;
        const count = openSidebarIds.length;

        openSidebarIds.forEach((id, index) => {
            const width = widthMap.get(id) || 350; // 使用自定义宽度或默认值

            layouts.push({
                id: id,
                left: currentLeft,
                width: width,
                zIndex: 100 + index // 最左侧z-index最低，最右侧最高
            });

            currentLeft += width;
        });

        logger.debug('Calculated custom-width layout (left-aligned)', {
            openSidebarIds,
            totalWidth: currentLeft,
            layouts
        });

        return layouts;
    }

    /**
     * 应用布局到DOM
     * @param {LayoutData[]} layouts - 布局数据数组
     * @param {HTMLElement} containerElement - 容器元素
     */
    applyLayout(layouts, containerElement) {
        if (!containerElement) {
            logger.error('Container element not found');
            return;
        }

        layouts.forEach(layout => {
            const panel = containerElement.querySelector(`[data-sidebar-id="${layout.id}"]`);
            if (panel) {
                panel.style.left = `${layout.left}px`;
                panel.style.width = `${layout.width}px`;
                panel.style.zIndex = layout.zIndex;

                logger.debug(`Applied layout to sidebar ${layout.id}`, layout);
            } else {
                logger.warn(`Sidebar panel not found: ${layout.id}`);
            }
        });
    }

    /**
     * 验证布局数据
     * @param {LayoutData[]} layouts - 布局数据数组
     * @returns {boolean} 是否有效
     */
    validateLayout(layouts) {
        if (!Array.isArray(layouts)) {
            return false;
        }

        for (const layout of layouts) {
            if (!layout.id || typeof layout.left !== 'number' || typeof layout.width !== 'number') {
                logger.error('Invalid layout data', layout);
                return false;
            }

            if (layout.left < 0 || layout.width <= 0) {
                logger.error('Invalid layout dimensions', layout);
                return false;
            }
        }

        return true;
    }
}
