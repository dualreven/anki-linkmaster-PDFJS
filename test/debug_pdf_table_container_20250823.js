/**
 * PDF Table Container Debug Test
 * 用于验证PDFTableRenderer中container属性的初始化问题
 */

// 模拟PDFTable类的简化版本
class MockPDFTable {
    constructor(container, config = {}) {
        console.log('[DEBUG] PDFTable constructor called with container:', container);
        
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
        
        // 注意：此时 this.tableWrapper 还未创建
        console.log('[DEBUG] PDFTable this.tableWrapper before setupContainer:', this.tableWrapper);
        
        // Initialize core components - 这里会创建PDFTableRenderer
        this.renderer = new MockPDFTableRenderer(this);
        
        // Setup container structure - 这里会创建tableWrapper
        this.setupContainer();
        
        console.log('[DEBUG] PDFTable this.tableWrapper after setupContainer:', this.tableWrapper);
    }
    
    setupContainer() {
        this.container.innerHTML = '';
        this.container.className = `pdf-table-container pdf-table-container--modern`;
        
        // Create table wrapper
        this.tableWrapper = document.createElement('div');
        this.tableWrapper.className = 'pdf-table-wrapper';
        
        // Assemble container
        this.container.appendChild(this.tableWrapper);
        
        console.log('[DEBUG] setupContainer completed, tableWrapper created:', this.tableWrapper);
    }
}

// 模拟PDFTableRenderer类的简化版本
class MockPDFTableRenderer {
    constructor(table) {
        this.table = table;
        // 这里使用table.tableWrapper，但此时table.tableWrapper可能还未创建
        this.container = table.tableWrapper;
        
        console.log('[DEBUG] PDFTableRenderer constructor called');
        console.log('[DEBUG] PDFTableRenderer this.container:', this.container);
        console.log('[DEBUG] PDFTableRenderer this.container === undefined:', this.container === undefined);
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

// 测试函数
function runContainerDebugTest() {
    console.log('[DEBUG] ===== 开始PDF Table Container调试测试 =====');
    
    try {
        // 创建测试容器
        const testContainer = document.createElement('div');
        testContainer.id = 'pdf-table-container';
        document.body.appendChild(testContainer);
        
        console.log('[DEBUG] 测试容器创建成功:', testContainer);
        
        // 模拟UIManager中的初始化过程
        console.log('[DEBUG] 模拟UIManager.initializePDFTable...');
        const pdfTable = new MockPDFTable(testContainer, {
            theme: 'modern'
        });
        
        console.log('[DEBUG] PDFTable创建成功');
        
        // 尝试调用clearContainer，这应该会失败
        console.log('[DEBUG] 尝试调用pdfTable.renderer.clearContainer...');
        pdfTable.renderer.clearContainer();
        
        console.log('[DEBUG] 测试完成，没有发生错误');
        
    } catch (error) {
        console.error('[DEBUG] 测试捕获到错误:', error);
        console.error('[DEBUG] 错误类型:', error.constructor.name);
        console.error('[DEBUG] 错误消息:', error.message);
        console.error('[DEBUG] 错误堆栈:', error.stack);
    } finally {
        // 清理测试容器
        const testContainer = document.getElementById('pdf-table-container');
        if (testContainer) {
            document.body.removeChild(testContainer);
            console.log('[DEBUG] 测试容器已清理');
        }
        
        console.log('[DEBUG] ===== PDF Table Container调试测试结束 =====');
    }
}

// 导出测试函数
export { runContainerDebugTest };

// 如果直接运行此文件，则执行测试
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('[DEBUG] DOM加载完成，开始运行测试');
        runContainerDebugTest();
    });
}