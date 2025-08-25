**规范名称**: 前端测试环境规范
**规范描述**: 定义前端测试的技术栈和环境状态，基于vite + app.py + debug.py架构，利用热更新特性进行测试。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 构建工具：vite（支持热模块替换）
- 后端服务：app.py（已自动启动）
- 调试工具：debug.py（提供debug-console-at-[端口号].log）
- 监控方式：实时查看debug-console-at-[端口号].log文件
- 环境状态：vite dev server通常已启动，无需AI操作；app.py后端服务已运行；debug.py调试工具已可用；WebSocket已建立连接

**正向例子**:
```javascript
// 检查环境状态
const checkEnv = () => ({
    viteReady: !!window.__vite_plugin_react_preamble_installed__,
    wsConnected: window.wsClient?.isConnected() || false,
    domReady: document.readyState === 'complete'
});
```

**反向例子**:
```javascript
// 错误做法：忽略环境状态检查
// 直接开始测试，可能导致测试失败
// 不确认vite、app.py、debug.py是否正常运行