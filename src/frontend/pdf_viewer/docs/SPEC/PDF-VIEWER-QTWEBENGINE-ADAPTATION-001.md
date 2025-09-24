**规范名称**: QtWebEngine适配规范
**规范描述**: 定义QtWebEngine适配规范，包括webPreferences配置、preload IPC注入、远程调试端口启用、用户代理处理、字体/打印差异以及版本兼容性。
**当前版本**: 1.0
**所属范畴**: 前端适配规范
**适用范围**: PDF查看器QtWebEngine环境

**详细内容**:
- webPreferences配置：正确设置contextIsolation、nodeIntegration等安全选项
- preload脚本：通过preload实现安全的IPC通信机制
- 远程调试：启用remote-debugging-port支持开发调试
- 版本兼容性：处理不同Qt版本的差异，提供回退策略
- 用户代理：正确处理QtWebEngine的特殊用户代理字符串

**验证方法**:
- 检查webPreferences配置是否正确，包括contextIsolation、nodeIntegration等设置
- 验证preload脚本是否能安全实现IPC通信
- 测试remote-debugging-port是否能正常启用并进行调试
- 确认不同Qt版本（5.15和6.5）的兼容性处理
- 运行跨版本测试验证回退策略有效性

**正向例子**:
```typescript
// 正确的webPreferences配置
const webPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  preload: path.join(__dirname, 'preload.js')
};

// 安全的preload IPC
const { ipcRenderer } = require('electron');
ipcRenderer.on('pdf-event', (event, data) => {
  // 安全处理IPC消息
});

// 版本兼容性检测
const isQt6 = navigator.userAgent.includes('QtWebEngine/6');
const isQt5 = navigator.userAgent.includes('QtWebEngine/5');
```

**反向例子**:
```typescript
// 不安全的webPreferences
const unsafePreferences = {
  contextIsolation: false, // 安全风险
  nodeIntegration: true,   // 安全风险
  webSecurity: false       // 安全风险
};

// 不安全的IPC通信
// 直接暴露Node.js API到渲染进程

// 无版本兼容性处理
// 假设所有环境行为一致，导致兼容性问题