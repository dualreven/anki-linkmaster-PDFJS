**规范名称**: 前端测试环境规范
**规范描述**: 定义前端测试的技术栈和环境状态，基于 Vite + ai_launcher.py + debug（后端调试通道）体系，利用热更新特性进行测试。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 构建工具：Vite（支持热模块替换）
- 启动入口：`ai_launcher.py`（统一编排 Vite、WebSocket、HTTP 文件服务与前端模块）
- 调试通道：后端 debug 通道（产生日志 `debug-console-at-[端口号].log`）
- 监控方式：实时查看 `logs/` 下相关日志与 `runtime-ports.json`
- 环境状态：Vite dev server 与后端由 `ai_launcher.py start --module <...> --logs-dir logs` 管理；禁止直接运行 `npm run dev`、`python app.py`

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
// 不确认 Vite/ai_launcher.py 后台服务与调试通道是否正常

