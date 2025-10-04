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
 * @property {number} right - 右侧位置（px）
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
            const right = i * baseWidth; // 从右到左排列
            const width = isLast ? containerWidth - right : baseWidth;

            layouts.push({
                id: openSidebarIds[i],
                right: right, // 使用right替代left
                width: width,
                zIndex: 100 + (count - i) // 最右侧z-index最高
            });
        }

        logger.debug('Calculated equal-width layout (right-aligned)', {
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
        let currentRight = 0;
        const count = openSidebarIds.length;

        openSidebarIds.forEach((id, index) => {
            const width = widthMap.get(id) || 350; // 使用自定义宽度或默认值

            layouts.push({
                id: id,
                right: currentRight, // 使用right替代left
                width: width,
                zIndex: 100 + (count - index) // 最右侧z-index最高
            });

            currentRight += width;
        });

        logger.debug('Calculated custom-width layout (right-aligned)', {
            openSidebarIds,
            totalWidth: currentRight,
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
                panel.style.right = `${layout.right}px`; // 使用right替代left
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
            if (!layout.id || typeof layout.right !== 'number' || typeof layout.width !== 'number') {
                logger.error('Invalid layout data', layout);
                return false;
            }

            if (layout.right < 0 || layout.width <= 0) {
                logger.error('Invalid layout dimensions', layout);
                return false;
            }
        }

        return true;
    }
}
