**规范名称**: 前端测试工具规范
**规范描述**: 定义前端测试的工具和环境检查规范，包括环境检查函数和测试模块模板，确保测试工具的一致性和可用性。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 提供环境检查工具函数，检查vite、eventBus、WebSocket等状态
- 测试模块必须放在 `src/frontend/test-modules/` 目录
- 测试模块文件名格式：`test-[功能]-[日期].js`
- 测试模块必须包含 `runTest()` 和 `cleanup()` 函数

**正向例子**:
```javascript
// 环境检查工具
export function checkFrontendEnv() {
    return {
        timestamp: new Date().toISOString(),
        vite: !!window.__vite_plugin_react_preamble_installed__,
        eventBus: !!window.eventBus,
        ws: window.wsClient?.isConnected() || false,
        debug: true // debug-console-at-[端口号].log始终可用
    };
}

// 测试模块模板
export function runTest() {
    console.log('[TEST] 测试开始');
    // 测试代码
}

export function cleanup() {
    // 清理代码
}
```

**反向例子**:
```javascript
// 错误做法：无环境检查，直接测试
// 测试模块位置随意，无标准格式
// 缺少清理函数，可能导致副作用