/**
 * 侧边栏管理器Feature
 *
 * @description 统一管理所有侧边栏的打开/关闭、布局和宽度调整
 */

import { getLogger } from '../../../common/utils/logger.js';
import { LayoutEngine } from './layout-engine.js';
import { validateSidebarConfig } from './sidebar-config.js';
import { registerRealSidebars, createRealSidebarButtons } from './real-sidebars.js';
import { PDFLayoutAdapter } from './pdf-layout-adapter.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
const logger = getLogger('SidebarManager');


export class SidebarManagerFeature {
    #eventBus;
    #container;
    #logger;
    #sidebars = new Map();          // 注册的侧边栏配置
    #openOrder = [];                 // 打开顺序
    #layoutEngine;                   // 布局引擎
    #pdfLayoutAdapter;               // PDF布局适配器
    #containerElement;               // 统一容器DOM
    #sidebarWidths = new Map();      // 自定义宽度存储
    #resizeState = {                 // 拖拽调整状态
        isResizing: false,
        sidebarId: null,
        startX: 0,
        startWidth: 0
    };

    /**
     * Feature名称
     */
    get name() {
        return 'sidebar-manager';
    }

    /**
     * 版本号
     */
    get version() {
        return '1.0.0';
    }

    /**
     * 依赖的Features
     */
    get dependencies() {
        // 使用新的 pdf-outline 替代 pdf-bookmark
        return ['annotation', 'pdf-translator', 'pdf-outline', 'pdf-card'];
    }

    /**
     * 安装Feature
     * @param {Object} context - Feature上下文
     * @param {EventBus} context.globalEventBus - 全局事件总线
     * @param {Object} context.container - 依赖容器
     * @param {Logger} context.logger - 日志记录器
     */
    async install(context) {
        const { globalEventBus, container, logger } = context;

        this.#eventBus = globalEventBus;
        this.#container = container;
        this.#logger = logger || getLogger('SidebarManagerFeature');
        this.#layoutEngine = new LayoutEngine();
        this.#pdfLayoutAdapter = new PDFLayoutAdapter(globalEventBus);

        this.#createContainer();
        this.#loadWidthPreferences();
        this.#setupEventListeners();
        this.#setupGlobalResizeHandlers();

        // 初始化PDF布局适配器
        setTimeout(() => {
            this.#pdfLayoutAdapter.initialize();
        }, 100);

        // 注册真实侧边栏（书签、批注、卡片、翻译）
        registerRealSidebars(this, this.#eventBus, this.#container);

        // 创建侧边栏切换按钮
        setTimeout(() => {
            createRealSidebarButtons(this.#eventBus);
        }, 100);

        logger.info('SidebarManagerFeature installed', {
            version: this.version
        });
    }

    /**
     * 卸载Feature
     */
    async uninstall() {
        this.#containerElement?.remove();
        this.#sidebars.clear();
        this.#openOrder = [];
        this.#sidebarWidths.clear();
        this.#pdfLayoutAdapter?.destroy();

        logger.info('SidebarManagerFeature uninstalled');
    }

    /**
     * 注册侧边栏
     * @param {import('./sidebar-config.js').SidebarConfig} config - 侧边栏配置
     */
    registerSidebar(config) {
        if (!validateSidebarConfig(config)) {
            logger.error('Invalid sidebar config', config);
            throw new Error(`Invalid sidebar config: ${config?.id}`);
        }

        if (this.#sidebars.has(config.id)) {
            logger.warn(`Sidebar already registered: ${config.id}`);
            return;
        }

        this.#sidebars.set(config.id, config);
        logger.info(`Sidebar registered: ${config.id}`, config);
    }

    /**
     * 切换侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
    toggleSidebar(sidebarId) {
        logger.info(`Toggle sidebar requested: ${sidebarId}`);
        const isOpen = this.#openOrder.includes(sidebarId);
        logger.info(`Sidebar ${sidebarId} is ${isOpen ? 'open' : 'closed'}`);
        if (isOpen) {
            this.closeSidebar(sidebarId);
        } else {
            this.openSidebar(sidebarId);
        }
    }

    /**
     * 打开侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
    openSidebar(sidebarId) {
        logger.info(`Opening sidebar: ${sidebarId}`);

        if (this.#openOrder.includes(sidebarId)) {
            logger.warn(`Sidebar already open: ${sidebarId}`);
            return;
        }

        const config = this.#sidebars.get(sidebarId);
        if (!config) {
            logger.error(`Sidebar not registered: ${sidebarId}`);
            logger.info(`Available sidebars: ${Array.from(this.#sidebars.keys()).join(', ')}`);
            return;
        }

        logger.info(`Config found for ${sidebarId}, creating panel...`);

        // 添加到打开顺序
        this.#openOrder.push(sidebarId);

        // 创建侧边栏DOM
        const panel = this.#createSidebarPanel(config);
        this.#containerElement.appendChild(panel);

        // 重新计算布局
        this.#recalculateLayout();

        // 触发事件（与事件常量保持一致）
        this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED, {
            sidebarId,
            order: this.#openOrder.length
        }, { actorId: 'SidebarManager' });

        logger.info(`Sidebar opened: ${sidebarId}`, {
            order: this.#openOrder.length,
            openSidebars: this.#openOrder
        });
    }

    /**
     * 关闭侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
    closeSidebar(sidebarId) {
        const index = this.#openOrder.indexOf(sidebarId);
        if (index === -1) {
            logger.warn(`Sidebar not open: ${sidebarId}`);
            return;
        }

        // 从打开顺序中移除
        this.#openOrder.splice(index, 1);

        // 移除DOM
        const panel = this.#containerElement.querySelector(`[data-sidebar-id="${sidebarId}"]`);
        panel?.remove();

        // 重新计算布局
        this.#recalculateLayout();

        // 触发事件（修复：使用正确的事件名 sidebar:closed:completed）
        this.#eventBus.emit('sidebar:closed:completed', {
            sidebarId,
            remainingIds: [...this.#openOrder]
        }, { actorId: 'SidebarManager' });

        logger.info(`Sidebar closed: ${sidebarId}`, {
            remainingCount: this.#openOrder.length,
            openSidebars: this.#openOrder
        });
    }

    // ==================== 私有方法 ====================

    /**
     * 创建统一容器
     */
    #createContainer() {
        this.#containerElement = document.createElement('div');
        this.#containerElement.id = 'unified-sidebar-container';
        this.#containerElement.className = 'unified-sidebar-container';
        document.body.appendChild(this.#containerElement);

        logger.debug('Sidebar container created');
    }

    /**
     * 创建侧边栏面板
     * @param {import('./sidebar-config.js').SidebarConfig} config - 侧边栏配置
     * @returns {HTMLElement} 侧边栏面板元素
     */
    #createSidebarPanel(config) {
        const panel = document.createElement('div');
        panel.className = 'sidebar-panel';
        panel.setAttribute('data-sidebar-id', config.id);

        // 创建头部
        const header = document.createElement('div');
        header.className = 'sidebar-header';

        const title = document.createElement('h3');
        title.className = 'sidebar-title';
        title.textContent = config.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        `;
        closeBtn.setAttribute('aria-label', '关闭侧边栏');
        closeBtn.addEventListener('click', () => {
            this.closeSidebar(config.id);
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // 创建内容区
        const content = document.createElement('div');
        content.className = 'sidebar-content';
        try {
            const renderedContent = config.contentRenderer();
            content.appendChild(renderedContent);
        } catch (error) {
            logger.error(`Failed to render sidebar content: ${config.id}`, error);
            content.innerHTML = '<p>内容加载失败</p>';
        }

        // 创建调整分隔条
        if (config.resizable) {
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'sidebar-resize-handle';
            resizeHandle.setAttribute('data-sidebar-id', config.id);
            this.#attachResizeHandlers(resizeHandle, panel, config);
            panel.appendChild(resizeHandle);
        }

        panel.appendChild(header);
        panel.appendChild(content);

        return panel;
    }

    /**
     * 重新计算布局
     */
    #recalculateLayout() {
        const containerWidth = this.#containerElement.offsetWidth || 1200; // 默认宽度

        if (this.#openOrder.length === 0) {
        // 没有侧边栏时，通知PDF容器恢复全宽
        this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, {
            totalWidth: 0
        }, { actorId: 'SidebarManager' });
        return;
        }

        const layouts = this.#layoutEngine.calculateLayoutWithCustomWidths(
            this.#openOrder,
            this.#sidebarWidths,
            containerWidth
        );

        this.#layoutEngine.applyLayout(layouts, this.#containerElement);

        // 计算侧边栏总宽度
        const totalWidth = layouts.reduce((sum, layout) => sum + layout.width, 0);

        // 通知PDF容器调整布局
        this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, {
            totalWidth,
            layouts
        }, { actorId: 'SidebarManager' });

        // 可选：布局更新完成（复用同一事件常量，订阅者根据数据结构区分即可）
        // this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, { layouts }, { actorId: 'SidebarManager' });

        logger.debug('Layout recalculated', {
            openCount: this.#openOrder.length,
            containerWidth,
            totalWidth,
            layouts
        });
    }

    /**
     * 设置事件监听器
     */
    #setupEventListeners() {
        this.#eventBus.on('sidebar:toggle:requested', ({ sidebarId }) => {
            try {
                logger.info(`[EventListener] Received toggle request for: ${sidebarId}`);
                this.toggleSidebar(sidebarId);
            } catch (error) {
                logger.error(`[EventListener] Toggle failed:`, error);
            }
        }, { subscriberId: 'SidebarManager' });

        this.#eventBus.on('sidebar:open:requested', ({ sidebarId }) => {
            try {
                logger.info(`[EventListener] Received open request for: ${sidebarId}`);
                this.openSidebar(sidebarId);
            } catch (error) {
                logger.error(`[EventListener] Open failed:`, error);
            }
        }, { subscriberId: 'SidebarManager' });

        this.#eventBus.on('sidebar:close:requested', ({ sidebarId }) => {
            try {
                logger.info(`[EventListener] Received close request for: ${sidebarId}`);
                this.closeSidebar(sidebarId);
            } catch (error) {
                logger.error(`[EventListener] Close failed:`, error);
            }
        }, { subscriberId: 'SidebarManager' });

        logger.info('Event listeners setup completed');
    }

    // ==================== 宽度调整相关 ====================

    /**
     * 获取侧边栏宽度
     * @param {string} sidebarId - 侧边栏ID
     * @returns {number} 宽度
     */
    #getSidebarWidth(sidebarId) {
        const config = this.#sidebars.get(sidebarId);
        return this.#sidebarWidths.get(sidebarId) || config?.defaultWidth || 350;
    }

    /**
     * 设置侧边栏宽度
     * @param {string} sidebarId - 侧边栏ID
     * @param {number} width - 宽度
     */
    #setSidebarWidth(sidebarId, width) {
        const config = this.#sidebars.get(sidebarId);
        if (!config) {
            return;
        }

        const constrainedWidth = Math.max(
            config.minWidth,
            Math.min(config.maxWidth, width)
        );
        this.#sidebarWidths.set(sidebarId, constrainedWidth);
        this.#saveWidthPreferences();

        logger.debug(`Sidebar width set: ${sidebarId}`, {
            requested: width,
            constrained: constrainedWidth
        });
    }

    /**
     * 持久化宽度偏好
     */
    #saveWidthPreferences() {
        try {
            const preferences = Object.fromEntries(this.#sidebarWidths);
            localStorage.setItem('sidebar-widths', JSON.stringify(preferences));
            logger.debug('Width preferences saved', preferences);
        } catch (error) {
            logger.error('Failed to save width preferences', error);
        }
    }

    /**
     * 加载宽度偏好
     */
    #loadWidthPreferences() {
        try {
            const saved = localStorage.getItem('sidebar-widths');
            if (saved) {
                const preferences = JSON.parse(saved);
                Object.entries(preferences).forEach(([id, width]) => {
                    this.#sidebarWidths.set(id, width);
                });
                logger.debug('Width preferences loaded', preferences);
            }
        } catch (error) {
            logger.error('Failed to load width preferences', error);
        }
    }

    /**
     * 绑定拖拽处理器
     * @param {HTMLElement} handle - 拖拽手柄
     * @param {HTMLElement} panel - 侧边栏面板
     * @param {import('./sidebar-config.js').SidebarConfig} config - 配置
     */
    #attachResizeHandlers(handle, panel, config) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();

            this.#resizeState.isResizing = true;
            this.#resizeState.sidebarId = config.id;
            this.#resizeState.startX = e.clientX;
            this.#resizeState.startWidth = panel.offsetWidth;

            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            logger.debug('Resize started', {
                sidebarId: config.id,
                startWidth: this.#resizeState.startWidth
            });
        });
    }

    /**
     * 设置全局拖拽处理器
     */
    #setupGlobalResizeHandlers() {
        document.addEventListener('mousemove', (e) => {
            if (!this.#resizeState.isResizing) return;

            const deltaX = e.clientX - this.#resizeState.startX;
            // 从左侧弹出时，向右拖（deltaX为正）应该增加宽度
            const newWidth = this.#resizeState.startWidth + deltaX;
            const sidebarId = this.#resizeState.sidebarId;

            // 更新宽度
            this.#setSidebarWidth(sidebarId, newWidth);

            // 重新计算布局
            this.#recalculateLayout();
        });

        document.addEventListener('mouseup', () => {
            if (!this.#resizeState.isResizing) return;

            this.#resizeState.isResizing = false;

            const handles = document.querySelectorAll('.sidebar-resize-handle');
            handles.forEach(h => h.classList.remove('resizing'));

            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            logger.info('Resize completed', {
                sidebarId: this.#resizeState.sidebarId,
                finalWidth: this.#sidebarWidths.get(this.#resizeState.sidebarId)
            });

            this.#resizeState.sidebarId = null;
        });

        logger.debug('Global resize handlers setup');
    }
}
