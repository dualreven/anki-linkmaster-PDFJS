/**
 * PDF主页应用管理器
 * 整合UI、业务逻辑和WebSocket组件
 * @class PDFHomeAppManager
 * @extends AppManager
 */

// PDF主页应用管理器
import AppManager from '../common/app-manager.js';
// import {qtWebEngineAdapter} from"../common/index.js"
// 导入PDF主页组件
import PDFHomeUIManager from './pdf-home-ui.js';
import PDFHomeBusinessLogicManager from './pdf-home-business-logic.js';

class PDFHomeAppManager extends AppManager {
    /**
     * 创建PDF主页应用管理器实例
     * @constructor
     */
    constructor() {
        super({
            name: 'PDFHome',
            containerId: 'pdf-home-container',
            websocketUrl: 'ws://localhost:8765'
        });
    }
    
    /**
     * 创建业务逻辑管理器实例
     * @returns {PDFHomeBusinessLogicManager} 业务逻辑管理器实例
     */
    createBusinessLogicManager() {
        return new PDFHomeBusinessLogicManager();
    }

    /**
     * 创建UI管理器实例
     * @returns {PDFHomeUIManager} UI管理器实例
     */
    createUIManager() {
        return new PDFHomeUIManager();
    }
    
    /**
     * 设置组件间通信
     * 配置业务逻辑与UI组件之间的事件监听和消息传递
     */
    setupComponentCommunication() {
        super.setupComponentCommunication();
        
        const { business, ui } = this.components;
        
        // 业务逻辑到UI的通信
        business.on('pdfListUpdated', (pdfs) => {
            ui.updatePDFList(pdfs);
        });
        
        business.on('pdfAddRequested', (fileInfo) => {
            ui.showSuccess('正在添加PDF文件...');
        });
        
        business.on('pdfAddFailed', (error) => {
            ui.showError('添加PDF文件失败');
        });
        
        business.on('pdfRemoveRequested', (filename) => {
            ui.showSuccess('正在删除PDF文件...');
        });
        
        business.on('pdfRemoveFailed', (error) => {
            ui.showError('删除PDF文件失败');
        });
        
        business.on('error', (error) => {
            ui.showError(error);
        });
        
        // UI到业务逻辑的通信
        ui.on('action', (action) => {
            if (action.type === 'business_logic') {
                this.handleBusinessLogicAction(action);
            }
        });
    }
    
    /**
     * 处理业务逻辑动作
     * @param {Object} action - 动作对象
     * @param {string} action.action - 动作类型（openPDF/removePDF）
     * @param {string} action.filename - 目标PDF文件名
     */
    handleBusinessLogicAction(action) {
        const { business } = this.components;
        
        switch (action.action) {
            case 'openPDF':
                business.openPDF(action.filename);
                break;
                
            case 'removePDF':
                business.removePDF(action.filename);
                break;
                
            default:
                this.debug.warn(`未知的业务逻辑动作: ${action.action}`);
        }
    }
    
    /**
     * 设置全局事件处理器
     * 配置PDF主页特定的键盘快捷键和全局事件监听
     */
    setupGlobalEventHandlers() {
        super.setupGlobalEventHandlers();
        
        // PDF主页特定的全局事件处理
        document.addEventListener('keydown', (event) => {
            // Ctrl+N: 添加新PDF
            if (event.ctrlKey && event.key === 'n') {
                event.preventDefault();
                this.handleAddPDF();
            }
            
            // Ctrl+R: 刷新列表
            if (event.ctrlKey && event.key === 'r') {
                event.preventDefault();
                this.handleRefresh();
            }
        });
    }
    // /**
    //  * 初始化PDF主页应用
    //  * 按顺序完成应用的完整初始化流程，包括组件启动、通信配置、事件绑定和定时任务
    //  * @returns {Promise<void>} 初始化完成的Promise
    //  */
    // async init() {
    //     // 使用父类的初始化流程，确保组件正确初始化
    //     await this.initialize();
    //     // PDF主页特定的初始化
    //     this.setupGlobalEventHandlers();      // 绑定全局快捷键等事件
    //     this.setupPeriodicChecks();           // 启动周期性检查任务
    // }
    /**
     * 处理添加PDF的快捷键操作
     * 通过WebSocket请求文件选择对话框
     */
    handleAddPDF() {
        this.debug.info('快捷键: 添加PDF');
        this.components.websocket.send('request_file_selection');
    }

    /**
     * 处理刷新PDF列表的快捷键操作
     * 重新加载PDF文件列表
     */
    handleRefresh() {
        this.debug.info('快捷键: 刷新PDF列表');
        this.components.business.loadPDFList();
    }

    /**
     * 处理键盘按下事件
     * @param {KeyboardEvent} event - 键盘事件对象
     */
    handleKeyDown(event) {
        super.handleKeyDown(event);
        
        // PDF主页特定的键盘快捷键
        if (event.key === 'F5') {
            event.preventDefault();
            this.handleRefresh();
        }
    }
    
    /**
     * 启动PDF主页应用
     * 完成所有初始化工作后调用此方法启动应用
     */
    startApplication() {
        super.startApplication();
        
        // 注册全局应用管理器
        if (window.registerAppManager) {
            window.registerAppManager('pdfHome', this);
        }
        
        // 设置全局appManager变量
        window.appManager = this;
        
        // 触发AppManager就绪事件
        document.dispatchEvent(new CustomEvent('appManagerReady', {
            detail: { appManager: this }
        }));
        
        // 设置定时检查
        this.setupPeriodicChecks();
        
        this.debug.info('PDF主页应用启动完成');
    }

    /**
     * 设置周期性检查
     * 配置连接状态和DOM状态的定时检查
     */
    setupPeriodicChecks() {
        // 定期检查连接状态
        // qtWebEngineAdapter.safeSetInterval(() => {
        //     this.checkConnectionHealth();
        // }, 30000); // 每30秒检查一次
        
        // // 定期检查DOM状态
        // qtWebEngineAdapter.safeSetInterval(() => {
        //     this.checkDOMState();
        // }, 10000); // 每10秒检查一次
    }
    
    /**
     * 检查WebSocket连接健康状态
     * 如果连接不健康，尝试重新建立连接
     */
    checkConnectionHealth() {
        const { websocket } = this.components;
        
        if (!websocket.isConnected()) {
            this.debug.warn('WebSocket连接不健康，尝试重连');
            websocket.connect();
        }
    }

    /**
     * 检查DOM状态一致性
     * 验证PDF列表的DOM元素数量与业务数据是否匹配，不匹配时进行同步
     */
    checkDOMState() {
        const { ui } = this.components;
        const { pdfs } = this.components.business.getState();
        
        // 检查PDF列表DOM元素数量是否匹配
        const pdfList = document.getElementById('pdf-list');
        if (pdfList && pdfs) {
            const actualCount = pdfList.children.length;
            const expectedCount = pdfs.length;
            
            if (actualCount !== expectedCount) {
                this.debug.warn(`DOM状态不匹配: 期望 ${expectedCount} 个PDF，实际 ${actualCount} 个`);
                ui.updatePDFList(pdfs);
            }
        }
    }
    
    /**
     * 获取应用当前状态
     * @returns {Object} 应用状态对象，包含基础状态、PDF数量、选中的PDF和WebSocket状态
     */
    getState() {
        const baseState = super.getState();
        return {
            ...baseState,
            pdfCount: this.components.business.getPDFs().length,
            selectedPDF: this.components.business.getSelectedPDF(),
            websocketState: this.components.websocket.getState()
        };
    }

    /**
     * 获取应用诊断信息
     * @returns {Object} 诊断信息对象，包含时间戳、应用状态、环境信息和性能指标
     */
    getDiagnostics() {
        return {
            timestamp: new Date().toISOString(),
            app: this.getState(),
            // environment: {
            //     qtWebEngine: qtWebEngineAdapter.isQtWebEngine,
            //     domReady: qtWebEngineAdapter.domReady,
            //     windowLoaded: qtWebEngineAdapter.windowLoaded
            // },
            performance: debugTools.getPerformanceMetrics(),
            logs: debugTools.getLogs(null, 10)
        };
    }
}


export default PDFHomeAppManager;
