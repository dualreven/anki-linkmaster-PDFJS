# 前端测试规范

## 概述
本规范定义了AI在本项目中进行前端代码测试的标准流程和方法。基于vite热更新、app.py后端服务、debug.py调试工具构成的开发环境，确保测试行为规范化、可追溯。

## 测试前置检查

### 1. 规范查询机制
**要求**：AI不得任意进行测试，必须先查询测试规范
**流程**：
1. 搜索现有测试规范文件
2. 检查相关模块是否已有测试标准
3. 如无规范，必须询问用户测试方式
4. 获得用户明确指示后方可测试

**示例**：
```javascript
// 测试前必须先查询规范
// 搜索 docs/SPEC/TEST/ 目录下的相关规范
// 如有疑问，询问用户而非擅自测试
```

### 2. 环境检查清单
**要求**：测试前确认环境状态
**检查项**：
- [ ] vite dev server 已启动（通常已自动运行）
- [ ] app.py 后端服务运行正常
- [ ] debug.py 调试工具可用
- [ ] WebSocket连接已建立
- [ ] 前端页面已加载完成

## 测试方法规范

### 1. 基于热更新的测试
**原理**：利用vite的热模块替换(HMR)特性
**方法**：
- 修改HTML/JS文件后自动刷新
- 通过debug-console.log观察控制台输出
- 实时验证功能变更

**示例**：
```javascript
// 在debug-console.log中查看输出
console.log('[TEST] 测试模块已加载');
console.log('[TEST] 功能验证:', testResult);
```

### 2. 测试模块注入测试
**要求**：创建可导入的测试模块
**规范**：
- 测试模块统一放在 `src/frontend/test-modules/` 目录
- 模块名格式：`test-[功能名]-[日期].js`
- 必须包含清理函数，避免副作用

**示例**：
```javascript
// test-pdf-home-20240823.js
export function runPDFHomeTest() {
    const testResults = [];
    
    // 测试用例1：页面加载
    testResults.push(testPageLoad());
    
    // 测试用例2：功能验证
    testResults.push(testFeature());
    
    console.log('[TEST] PDF主页测试结果:', testResults);
    return testResults;
}

export function cleanup() {
    // 清理测试产生的DOM变更
    document.querySelectorAll('.test-marker').forEach(el => el.remove());
}
```

### 3. 控制台调试规范
**要求**：充分利用debug-console.log进行调试
**方法**：
- 所有测试输出必须包含`[TEST]`前缀
- 使用结构化日志输出
- 记录测试步骤和结果

**示例**：
```javascript
console.log('[TEST] 开始测试: PDF列表加载');
console.log('[TEST] 步骤1: 触发加载事件');
window.eventBus.emit('pdf:management:list_requested');
console.log('[TEST] 步骤2: 等待响应...');
```

## 测试执行流程

### 1. 单次测试流程
```
1. 查询规范 → 2. 用户确认 → 3. 编写测试 → 4. 注入测试 → 5. 观察日志 → 6. 清理
```

### 2. 测试模块导入方法
**HTML页面注入**：
```html
<!-- 在页面底部添加测试模块 -->
<script type="module">
    import { runPDFHomeTest, cleanup } from '/src/frontend/test-modules/test-pdf-home-20240823.js';
    
    // 运行测试
    const results = runPDFHomeTest();
    
    // 可选：自动清理
    setTimeout(cleanup, 5000);
</script>
```

**动态导入**：
```javascript
// 通过控制台动态导入测试
const testModule = await import('/src/frontend/test-modules/test-feature.js');
testModule.runTest();
```

## 调试日志规范

### 1. 日志格式标准
```
[TEST] [时间] [模块名] [状态] [消息]
[TEST] [2024-08-23 15:30:00] [PDFHome] [PASS] 页面加载成功
[TEST] [2024-08-23 15:30:01] [PDFHome] [FAIL] 功能X未响应
```

### 2. 关键日志点
- **测试开始**：`[TEST] 开始测试: [测试名称]`
- **步骤记录**：`[TEST] 步骤[N]: [操作描述]`
- **结果验证**：`[TEST] 验证: [预期] vs [实际]`
- **测试完成**：`[TEST] 测试完成: [通过/失败数量]`

## 测试类型标准

### 1. 功能测试
**范围**：验证具体功能是否正常工作
**方法**：
- 模拟用户操作
- 验证DOM状态变化
- 检查事件触发

### 2. 集成测试
**范围**：验证模块间交互
**方法**：
- 测试WebSocket通信
- 验证事件总线工作
- 检查数据流

### 3. UI测试
**范围**：验证界面表现
**方法**：
- 检查元素可见性
- 验证样式应用
- 测试响应式布局

## 错误处理规范

### 1. 测试失败处理
- 记录完整的错误信息
- 提供最小复现步骤
- 不修改非测试代码

### 2. 异常情况记录
```javascript
try {
    // 测试代码
} catch (error) {
    console.error('[TEST] 测试异常:', {
        test: '功能名称',
        error: error.message,
        stack: error.stack,
        context: '测试上下文信息'
    });
}
```

## 测试清理规范

### 1. 必须清理的内容
- 测试添加的DOM元素
- 测试注册的事件监听
- 测试修改的全局状态
- 测试创建的临时数据

### 2. 清理验证
```javascript
function verifyCleanup() {
    const remainingElements = document.querySelectorAll('[data-test]');
    if (remainingElements.length > 0) {
        console.warn('[TEST] 清理不完全:', remainingElements);
    }
    return remainingElements.length === 0;
}
```

## 用户交互规范

### 1. 询问用户时机
- 无现成测试规范时
- 测试可能影响生产数据时
- 需要特殊测试环境时
- 测试结果不确定时

### 2. 询问格式
```
[TEST] 需要用户确认：
- 测试目标：[具体描述]
- 测试方法：[计划步骤]
- 预期影响：[可能影响范围]
- 是否执行？[等待用户确认]
```