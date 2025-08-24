/**
 * PDFTable容器诊断测试
 * 用于诊断PDFTableRenderer.clearContainer中this.container为undefined的问题
 * 
 * 测试目标：
 * 1. 验证PDFTable实例化时container是否正确设置
 * 2. 检查PDFTableRenderer构造函数中container的获取方式
 * 3. 验证tableWrapper是否正确创建并赋值
 */

import Logger from '../../src/frontend/pdf-home/utils/logger.js';

class PDFTableContainerDiagnostic {
  constructor() {
    this.logger = new Logger('PDFTableContainerDiagnostic');
    this.testResults = {
      containerValidation: false,
      rendererContainerValidation: false,
      tableWrapperValidation: false,
      initializationFlow: []
    };
  }

  /**
   * 运行完整的容器诊断测试
   */
  async runDiagnostic() {
    console.log('[DIAGNOSTIC] 开始PDFTable容器诊断测试...');
    
    try {
      // 测试1: 验证容器元素存在性
      await this.testContainerElement();
      
      // 测试2: 验证PDFTable实例化流程
      await this.testPDFTableInstantiation();
      
      // 测试3: 验证PDFTableRenderer容器设置
      await this.testRendererContainer();
      
      // 测试4: 验证初始化流程
      await this.testInitializationFlow();
      
      // 输出诊断结果
      this.outputResults();
      
    } catch (error) {
      this.logger.error('诊断测试执行失败:', error);
      this.testResults.error = error.message;
    }
  }

  /**
   * 测试1: 验证容器元素存在性
   */
  async testContainerElement() {
    console.log('[DIAGNOSTIC] 测试1: 验证容器元素存在性...');
    
    const containerSelectors = [
      '#pdf-table-container',
      '.pdf-table-container',
      '[data-testid="pdf-table-container"]'
    ];
    
    let foundContainer = null;
    
    for (const selector of containerSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        foundContainer = element;
        console.log(`[DIAGNOSTIC] 找到容器元素: ${selector}`, element);
        break;
      }
    }
    
    if (!foundContainer) {
      console.warn('[DIAGNOSTIC] 未找到标准容器元素，检查DOM结构...');
      
      // 检查可能的容器位置
      const possibleContainers = document.querySelectorAll('div[id*="table"], div[class*="table"]');
      console.log('[DIAGNOSTIC] 可能的容器元素:', possibleContainers);
    }
    
    this.testResults.containerValidation = !!foundContainer;
    this.testResults.foundContainer = foundContainer;
  }

  /**
   * 测试2: 验证PDFTable实例化流程
   */
  async testPDFTableInstantiation() {
    console.log('[DIAGNOSTIC] 测试2: 验证PDFTable实例化流程...');
    
    try {
      // 动态导入PDFTable
      const PDFTableModule = await import('../../src/frontend/common/pdf-table/pdf-table.js');
      const PDFTable = PDFTableModule.default || PDFTableModule;
      
      // 获取容器
      const container = this.testResults.foundContainer || document.querySelector('#pdf-table-container');
      
      if (!container) {
        throw new Error('找不到PDFTable容器元素');
      }
      
      console.log('[DIAGNOSTIC] 创建PDFTable实例...');
      
      // 创建测试配置
      const testConfig = {
        columns: [
          { id: 'test', title: '测试列', field: 'test' }
        ],
        data: [{ test: '测试数据' }],
        pageSize: 10
      };
      
      // 创建PDFTable实例
      const pdfTable = new PDFTable(container, testConfig);
      
      console.log('[DIAGNOSTIC] PDFTable实例创建成功:', pdfTable);
      console.log('[DIAGNOSTIC] PDFTable容器:', pdfTable.container);
      console.log('[DIAGNOSTIC] PDFTable tableWrapper:', pdfTable.tableWrapper);
      
      this.testResults.pdfTableInstance = pdfTable;
      this.testResults.instantiationSuccess = true;
      
    } catch (error) {
      console.error('[DIAGNOSTIC] PDFTable实例化失败:', error);
      this.testResults.instantiationError = error.message;
    }
  }

  /**
   * 测试3: 验证PDFTableRenderer容器设置
   */
  async testRendererContainer() {
    console.log('[DIAGNOSTIC] 测试3: 验证PDFTableRenderer容器设置...');
    
    if (!this.testResults.pdfTableInstance) {
      console.warn('[DIAGNOSTIC] 跳过渲染器测试，PDFTable实例未创建');
      return;
    }
    
    try {
      const pdfTable = this.testResults.pdfTableInstance;
      const renderer = pdfTable.renderer;
      
      console.log('[DIAGNOSTIC] 检查PDFTableRenderer...');
      console.log('[DIAGNOSTIC] Renderer container:', renderer.container);
      console.log('[DIAGNOSTIC] Renderer table.tableWrapper:', renderer.table.tableWrapper);
      
      // 验证container是否正确设置
      const expectedContainer = pdfTable.tableWrapper;
      const actualContainer = renderer.container;
      
      this.testResults.rendererContainerValidation = (expectedContainer === actualContainer);
      
      if (!this.testResults.rendererContainerValidation) {
        console.warn('[DIAGNOSTIC] 容器不匹配!');
        console.warn('[DIAGNOSTIC] 期望的container:', expectedContainer);
        console.warn('[DIAGNOSTIC] 实际的container:', actualContainer);
      }
      
    } catch (error) {
      console.error('[DIAGNOSTIC] 渲染器容器验证失败:', error);
      this.testResults.rendererError = error.message;
    }
  }

  /**
   * 测试4: 验证初始化流程
   */
  async testInitializationFlow() {
    console.log('[DIAGNOSTIC] 测试4: 验证初始化流程...');
    
    if (!this.testResults.pdfTableInstance) {
      console.warn('[DIAGNOSTIC] 跳过初始化流程测试，PDFTable实例未创建');
      return;
    }
    
    try {
      const pdfTable = this.testResults.pdfTableInstance;
      
      console.log('[DIAGNOSTIC] 开始初始化PDFTable...');
      
      // 记录初始化步骤
      this.testResults.initializationFlow.push('开始初始化');
      
      // 检查setupContainer方法
      if (typeof pdfTable.setupContainer === 'function') {
        pdfTable.setupContainer();
        this.testResults.initializationFlow.push('setupContainer完成');
        console.log('[DIAGNOSTIC] setupContainer完成，tableWrapper:', pdfTable.tableWrapper);
      }
      
      // 检查renderer.container在初始化后是否正确设置
      if (pdfTable.renderer && pdfTable.tableWrapper) {
        const rendererContainer = pdfTable.renderer.container;
        const expectedContainer = pdfTable.tableWrapper;
        
        console.log('[DIAGNOSTIC] 初始化后检查:');
        console.log('[DIAGNOSTIC] renderer.container:', rendererContainer);
        console.log('[DIAGNOSTIC] table.tableWrapper:', expectedContainer);
        console.log('[DIAGNOSTIC] 是否匹配:', rendererContainer === expectedContainer);
        
        this.testResults.postInitContainerMatch = (rendererContainer === expectedContainer);
      }
      
      // 测试clearContainer方法
      if (pdfTable.renderer && typeof pdfTable.renderer.clearContainer === 'function') {
        try {
          console.log('[DIAGNOSTIC] 测试clearContainer方法...');
          pdfTable.renderer.clearContainer();
          this.testResults.initializationFlow.push('clearContainer测试通过');
        } catch (error) {
          console.error('[DIAGNOSTIC] clearContainer测试失败:', error);
          this.testResults.clearContainerError = error.message;
        }
      }
      
    } catch (error) {
      console.error('[DIAGNOSTIC] 初始化流程测试失败:', error);
      this.testResults.initializationError = error.message;
    }
  }

  /**
   * 输出诊断结果
   */
  outputResults() {
    console.log('[DIAGNOSTIC] ===== 诊断结果 =====');
    console.log('[DIAGNOSTIC] 容器验证:', this.testResults.containerValidation);
    console.log('[DIAGNOSTIC] 渲染器容器验证:', this.testResults.rendererContainerValidation);
    console.log('[DIAGNOSTIC] 初始化流程:', this.testResults.initializationFlow);
    
    if (this.testResults.clearContainerError) {
      console.error('[DIAGNOSTIC] clearContainer错误:', this.testResults.clearContainerError);
    }
    
    if (this.testResults.instantiationError) {
      console.error('[DIAGNOSTIC] 实例化错误:', this.testResults.instantiationError);
    }
    
    console.log('[DIAGNOSTIC] 完整测试结果:', this.testResults);
    
    // 保存诊断结果到全局变量供调试使用
    window.diagnosticResults = this.testResults;
  }
}

// 导出诊断类
export default PDFTableContainerDiagnostic;

// 自动运行诊断测试（如果在浏览器环境中）
if (typeof window !== 'undefined') {
  window.runPDFTableDiagnostic = async () => {
    const diagnostic = new PDFTableContainerDiagnostic();
    await diagnostic.runDiagnostic();
  };
  
  console.log('[DIAGNOSTIC] PDFTable容器诊断测试已加载，运行 runPDFTableDiagnostic() 开始测试');
}