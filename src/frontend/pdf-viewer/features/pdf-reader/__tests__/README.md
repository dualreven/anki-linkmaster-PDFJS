# PDF-Reader功能域单元测试

## 📋 测试概述

本目录包含pdf-reader功能域的单元测试和集成测试，验证核心PDF处理功能的正确性。

## 🧪 测试文件

### 1. `pdf-loader.test.js` - PDFLoader单元测试

**测试覆盖**:
- ✅ 构造函数初始化
- ✅ 从URL加载PDF
- ✅ 从ArrayBuffer加载PDF
- ✅ 从Blob加载PDF
- ✅ 加载配置参数验证
- ✅ 加载进度事件
- ✅ 取消加载任务
- ✅ 资源清理和销毁

**测试数量**: 10个测试
**覆盖功能**: PDF文档加载的所有主要路径

### 2. `page-cache-manager.test.js` - PageCacheManager单元测试

**测试覆盖**:
- ✅ 构造函数和配置
- ✅ 添加页面到缓存
- ✅ LRU缓存策略
- ✅ 获取缓存页面
- ✅ 访问时间更新
- ✅ 缓存清理
- ✅ 预加载页面判断
- ✅ 清空所有缓存
- ✅ 统计信息
- ✅ 资源销毁

**测试数量**: 15个测试
**覆盖功能**: 页面缓存管理的完整生命周期

### 3. `pdf-manager-integration.test.js` - PDFManager集成测试

**测试覆盖**:
- ✅ 初始化流程
- ✅ PDF加载流程（URL/filename）
- ✅ 自动添加.pdf扩展名
- ✅ 加载失败重试机制
- ✅ 获取PDF页面
- ✅ 页面缓存功能
- ✅ 文档信息获取
- ✅ 总页数查询
- ✅ 关闭PDF
- ✅ 缓存清理
- ✅ 资源销毁

**测试数量**: 16个测试
**覆盖功能**: PDFManager与子组件的集成

## 📊 测试统计

| 组件 | 测试数量 | 预估覆盖率 | 状态 |
|------|---------|-----------|------|
| PDFLoader | 10 | ~90% | ✅ |
| PageCacheManager | 15 | ~95% | ✅ |
| PDFManager | 16 | ~85% | ✅ |
| **总计** | **41** | **~90%** | ✅ |

## 🚀 运行测试

### 运行所有测试
```bash
npm test -- pdf-reader
```

### 运行特定测试文件
```bash
npm test -- pdf-loader.test.js
npm test -- page-cache-manager.test.js
npm test -- pdf-manager-integration.test.js
```

### 查看覆盖率报告
```bash
npm test -- --coverage pdf-reader
```

## 📝 待补充测试

### 优先级1: Services层单元测试
- [ ] `file-service.test.js` - 文件加载处理测试
- [ ] `navigation-service.test.js` - 页面导航测试
- [ ] `zoom-service.test.js` - 缩放控制测试
- [ ] `pdf-document-service.test.js` - 文档管理测试

### 优先级2: 功能域集成测试
- [ ] `pdf-reader-feature.test.js` - PDFReaderFeature完整测试
- [ ] StateManager集成测试
- [ ] ScopedEventBus事件测试

### 优先级3: 端到端测试
- [ ] 完整PDF加载流程
- [ ] 页面导航流程
- [ ] 缩放操作流程

## 🔍 测试最佳实践

### 1. Mock策略
- 使用`jest.fn()`创建mock函数
- 使用`jest.unstable_mockModule()`mock ES模块
- 隔离外部依赖（PDF.js、EventBus等）

### 2. 测试结构
```javascript
describe('组件名', () => {
  let component;
  let mockDependencies;

  beforeEach(() => {
    // 初始化mock和组件
  });

  describe('功能组1', () => {
    it('应该正确处理场景A', () => {
      // 测试逻辑
    });
  });
});
```

### 3. 断言原则
- 测试行为而非实现
- 验证关键输入输出
- 检查副作用（事件、状态变化）
- 覆盖边界条件和错误情况

## 🐛 已知问题

1. **PDF.js Mock限制**
   - 当前使用简化的PDF.js mock
   - 实际运行时行为可能略有差异
   - 建议补充真实PDF.js的集成测试

2. **异步测试**
   - 注意async/await的正确使用
   - 确保所有Promise都被正确等待

## 📚 参考资料

- [Jest文档](https://jestjs.io/docs/getting-started)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
- [测试驱动开发最佳实践](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

**创建日期**: 2025-10-02
**维护者**: AI Assistant
**最后更新**: 2025-10-02
