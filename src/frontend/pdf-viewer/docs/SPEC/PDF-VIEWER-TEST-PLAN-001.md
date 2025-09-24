**规范名称**: PDF查看器测试计划规范
**规范描述**: 定义PDF查看器测试计划规范，包括测试类型、覆盖要求、调试步骤、CI指令、mock策略和日志收集。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: PDF查看器测试活动

**详细内容**:
- 测试类型：包含单元测试、集成测试和端到端测试
- 覆盖要求：核心功能单元测试覆盖率不低于80%
- 调试步骤：详细的测试调试流程和问题排查方法
- CI指令：持续集成环境中的测试执行指令
- mock策略：外部依赖的mock实现策略
- 日志收集：测试日志通过[TEST]前缀进行监控和收集

**验证方法**:
- 检查单元测试是否覆盖核心功能，覆盖率不低于80%
- 验证集成测试是否覆盖模块间交互
- 测试端到端测试是否模拟真实用户场景
- 确认测试日志通过[TEST]前缀可监控，并作为CI失败判据
- 运行完整的测试套件验证测试计划有效性

**正向例子**:
```javascript
// 单元测试示例 - 测试PDF页面渲染
describe('PDFCanvas', () => {
  it('should render PDF page correctly', async () => {
    const page = await renderPDFPage(1);
    expect(page).toBeDefined();
    expect(page.canvas).toBeInstanceOf(HTMLCanvasElement);
  });
});

// 集成测试示例 - 测试组件间交互
describe('PDFViewer integration', () => {
  it('should handle page navigation events', () => {
    const viewer = renderPDFViewer();
    simulatePageChange(2);
    expect(viewer.currentPage).toBe(2);
  });
});

// 测试日志
console.log('[TEST] Starting PDF rendering test suite');
```

**反向例子**:
```javascript
// 测试覆盖率不足
// 缺少对核心功能的测试覆盖

// 无集成测试
// 只测试单个组件，不测试组件间交互

// 测试日志不规范
console.log('test started'); // 缺少[TEST]前缀

// 无mock策略
// 测试依赖真实的外部服务，导致测试不稳定