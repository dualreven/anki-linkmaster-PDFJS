/**
 * PDF Table Integration Debug Test
 * 用于验证PDFTable在pdf-home中的集成问题
 */

// 导入必要的模块
import { DOMUtils } from '../src/frontend/pdf-home/utils/dom-utils.js';

// 模拟PDFTable类的关键部分
class MockPDFTable {
    constructor(container, config = {}) {
        console.log('[DEBUG] PDFTable constructor called');
        console.log('[DEBUG] Input container:', container);
        console.log('[DEBUG] Input config:', config);
        
        // Validate container
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container;
        }
        
        console.log('[DEBUG] PDFTable this.container:', this.container);
        
        if (!this.container) {
            throw new Error('Container element not found');
        }
        
        // State management
        this.state = {
            data: [],
            isLoading: false,
            error: null
        };
        
        // Initialize config
        this.config = {
            theme: config.theme || 'modern',
            ...config
        };
        
        // 注意：此时 this.tableWrapper 还未创建
        console.log('[DEBUG] PDFTable this.tableWrapper before setupContainer:', this.tableWrapper);
        
        // Initialize core components - 这里会创建PDFTableRenderer
        // 这就是问题所在：在setupContainer之前创建renderer，但renderer需要tableWrapper
        this.renderer = new MockPDFTableRenderer(this);
        
        console.log('[DEBUG] PDFTable renderer created, renderer.container:', this.renderer.container);
        
        // Initialize other components
        this.events = new MockEventBus();
        this.dataModel = new MockDataModel();
        
        // Internal state
        this._initialized = false;
    }
    
    /**
     * Setup container structure
     */
    setupContainer() {
        console.log('[DEBUG] PDFTable.setupContainer called');
        
        this.container.innerHTML = '';
        this.container.className = `pdf-table-container pdf-table-container--${this.config.theme}`;
        
        // Create table wrapper
        this.tableWrapper = document.createElement('div');
        this.tableWrapper.className = 'pdf-table-wrapper';
        
        // Create loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'pdf-table-loading';
        this.loadingIndicator.innerHTML = '<div class="pdf-table-loading-spinner"></div>';
        this.loadingIndicator.style.display = 'none';
        
        // Create error message
        this.errorMessage = document.createElement('div');
        this.errorMessage.className = 'pdf-table-error';
        this.errorMessage.style.display = 'none';
        
        // Assemble container
        this.container.appendChild(this.loadingIndicator);
        this.container.appendChild(this.errorMessage);
        this.container.appendChild(this.tableWrapper);
        
        console.log('[DEBUG] PDFTable.setupContainer completed, this.tableWrapper:', this.tableWrapper);
        console.log('[DEBUG] PDFTable.renderer.container after setupContainer:', this.renderer.container);
    }
    
    /**
     * Initialize the table
     */
    async initialize() {
        console.log('[DEBUG] PDFTable.initialize called');
        
        if (this._initialized) {
            console.warn('PDFTable is already initialized');
            return;
        }
        
        try {
            this.state.isLoading = true;
            
            // Setup container structure
            this.setupContainer();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initial render
            await this.render();
            
            this._initialized = true;
            this.events.emit('initialized', this);
            
        } catch (error) {
            this.state.error = error.message;
            this.events.emit('error', error);
            throw error;
        } finally {
            this.state.isLoading = false;
        }
    }
    
    setupEventListeners() {
        console.log('[DEBUG] PDFTable.setupEventListeners called');
        // 简化的事件监听器设置
    }
    
    async render() {
        console.log('[DEBUG] PDFTable.render called');
        try {
            await this.renderer.render(this.state.data);
        } catch (error) {
            console.error('[DEBUG] PDFTable.render failed:', error);
            throw error;
        }
    }
}

// 模拟PDFTableRenderer类的关键部分
class MockPDFTableRenderer {
    constructor(table) {
        console.log('[DEBUG] PDFTableRenderer constructor called');
        this.table = table;
        
        // 这里使用table.tableWrapper，但此时table.tableWrapper可能还未创建
        this.container = table.tableWrapper;
        
        console.log('[DEBUG] PDFTableRenderer this.container:', this.container);
        console.log('[DEBUG] PDFTableRenderer this.container === undefined:', this.container === undefined);
        console.log('[DEBUG] PDFTableRenderer this.container === null:', this.container === null);
    }
    
    async render(data) {
        console.log('[DEBUG] PDFTableRenderer.render called');
        
        // Clear container - 这里会抛出错误，如果this.container是undefined
        this.clearContainer();
        
        console.log('[DEBUG] PDFTableRenderer.render completed successfully');
    }
    
    clearContainer() {
        console.log('[DEBUG] PDFTableRenderer.clearContainer called');
        console.log('[DEBUG] PDFTableRenderer this.container before innerHTML:', this.container);
        
        // 这里会抛出错误，如果this.container是undefined
        try {
            this.container.innerHTML = '';
            console.log('[DEBUG] PDFTableRenderer.clearContainer succeeded');
        } catch (error) {
            console.error('[DEBUG] PDFTableRenderer.clearContainer failed:', error);
            throw error;
        }
    }
}

// 模拟EventBus
class MockEventBus {
    constructor() {
        this.events = {};
    }
    
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }
    
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(data));
        }
    }
}

// 模拟DataModel
class MockDataModel {
    validateData(data) {
        // 简化的数据验证
        return [];
    }
}

// 模拟UIManager的关键部分
class MockUIManager {
    constructor() {
        this.logger = {
            info: (msg) => console.log('[INFO]', msg),
            error: (msg, err) => console.error('[ERROR]', msg, err)
        };
        
        this.pdfTable = null;
        this.tableContainer = null;
        
        this.initializeElements();
    }
    
    initializeElements() {
        // 创建测试容器
        const container = document.createElement('div');
        container.className = 'container';
        
        const pdfTableContainer = document.createElement('div');
        pdfTableContainer.id = 'pdf-table-container';
        pdfTableContainer.className = 'pdf-table-container';
        
        container.appendChild(pdfTableContainer);
        document.body.appendChild(container);
        
        this.elements = {
            container: container,
            pdfTableContainer: pdfTableContainer
        };
        
        // 设置表格容器
        this.tableContainer = this.elements.pdfTableContainer;
        
        console.log('[DEBUG] UIManager.initializeElements completed');
        console.log('[DEBUG] UIManager.tableContainer:', this.tableContainer);
    }
    
    async initializePDFTable() {
        console.log('[DEBUG] UIManager.initializePDFTable called');
        
        if (this.pdfTable) {
            console.log('[DEBUG] PDFTable already initialized');
            return;
        }
        
        const config = {
            columns: [
                { id: 'select', title: '选择', field: 'select', width: 50 },
                { id: 'filename', title: '文件名', field: 'filename', width: 250 }
            ],
            data: [],
            pageSize: 25,
            theme: 'modern'
        };
        
        try {
            // 这里是关键：创建PDFTable实例
            this.pdfTable = new MockPDFTable(this.tableContainer, config);
            console.log('[DEBUG] PDFTable instance created');
            
            // 初始化PDFTable
            await this.pdfTable.initialize();
            console.log('[DEBUG] PDFTable initialized successfully');
            
        } catch (error) {
            console.error('[DEBUG] UIManager.initializePDFTable failed:', error);
            throw error;
        }
    }
}

// 测试函数
async function runIntegrationDebugTest() {
    console.log('[DEBUG] ===== 开始PDF Table集成调试测试 =====');
    
    try {
        // 模拟UIManager的初始化过程
        console.log('[DEBUG] 创建UIManager...');
        const uiManager = new MockUIManager();
        
        console.log('[DEBUG] 初始化PDFTable...');
        await uiManager.initializePDFTable();
        
        console.log('[DEBUG] 测试完成，没有发生错误');
        
    } catch (error) {
        console.error('[DEBUG] 测试捕获到错误:', error);
        console.error('[DEBUG] 错误类型:', error.constructor.name);
        console.error('[DEBUG] 错误消息:', error.message);
        console.error('[DEBUG] 错误堆栈:', error.stack);
        
        // 分析错误原因
        if (error.message.includes('Cannot set properties of undefined (setting \'innerHTML\')')) {
            console.log('[DEBUG] 分析结果：确认了我们的假设 - PDFTableRenderer.container在初始化时是undefined');
            console.log('[DEBUG] 原因：PDFTableRenderer在PDFTable.setupContainer之前被创建，但此时tableWrapper还不存在');
        }
    } finally {
        // 清理测试容器
        const container = document.querySelector('.container');
        if (container) {
            document.body.removeChild(container);
            console.log('[DEBUG] 测试容器已清理');
        }
        
        console.log('[DEBUG] ===== PDF Table集成调试测试结束 =====');
    }
}

// 导出测试函数
export { runIntegrationDebugTest };

// 如果直接运行此文件，则执行测试
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('[DEBUG] DOM加载完成，开始运行集成测试');
        runIntegrationDebugTest();
    });
}