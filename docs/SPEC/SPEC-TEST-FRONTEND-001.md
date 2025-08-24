<!-- SPEC-TEST-FRONTEND-001.md -->
- 规范名称: 前端测试规范
- 规范描述: 规定前端测试的标准流程、方法和工具使用，确保测试的规范性和可追溯性
- 当前版本: 1.0
- 所属范畴: 测试规范
- 适用范围: 全项目所有前端代码的测试
- 正向例子:
  ```javascript
  // 测试模块模板 - src/frontend/test-modules/test-pdf-home-[日期].js
  
  /**
   * PDF主页功能测试模块
   * 测试PDF主页的核心功能，包括列表加载、文件上传等
   */
  
  // 测试状态
  let testState = {
    passed: 0,
    failed: 0,
    startTime: null,
    endTime: null
  };
  
  // 测试结果收集
  const testResults = [];
  
  /**
   * 运行PDF主页测试
   */
  export async function runTest() {
    console.log('[TEST] PDF主页功能测试开始');
    testState.startTime = new Date();
    
    try {
      // 检查环境状态
      await testEnvironment();
      
      // 测试PDF列表加载
      await testPdfListLoading();
      
      // 测试文件上传
      await testFileUpload();
      
      // 测试错误处理
      await testErrorHandling();
      
    } catch (error) {
      console.error('[TEST] 测试执行失败:', error);
      testState.failed++;
      testResults.push({
        name: '测试执行',
        status: 'FAIL',
        error: error.message
      });
    } finally {
      // 完成测试
      finishTest();
    }
  }
  
  /**
   * 清理测试资源
   */
  export function cleanup() {
    console.log('[TEST] 开始清理测试资源');
    
    // 移除测试添加的DOM元素
    const testElements = document.querySelectorAll('[data-test-element]');
    testElements.forEach(el => el.remove());
    
    // 移除测试注册的事件监听
    if (window.testEventSubscriptions) {
      window.testEventSubscriptions.forEach(off => off());
      window.testEventSubscriptions = [];
    }
    
    // 清理测试产生的全局变量
    delete window.testState;
    delete window.testResults;
    
    console.log('[TEST] 测试资源清理完成');
  }
  
  /**
   * 测试环境状态
   */
  async function testEnvironment() {
    console.log('[TEST] 检查环境状态');
    
    const env = checkFrontendEnv();
    
    if (!env.vite) {
      throw new Error('Vite环境未就绪');
    }
    
    if (!env.eventBus) {
      throw new Error('事件总线未初始化');
    }
    
    if (!env.ws) {
      throw new Error('WebSocket连接未建立');
    }
    
    console.log('[TEST] 环境检查通过:', env);
    testState.passed++;
    testResults.push({
      name: '环境检查',
      status: 'PASS',
      details: env
    });
  }
  
  /**
   * 测试PDF列表加载
   */
  async function testPdfListLoading() {
    console.log('[TEST] 开始PDF列表加载测试');
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('PDF列表加载超时'));
      }, 5000);
      
      // 监听列表更新事件
      const off = window.eventBus.on('pdf:management:list_updated', (data) => {
        clearTimeout(timeout);
        off();
        
        try {
          // 验证数据结构
          if (!data.files || !Array.isArray(data.files)) {
            throw new Error('PDF列表数据格式错误');
          }
          
          console.log(`[TEST] PDF列表加载成功，共${data.files.length}个文件`);
          testState.passed++;
          testResults.push({
            name: 'PDF列表加载',
            status: 'PASS',
            details: { fileCount: data.files.length }
          });
          
          resolve();
        } catch (error) {
          testState.failed++;
          testResults.push({
            name: 'PDF列表加载',
            status: 'FAIL',
            error: error.message
          });
          reject(error);
        }
      });
      
      // 触发加载
      window.eventBus.emit('pdf:management:list_requested');
      
      // 保存订阅引用以便清理
      if (!window.testEventSubscriptions) {
        window.testEventSubscriptions = [];
      }
      window.testEventSubscriptions.push(off);
    });
  }
  
  /**
   * 测试文件上传
   */
  async function testFileUpload() {
    console.log('[TEST] 开始文件上传测试');
    
    // 创建测试文件
    const testFile = new Blob(['test content'], { type: 'application/pdf' });
    testFile.name = 'test-upload.pdf';
    
    // 模拟文件选择
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      throw new Error('未找到文件输入元素');
    }
    
    // 创建DataTransfer对象来模拟文件选择
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(testFile);
    fileInput.files = dataTransfer.files;
    
    // 触发change事件
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 等待上传完成
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('文件上传超时'));
      }, 10000);
      
      const off = window.eventBus.on('pdf:management:upload_complete', (data) => {
        clearTimeout(timeout);
        off();
        
        try {
          if (!data.file || !data.file.id) {
            throw new Error('上传响应数据格式错误');
          }
          
          console.log(`[TEST] 文件上传成功，文件ID: ${data.file.id}`);
          testState.passed++;
          testResults.push({
            name: '文件上传',
            status: 'PASS',
            details: { fileId: data.file.id }
          });
          
          resolve();
        } catch (error) {
          testState.failed++;
          testResults.push({
            name: '文件上传',
            status: 'FAIL',
            error: error.message
          });
          reject(error);
        }
      });
      
      // 保存订阅引用
      window.testEventSubscriptions.push(off);
    });
  }
  
  /**
   * 测试错误处理
   */
  async function testErrorHandling() {
    console.log('[TEST] 开始错误处理测试');
    
    // 模拟错误情况
    const invalidFile = new Blob(['invalid content'], { type: 'text/plain' });
    invalidFile.name = 'test.txt';
    
    const fileInput = document.querySelector('input[type="file"]');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(invalidFile);
    fileInput.files = dataTransfer.files;
    
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('错误处理测试超时'));
      }, 5000);
      
      const off = window.eventBus.on('error:handle', (error) => {
        clearTimeout(timeout);
        off();
        
        try {
          if (!error || !error.message) {
            throw new Error('错误数据格式错误');
          }
          
          console.log(`[TEST] 错误处理正常，错误信息: ${error.message}`);
          testState.passed++;
          testResults.push({
            name: '错误处理',
            status: 'PASS',
            details: { errorMessage: error.message }
          });
          
          resolve();
        } catch (error) {
          testState.failed++;
          testResults.push({
            name: '错误处理',
            status: 'FAIL',
            error: error.message
          });
          reject(error);
        }
      });
      
      // 保存订阅引用
      window.testEventSubscriptions.push(off);
    });
  }
  
  /**
   * 完成测试并输出结果
   */
  function finishTest() {
    testState.endTime = new Date();
    const duration = testState.endTime - testState.startTime;
    
    console.log('[TEST] 测试完成');
    console.log(`[TEST] 总耗时: ${duration}ms`);
    console.log(`[TEST] 通过: ${testState.passed}`);
    console.log(`[TEST] 失败: ${testState.failed}`);
    console.log(`[TEST] 通过率: ${((testState.passed / (testState.passed + testState.failed)) * 100).toFixed(2)}%`);
    
    // 输出详细结果
    testResults.forEach(result => {
      if (result.status === 'PASS') {
        console.log(`[TEST] ✓ ${result.name}: ${result.details ? JSON.stringify(result.details) : '通过'}`);
      } else {
        console.log(`[TEST] ✗ ${result.name}: ${result.error || '失败'}`);
      }
    });
  }
  
  /**
   * 检查前端环境状态
   */
  export function checkFrontendEnv() {
    return {
      timestamp: new Date().toISOString(),
      vite: !!window.__vite_plugin_react_preamble_installed__,
      eventBus: !!window.eventBus,
      ws: window.wsClient?.isConnected() || false,
      debug: true // debug-console-at-[端口号].log始终可用
    };
  }
  ```
  
  ```javascript
  // 测试注入脚本 - 在浏览器控制台中执行
  
  // 注入测试模块
  function injectTestModule() {
    console.log('[TEST] 开始注入测试模块');
    
    // 创建脚本元素
    const script = document.createElement('script');
    script.type = 'module';
    script.setAttribute('data-test-element', 'true');
    
    // 设置脚本内容
    script.textContent = `
      import { runTest, cleanup } from '/src/frontend/test-modules/test-pdf-home-20240824.js';
      
      // 运行测试
      runTest().finally(() => {
        console.log('[TEST] 测试执行完成');
      });
      
      // 页面卸载时清理
      window.addEventListener('beforeunload', cleanup);
    `;
    
    // 添加到页面
    document.body.appendChild(script);
    
    console.log('[TEST] 测试模块注入完成');
  }
  
  // 执行注入
  injectTestModule();
  ```
  
  ```bash
  # 监控测试输出
  # 实时查看debug-console-at-[端口号].log中的测试输出
  
  tail -f debug-console-at-9222.log | grep "[TEST]"
  
  # 预期输出示例:
  # [19:26:15.684][LOG] [TEST] PDF主页功能测试开始
  # [19:26:16.103][LOG] [TEST] 环境检查通过: {...}
  # [19:26:17.245][LOG] [TEST] PDF列表加载成功，共3个文件
  # [19:26:18.567][LOG] [TEST] 文件上传成功，文件ID: abc123
  # [19:26:19.123][LOG] [TEST] 错误处理正常，错误信息: 不支持的文件类型
  # [19:26:19.456][LOG] [TEST] 测试完成
  # [19:26:19.456][LOG] [TEST] 总耗时: 3772ms
  # [19:26:19.456][LOG] [TEST] 通过: 4
  # [19:26:19.456][LOG] [TEST] 失败: 0
  # [19:26:19.456][LOG] [TEST] 通过率: 100.00%
  ```
- 反向例子:
  ```javascript
  // 错误的测试模块实现
  
  // 缺少清理函数
  export function runTest() {
    console.log('[TEST] 开始测试');
    
    // 直接操作DOM，不记录测试元素
    const testDiv = document.createElement('div');
    testDiv.innerHTML = '测试内容';
    document.body.appendChild(testDiv);
    
    // 硬编码等待时间
    setTimeout(() => {
      console.log('[TEST] 测试完成');
    }, 1000);
  }
  
  // 缺少错误处理
  async function testPdfListLoading() {
    console.log('[TEST] 开始PDF列表加载测试');
    
    // 直接监听事件，不设置超时
    window.eventBus.on('pdf:management:list_updated', (data) => {
      // 不验证数据结构
      console.log('[TEST] PDF列表加载成功');
    });
    
    // 触发加载
    window.eventBus.emit('pdf:management:list_requested');
  }
  
  // 不记录测试结果
  function testEnvironment() {
    const env = checkFrontendEnv();
    
    // 不记录测试状态
    if (!env.vite) {
      console.error('Vite环境未就绪');
      return;
    }
    
    console.log('[TEST] 环境检查通过');
  }
  
  // 不清理事件订阅
  async function testFileUpload() {
    console.log('[TEST] 开始文件上传测试');
    
    // 监听事件但不保存订阅引用
    window.eventBus.on('pdf:management:upload_complete', (data) => {
      console.log('[TEST] 文件上传成功');
    });
    
    // 模拟文件上传
    const fileInput = document.querySelector('input[type="file"]');
    // ... 上传逻辑
  }
  
  // 缺少环境检查
  export function runTestWithoutEnvCheck() {
    console.log('[TEST] 开始测试');
    
    // 直接测试，不检查环境状态
    testPdfListLoading();
    testFileUpload();
  }
  
  // 不规范的测试输出
  function testWithBadOutput() {
    // 不使用[TEST]前缀
    console.log('开始PDF列表测试');
    
    // 不记录测试状态
    window.eventBus.on('pdf:management:list_updated', (data) => {
      console.log('PDF列表加载成功');
    });
    
    window.eventBus.emit('pdf:management:list_requested');
  }
  
  // 测试模块文件名不规范
  // 文件名: test_pdf_home.js (缺少日期)
  // 文件名: pdf-home-test.js (格式不正确)
  // 文件名: test-pdf-home-2024-08-24.js (日期格式不正确)
  ```
  
  ```javascript
  // 错误的测试注入方式
  
  // 直接执行测试代码，不通过模块注入
  function badTestInjection() {
    // 直接在控制台执行测试逻辑
    console.log('开始测试');
    
    // 直接操作全局变量
    window.testData = 'test';
    
    // 不清理测试数据
    delete window.testData;
  }
  
  // 使用同步方式测试异步功能
  function badAsyncTest() {
    console.log('[TEST] 开始异步测试');
    
    // 错误：同步方式测试异步功能
    let result = null;
    window.eventBus.on('pdf:management:list_updated', (data) => {
      result = data;
    });
    
    window.eventBus.emit('pdf:management:list_requested');
    
    // 错误：立即检查结果，不等待异步操作完成
    if (result) {
      console.log('[TEST] 测试通过');
    } else {
      console.log('[TEST] 测试失败');
    }
  }
  
  // 不处理测试异常
  function badErrorHandling() {
    console.log('[TEST] 开始错误处理测试');
    
    // 故意触发错误
    window.eventBus.emit('pdf:management:invalid_event');
    
    // 不监听错误事件，不处理异常
  }
  ```
  
  ```bash
  # 错误的监控方式
  
  # 不使用grep过滤测试输出
  tail -f debug-console-at-9222.log
  
  # 查找不存在的测试前缀
  tail -f debug-console-at-9222.log | grep "[Test]"  # 错误的大小写
  
  # 不实时监控，只查看静态文件
  cat debug-console-at-9222.log