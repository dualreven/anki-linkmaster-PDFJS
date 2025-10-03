/**
 * 侧边栏配置定义
 *
 * @description 定义侧边栏的配置结构和默认值
 */

/**
 * 侧边栏配置类型定义
 * @typedef {Object} SidebarConfig
 * @property {string} id - 唯一标识
 * @property {string} buttonSelector - 按钮选择器
 * @property {Function} contentRenderer - 内容渲染函数，返回DOM元素
 * @property {string} title - 侧边栏标题
 * @property {number} minWidth - 最小宽度（px）
 * @property {number} maxWidth - 最大宽度（px）
 * @property {number} defaultWidth - 默认宽度（px）
 * @property {boolean} resizable - 是否可调整宽度
 * @property {number} [priority] - 优先级（暂未使用）
 */

/**
 * 侧边栏默认配置
 */
export const DEFAULT_SIDEBAR_CONFIG = {
    minWidth: 250,
    maxWidth: 600,
    defaultWidth: 350,
    resizable: true,
    priority: 0
};

/**
 * 创建侧边栏配置
 * @param {Partial<SidebarConfig>} config - 配置选项
 * @returns {SidebarConfig} 完整的侧边栏配置
 */
export function createSidebarConfig(config) {
    if (!config.id) {
        throw new Error('Sidebar config must have an id');
    }
    if (typeof config.contentRenderer !== 'function') {
        throw new Error('Sidebar config must have a contentRenderer function');
    }
    if (!config.title) {
        throw new Error('Sidebar config must have a title');
    }

    return {
        ...DEFAULT_SIDEBAR_CONFIG,
        ...config
    };
}

/**
 * 验证侧边栏配置
 * @param {SidebarConfig} config - 配置对象
 * @returns {boolean} 是否有效
 */
export function validateSidebarConfig(config) {
    if (!config || typeof config !== 'object') {
        return false;
    }

    const requiredFields = ['id', 'contentRenderer', 'title'];
    for (const field of requiredFields) {
        if (!config[field]) {
            return false;
        }
    }

    if (typeof config.contentRenderer !== 'function') {
        return false;
    }

    if (config.minWidth < 0 || config.maxWidth < config.minWidth) {
        return false;
    }

    return true;
}
