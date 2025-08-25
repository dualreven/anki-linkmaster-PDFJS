**规范名称**: 前端测试模块注入规范
**规范描述**: 定义前端测试模块的注入规范，包括模块位置、文件名格式和清理要求，确保测试模块化且无副作用。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 测试模块统一放在 `src/frontend/test-modules/` 目录
- 文件名格式：`test-[功能]-[日期].js`
- 必须包含清理函数，避免副作用
- 使用模块注入方式执行测试

**正向例子**:
```javascript
// 在页面中注入测试模块
const script = document.createElement('script');
script.type = 'module';
script.textContent = `
    import { runTest } from '/src/frontend/test-modules/test-feature-20240825.js';
    runTest();
`;
document.body.appendChild(script);
```

**反向例子**:
```javascript
// 错误做法：随意放置测试代码，无模块化
// 直接在页面脚本中写测试代码，难以维护
// 未使用清理函数，可能导致副作用