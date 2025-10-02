# 阶段 2 测试指南

## 已完成的工作

### 1. 创建 PDFHomeAppV2 核心类 ✅
- **文件**: `core/pdf-home-app-v2.js` (440 行)
- **功能**:
  - 集成所有 6 个架构组件
  - 自动 Feature Flag 加载
  - 自动功能域注册和安装
  - 动态启用/禁用功能
  - 完整生命周期管理

### 2. 创建新启动程序 ✅
- **文件**: `bootstrap/app-bootstrap-v2.js`
- **功能**:
  - 解析 WebSocket 端口
  - 创建 PDFHomeAppV2 实例
  - 初始化应用
  - 暴露全局 API（向后兼容 V1）
  - 错误处理

### 3. 创建 Feature Flag 配置 ✅
- **文件**: `config/feature-flags.json`
- **配置**:
  - `pdf-list`: enabled (稳定功能)
  - `pdf-editor`: disabled (开发中)
  - `pdf-sorter`: disabled (开发中)
- **环境支持**: development, test, production

### 4. 修改入口文件支持双模式 ✅
- **文件**: `index.js`
- **功能**:
  - 自动检测架构版本（URL 参数 > localStorage > 默认 V1）
  - 双模式启动支持
  - 全局切换函数 `window.switchArchitecture()`

---

## 测试步骤

### 前置条件
确保后端服务正在运行：
```bash
# 使用 ai-launcher
python ai-launcher.py start

# 或者直接启动后端
cd src/backend && python main.py --module pdf-home
```

### 测试 1: V1 架构（默认模式）

1. 启动前端开发服务器：
```bash
npm run dev
```

2. 打开浏览器访问：
```
http://localhost:3003/pdf-home/
```

3. 打开开发者工具（F12），查看控制台输出，应该看到：
```
[DEBUG] Architecture: v1 (default)
[DEBUG] Using V1 (Legacy Architecture)
```

4. 检查 `window.app`：
```javascript
window.app.getState()
// 应该返回旧架构的状态
```

5. 检查全局变量：
```javascript
window.PDF_HOME_ARCHITECTURE
// 应该返回 "v1"
```

### 测试 2: V2 架构（URL 参数切换）

1. 访问：
```
http://localhost:3003/pdf-home/?arch=v2
```

2. 查看控制台输出，应该看到：
```
[DEBUG] Architecture from URL parameter: v2
[DEBUG] Using V2 (Feature Domain Architecture)
[DEBUG] Creating PDFHomeAppV2 with options: ...
[DEBUG] Starting app V2 initialization...
[DEBUG] Loading Feature Flags...
[DEBUG] Feature Flags loaded from config file
[DEBUG] Feature Flags: 1/3 enabled
[DEBUG] Registering features...
[DEBUG] 3 features registered
[DEBUG] Installing enabled features...
[DEBUG] Feature installed: pdf-list
[DEBUG] 1/3 features installed
```

3. 检查 `window.app`：
```javascript
window.app.getState()
// 应该返回：
// {
//   version: 'v2',
//   status: 'ready',
//   architecture: 'feature-domain',
//   features: {
//     registered: ['pdf-list', 'pdf-editor', 'pdf-sorter'],
//     installed: ['pdf-list'],
//     flags: { ... }
//   },
//   ...
// }
```

4. 测试 V2 特有 API：
```javascript
// 查看已安装功能
window.app.getRegistry().getInstalledFeatures()
// 返回: ['pdf-list']

// 查看所有功能
window.app.getRegistry().getRegisteredFeatures()
// 返回: ['pdf-list', 'pdf-editor', 'pdf-sorter']

// 获取功能详情
window.app.getRegistry().get('pdf-list')
// 返回功能实例

// 查看 Feature Flags
window.app.getFeatureFlagManager().getAllFlags()
// 返回所有 Feature Flag 配置

// 查看状态管理器
window.app.getStateManager()
// 返回状态管理器实例
```

### 测试 3: 动态启用功能

```javascript
// 启用 pdf-editor（当前是禁用的）
await window.app.enableFeature('pdf-editor')

// 检查是否已安装
window.app.getRegistry().getInstalledFeatures()
// 返回: ['pdf-list', 'pdf-editor']

// 禁用功能
await window.app.disableFeature('pdf-editor')

// 再次检查
window.app.getRegistry().getInstalledFeatures()
// 返回: ['pdf-list']
```

### 测试 4: localStorage 切换

1. 在控制台执行：
```javascript
window.switchArchitecture('v2')
```

2. 页面会自动刷新，刷新后应该使用 V2 架构

3. 切换回 V1：
```javascript
window.switchArchitecture('v1')
```

4. 清除设置：
```javascript
localStorage.removeItem('pdf-home-architecture')
location.reload()
```

---

## 预期结果

### V2 架构启动成功的标志

1. ✅ 控制台没有错误
2. ✅ `window.PDF_HOME_ARCHITECTURE === 'v2'`
3. ✅ `window.app._version === 'v2'`
4. ✅ `window.app.getState().version === 'v2'`
5. ✅ Feature Flag 配置加载成功
6. ✅ pdf-list 功能自动安装
7. ✅ WebSocket 连接成功（如果后端运行）

### V2 架构特有 API 可用

- ✅ `window.app.enableFeature(name)`
- ✅ `window.app.disableFeature(name)`
- ✅ `window.app.getRegistry()`
- ✅ `window.app.getStateManager()`
- ✅ `window.app.getFeatureFlagManager()`
- ✅ `window.app.getContainer()`

---

## 常见问题排查

### 问题 1: Feature Flag 加载失败

**错误信息**:
```
Failed to load feature-flags.json, using defaults
```

**原因**: Feature Flag 配置文件路径不正确

**解决方案**:
1. 确认 `config/feature-flags.json` 文件存在
2. 检查文件路径是否正确（相对于 HTML 文件）
3. 检查浏览器网络面板，查看请求是否 404

### 问题 2: 功能域安装失败

**错误信息**:
```
Failed to install feature pdf-list: ...
```

**原因**: 功能域依赖缺失或初始化错误

**解决方案**:
1. 检查控制台详细错误信息
2. 确认依赖注入容器已正确注册全局服务
3. 检查功能域 `install()` 方法实现

### 问题 3: WebSocket 连接失败

**错误信息**:
```
WebSocket connection failed
```

**原因**: 后端服务未启动

**解决方案**:
```bash
cd src/backend
python main.py --module pdf-home
```

### 问题 4: 模块导入错误

**错误信息**:
```
Failed to load module ... relative import path ... doesn't exist
```

**原因**: 模块路径错误

**解决方案**:
1. 检查导入路径是否正确
2. 确认文件确实存在
3. 检查文件扩展名（必须包含 `.js`）

---

## 性能检查

### 启动时间基准

- **V1 架构**: ~200-300ms
- **V2 架构**: ~250-350ms（增加约 50ms，因为需要加载 Feature Flag 和注册功能域）

### 内存占用基准

- **V1 架构**: ~8-10MB
- **V2 架构**: ~10-12MB（增加约 2MB，因为有更多架构组件）

### 检查方法

打开浏览器开发者工具 → Performance 面板 → 录制页面加载：
1. 刷新页面
2. 停止录制
3. 查看 "Loading" 阶段耗时
4. 查看 "Scripting" 阶段耗时

---

## 下一步

测试通过后，进入阶段 3：将现有 PDF 列表功能迁移到 `PDFListFeature`。

详见：[MIGRATION.md](./MIGRATION.md) 阶段 3。
