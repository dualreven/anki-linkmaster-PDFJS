<!-- SPEC-TEST-GENERAL-001.md -->
- 规范名称: 通用测试规范
- 规范描述: 规定AI在项目中进行测试的标准流程，确保测试行为规范化、可追溯，避免任意测试
- 当前版本: 1.0
- 所属范畴: 测试规范
- 适用范围: 全项目所有测试活动，包括AI执行的测试和人工测试
- 正向例子:
  ```javascript
  // 规范优先原则示例
  
  /**
   * 测试前的规范查询
   * 在执行任何测试之前，必须先查询相关测试规范
   */
  async function checkTestSpecifications(featureName) {
    console.log(`[TEST] 查询${featureName}功能的测试规范`);
    
    // 搜索相关规范文档
    const specFiles = [
      'docs/SPEC/TEST/前端测试规范.md',
      'docs/SPEC/TEST/通用测试规范.md',
      `docs/SPEC/TEST/${featureName}测试规范.md`
    ];
    
    for (const specFile of specFiles) {
      try {
        const response = await fetch(specFile);
        if (response.ok) {
          const specContent = await response.text();
          console.log(`[TEST] 找到测试规范: ${specFile}`);
          
          // 解析规范内容
          const testMethods = parseTestMethods(specContent);
          return testMethods;
        }
      } catch (error) {
        console.log(`[TEST] 规范文件不存在: ${specFile}`);
      }
    }
    
    // 未找到规范，需要询问用户
    throw new Error(`未找到${featureName}功能的测试规范`);
  }
  
  /**
   * 解析测试规范中的测试方法
   */
  function parseTestMethods(specContent) {
    const methods = [];
    
    // 解析规范中的测试方法
    const methodMatches = specContent.match(/### \d+\.\s+(.+)/g);
    if (methodMatches) {
      methodMatches.forEach(match => {
        const methodName = match.replace(/### \d+\.\s+/, '');
        methods.push(methodName);
      });
    }
    
    return methods;
  }
  
  /**
   * 测试执行流程
   */
  async function executeTestFlow(featureName) {
    try {
      // 1. 查询测试规范
      const testMethods = await checkTestSpecifications(featureName);
      
      // 2. 确认测试环境
      await verifyTestEnvironment();
      
      // 3. 执行测试
      for (const method of testMethods) {
        console.log(`[TEST] 执行测试方法: ${method}`);
        await executeTestMethod(method);
      }
      
      // 4. 记录测试结果
      await recordTestResults(featureName, testMethods);
      
      // 5. 清理测试环境
      await cleanupTestEnvironment();
      
    } catch (error) {
      if (error.message.includes('未找到')) {
        // 规范不存在，询问用户
        await askUserForTestGuidance(featureName);
      } else {
        console.error(`[TEST] 测试执行失败: ${error.message}`);
        throw error;
      }
    }
  }
  
  /**
   * 测试环境验证
   */
  async function verifyTestEnvironment() {
    console.log('[TEST] 验证测试环境');
    
    const checks = [
      { name: '测试目录存在', check: () => checkDirectoryExists('tests') },
      { name: '测试数据目录存在', check: () => checkDirectoryExists('tests/fixtures') },
      { name: '生产数据已备份', check: () => checkProductionDataBackup() },
      { name: '测试范围已明确', check: () => checkTestScopeDefined() }
    ];
    
    const results = [];
    for (const check of checks) {
      try {
        const result = await check.check();
        results.push({ name: check.name, status: 'PASS', result });
        console.log(`[TEST] ✓ ${check.name}`);
      } catch (error) {
        results.push({ name: check.name, status: 'FAIL', error: error.message });
        console.log(`[TEST] ✗ ${check.name}: ${error.message}`);
        throw new Error(`环境验证失败: ${check.name}`);
      }
    }
    
    return results;
  }
  
  /**
   * 测试方法执行
   */
  async function executeTestMethod(methodName) {
    const startTime = Date.now();
    
    try {
      console.log(`[TEST] [${methodName}] 开始执行`);
      
      // 根据方法名执行相应的测试
      switch (methodName) {
        case '功能测试':
          await executeFunctionalTest();
          break;
        case '集成测试':
          await executeIntegrationTest();
          break;
        case '回归测试':
          await executeRegressionTest();
          break;
        default:
          throw new Error(`未知的测试方法: ${methodName}`);
      }
      
      const duration = Date.now() - startTime;
      console.log(`[TEST] [${methodName}] 执行完成，耗时: ${duration}ms`);
      
      return { name: methodName, status: 'PASS', duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[TEST] [${methodName}] 执行失败，耗时: ${duration}ms，错误: ${error.message}`);
      
      return { name: methodName, status: 'FAIL', duration, error: error.message };
    }
  }
  
  /**
   * 测试结果记录
   */
  async function recordTestResults(featureName, testMethods) {
    const timestamp = new Date().toISOString();
    const results = {
      feature: featureName,
      timestamp,
      methods: testMethods,
      summary: {
        total: testMethods.length,
        passed: testMethods.filter(m => m.status === 'PASS').length,
        failed: testMethods.filter(m => m.status === 'FAIL').length
      }
    };
    
    // 保存测试结果
    const resultFile = `tests/results/${featureName}-${timestamp.replace(/[:.]/g, '-')}.json`;
    await saveTestResult(resultFile, results);
    
    // 输出测试摘要
    console.log(`[TEST] 测试结果摘要:`);
    console.log(`[TEST] 功能: ${featureName}`);
    console.log(`[TEST] 总计: ${results.summary.total}`);
    console.log(`[TEST] 通过: ${results.summary.passed}`);
    console.log(`[TEST] 失败: ${results.summary.failed}`);
    console.log(`[TEST] 通过率: ${((results.summary.passed / results.summary.total) * 100).toFixed(2)}%`);
    
    return results;
  }
  
  /**
   * 测试环境清理
   */
  async function cleanupTestEnvironment() {
    console.log('[TEST] 开始清理测试环境');
    
    const cleanupTasks = [
      { name: '删除测试代码', task: () => removeTestCode() },
      { name: '清理测试数据', task: () => cleanupTestData() },
      { name: '恢复环境配置', task: () => restoreEnvironmentConfig() },
      { name: '验证清理完成', task: () => verifyCleanupComplete() }
    ];
    
    for (const task of cleanupTasks) {
      try {
        await task.task();
        console.log(`[TEST] ✓ ${task.name}`);
      } catch (error) {
        console.log(`[TEST] ✗ ${task.name}: ${error.message}`);
        throw new Error(`环境清理失败: ${task.name}`);
      }
    }
    
    console.log('[TEST] 测试环境清理完成');
  }
  
  /**
   * 询问用户测试指导
   */
  async function askUserForTestGuidance(featureName) {
    console.log(`[TEST] 未找到${featureName}功能的测试规范`);
    
    const questions = [
      '测试目标是什么？',
      '测试方法如何？',
      '预期结果怎样？',
      '是否需要特殊环境？'
    ];
    
    const answers = {};
    for (const question of questions) {
      const answer = await promptUser(question);
      answers[question] = answer;
    }
    
    // 确认用户提供的测试方案
    const confirmation = await promptUser('是否按照上述方案执行测试？(yes/no)');
    if (confirmation.toLowerCase() === 'yes') {
      // 根据用户提供的方案执行测试
      await executeUserDefinedTest(answers);
    } else {
      throw new Error('用户取消了测试执行');
    }
  }
  
  /**
   * 最小影响原则示例
  
  /**
   * 测试代码隔离
   */
  function createIsolatedTestCode(testLogic) {
    // 创建独立的测试作用域
    const testScope = {
      // 测试专用的变量和函数
      testData: null,
      testElements: [],
      testSubscriptions: [],
      
      // 测试逻辑
      run: async function() {
        try {
          await testLogic.call(this);
        } finally {
          // 确保清理
          this.cleanup();
        }
      },
      
      // 清理方法
      cleanup: function() {
        // 清理DOM元素
        this.testElements.forEach(el => el.remove());
        this.testElements = [];
        
        // 清理事件订阅
        this.testSubscriptions.forEach(off => off());
        this.testSubscriptions = [];
        
        // 清理测试数据
        this.testData = null;
      }
    };
    
    return testScope;
  }
  
  /**
   * 测试数据管理
   */
  class TestDataManager {
    constructor() {
      this.originalData = null;
      this.testData = null;
    }
    
    // 备份生产数据
    async backupProductionData() {
      console.log('[TEST] 备份生产数据');
      this.originalData = await this.fetchProductionData();
      console.log(`[TEST] 生产数据备份完成，共${this.originalData.length}条记录`);
    }
    
    // 创建测试数据
    async createTestData() {
      console.log('[TEST] 创建测试数据');
      this.testData = this.generateTestData();
      console.log(`[TEST] 测试数据创建完成，共${this.testData.length}条记录`);
    }
    
    // 恢复生产数据
    async restoreProductionData() {
      console.log('[TEST] 恢复生产数据');
      if (this.originalData) {
        await this.restoreData(this.originalData);
        console.log('[TEST] 生产数据恢复完成');
      }
    }
    
    // 清理测试数据
    async cleanupTestData() {
      console.log('[TEST] 清理测试数据');
      if (this.testData) {
        await this.removeData(this.testData);
        this.testData = null;
        console.log('[TEST] 测试数据清理完成');
      }
    }
  }
  
  /**
   * 可验证原则示例
   */
  class TestVerifier {
    constructor() {
      this.testLogs = [];
      this.testResults = [];
    }
    
    // 记录测试输出
    logTestOutput(module, type, status, message) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        module,
        type,
        status,
        message
      };
      
      this.testLogs.push(logEntry);
      console.log(`[TEST] [${timestamp}] [${module}] [${type}] [${status}] ${message}`);
    }
    
    // 验证测试结果
    verifyTestResults() {
      const results = {
        total: this.testLogs.length,
        passed: this.testLogs.filter(log => log.status === 'PASS').length,
        failed: this.testLogs.filter(log => log.status === 'FAIL').length,
        logs: this.testLogs
      };
      
      // 输出验证结果
      console.log('[TEST] 测试验证结果:');
      console.log(`[TEST] 总计: ${results.total}`);
      console.log(`[TEST] 通过: ${results.passed}`);
      console.log(`[TEST] 失败: ${results.failed}`);
      console.log(`[TEST] 通过率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
      
      return results;
    }
    
    // 生成测试报告
    generateTestReport(featureName) {
      const report = {
        feature: featureName,
        timestamp: new Date().toISOString(),
        results: this.verifyTestResults(),
        logs: this.testLogs
      };
      
      // 保存报告
      const reportFile = `tests/reports/${featureName}-${Date.now()}.json`;
      saveTestReport(reportFile, report);
      
      return report;
    }
  }
  ```
  
  ```bash
  # 测试前检查清单示例
  
  # 1. 规范查询
  echo "[TEST] 查询测试规范..."
  find docs/SPEC/TEST -name "*.md" -exec grep -l "PDF主页" {} \;
  
  # 2. 环境确认
  echo "[TEST] 确认测试环境..."
  
  # 检查测试目录
  if [ ! -d "tests" ]; then
    echo "[TEST] ✗ 测试目录不存在"
    exit 1
  fi
  
  # 检查测试数据目录
  if [ ! -d "tests/fixtures" ]; then
    echo "[TEST] ✗ 测试数据目录不存在"
    exit 1
  fi
  
  # 检查生产数据备份
  if [ ! -f "backups/production-data-$(date +%Y%m%d).sql" ]; then
    echo "[TEST] ✗ 生产数据备份不存在"
    exit 1
  fi
  
  echo "[TEST] ✓ 环境检查通过"
  
  # 3. 用户确认（如无规范）
  if [ ! -f "docs/SPEC/TEST/PDF主页测试规范.md" ]; then
    echo "[TEST] 未找到PDF主页测试规范"
    echo "[TEST] 请提供以下信息："
    echo "[TEST] 1. 测试目标是什么？"
    echo "[TEST] 2. 测试方法如何？"
    echo "[TEST] 3. 预期结果怎样？"
    echo "[TEST] 4. 是否需要特殊环境？"
  fi
  ```
- 反向例子:
  ```javascript
  // 违反规范优先原则的示例
  
  // 不查询规范，直接执行测试
  async function badTestExecution(featureName) {
    console.log(`[TEST] 开始测试${featureName}`);
    
    // 直接执行测试，不查询相关规范
    await directTestExecution();
    
    console.log(`[TEST] 测试完成`);
  }
  
  // 不进行环境验证
  async function testWithoutEnvironmentCheck() {
    console.log('[TEST] 开始测试');
    
    // 直接测试，不检查环境状态
    modifyProductionData();  // 可能影响生产环境
    
    console.log('[TEST] 测试完成');
  }
  
  // 不清理测试副作用
  function testWithSideEffects() {
    console.log('[TEST] 开始测试');
    
    // 添加测试数据到生产数据库
    db.insert('test_data', { name: 'test' });
    
    // 添加测试DOM元素
    const testDiv = document.createElement('div');
    testDiv.id = 'test-div';
    document.body.appendChild(testDiv);
    
    // 注册全局事件监听
    window.addEventListener('test-event', testHandler);
    
    console.log('[TEST] 测试完成');
    // 不清理任何副作用
  }
  
  // 不可验证的测试
  function unverifiableTest() {
    console.log('开始测试');  // 不使用[TEST]前缀
    
    // 执行测试但不记录结果
    someTestLogic();
    
    // 不输出测试状态
    console.log('测试结束');  // 不使用[TEST]前缀
  }
  
  // 任意测试行为
  function arbitraryTesting() {
    // 随机选择测试方法
    const testMethods = ['method1', 'method2', 'method3'];
    const selectedMethod = testMethods[Math.floor(Math.random() * testMethods.length)];
    
    console.log(`[TEST] 随机执行测试方法: ${selectedMethod}`);
    
    // 执行随机测试
    executeRandomTest(selectedMethod);
  }
  
  // 不处理测试异常
  function testWithoutErrorHandling() {
    console.log('[TEST] 开始测试');
    
    // 可能抛出异常的测试代码
    riskyTestOperation();
    
    // 不捕获异常，可能导致测试中断
    console.log('[TEST] 测试完成');
  }
  
  // 不隔离测试代码
  function nonIsolatedTest() {
    // 直接修改全局变量
    global.testVariable = 'test';
    
    // 直接修改生产配置
    config.testMode = true;
    
    // 不恢复原始状态
  }
  ```
  
  ```bash
  # 错误的测试执行方式
  
  # 不查询规范直接测试
  echo "开始测试PDF主页"
  npm test -- --grep "PDF主页"
  
  # 不检查环境状态
  echo "开始集成测试"
  npm run test:integration
  
  # 不备份生产数据
  echo "开始数据测试"
  python test_data.py
  
  # 不清理测试数据
  echo "测试完成"
  # 不执行任何清理操作
  
  # 不记录测试结果
  echo "测试执行完毕"
  # 不生成测试报告