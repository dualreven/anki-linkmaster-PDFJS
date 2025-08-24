# PDF-Home 模块 v3 版本说明

## 概述

PDF-Home 模块是 Anki LinkMaster 项目的 PDF 文件管理前端组件，v3 版本基于事件驱动的组合式架构重构，采用模块化设计，实现了业务逻辑、UI 逻辑和环境设置的清晰分离。

## 架构设计

### 核心架构原则
- **组合优于继承**: 使用对象组合而非类继承，降低耦合度
- **事件驱动**: 所有组件通过事件总线进行通信，支持异步加载
- **单一职责**: 每个模块专注于特定功能领域
- **错误边界**: 模块级错误处理，确保系统稳定性

### 目录结构
```
src/frontend/pdf-home/
├── index.html          # 主页面HTML结构
├── index.js            # 应用入口和主协调器
├── style.css           # 样式文件
├── modules/            # 核心功能模块
│   ├── event-bus.js       # 事件总线实现
│   ├── event-constants.js # 事件常量定义
│   ├── error-handler.js   # 错误处理模块
│   ├── ui-manager.js      # UI管理模块
│   ├── pdf-manager.js     # PDF业务逻辑管理
│   └── ws-client.js       # WebSocket客户端
└── utils/              # 工具函数
    ├── logger.js          # 日志记录工具
    └── dom-utils.js       # DOM操作工具
```

## 模块职责详解

### 1. 主应用协调器 ([index.js](index.js:1))
- **职责**: 应用初始化、模块协调、全局错误处理
- **核心功能**:
  - 初始化所有模块并建立依赖关系
  - 设置全局错误处理（未处理的Promise rejection和全局错误）
  - 提供应用状态和诊断信息获取接口
  - 协调模块间的事件通信

### 2. 事件总线 ([modules/event-bus.js](modules/event-bus.js:1))
- **职责**: 模块间通信中枢
- **特性**:
  - 支持事件验证（确保事件名称符合规范）
  - 调试模式支持
  - 多级日志输出
  - 事件订阅和发布机制

### 3. 事件常量 ([modules/event-constants.js](modules/event-constants.js:1))
- **职责**: 统一事件名称定义
- **事件分类**:
  - `APP_EVENTS`: 应用级别事件（初始化、状态变化）
  - `SYSTEM_EVENTS`: 系统事件（错误、警告）
  - `WEBSOCKET_EVENTS`: WebSocket连接事件
  - `PDF_MANAGEMENT_EVENTS`: PDF文件操作事件
  - `UI_EVENTS`: 用户界面交互事件
  - `WEBSOCKET_MESSAGE_EVENTS`: WebSocket消息事件

### 4. 错误处理模块 ([modules/error-handler.js](modules/error-handler.js:1))
- **职责**: 统一错误处理和报告
- **功能**:
  - 错误分类（业务错误、网络错误、系统错误）
  - 错误事件发布
  - 用户友好错误提示
  - 错误日志记录

### 5. UI管理模块 ([modules/ui-manager.js](modules/ui-manager.js:1))
- **职责**: 用户界面管理和交互处理
- **功能**:
  - PDF表格渲染和管理
  - 按钮事件处理（添加、删除、批量操作）
  - 调试面板控制
  - 空状态显示
  - 响应式布局支持

### 6. PDF管理模块 ([modules/pdf-manager.js](modules/pdf-manager.js:1))
- **职责**: PDF文件业务逻辑处理
- **功能**:
  - PDF文件列表获取和缓存
  - 文件添加、删除操作
  - 文件状态管理（选中、排序、筛选）
  - 与后端WebSocket通信协调

### 7. WebSocket客户端 ([modules/ws-client.js](modules/ws-client.js:1))
- **职责**: WebSocket通信管理
- **功能**:
  - 连接建立和维护
  - 消息发送和接收
  - 连接状态管理
  - 错误处理和重连机制

### 8. 工具模块
- **日志工具 ([utils/logger.js](utils/logger.js:1))**: 分级日志记录，支持DEBUG、INFO、WARN、ERROR级别
- **DOM工具 ([utils/dom-utils.js](utils/dom-utils.js:1))**: DOM操作辅助函数，元素创建、事件绑定等

## 事件系统

### 事件命名规范
遵循 `{领域}:{动作}:{状态}` 格式：
- `pdf:load:start` - PDF加载开始
- `pdf:load:success` - PDF加载成功  
- `ui:button:click` - 按钮点击事件
- `sys:websocket:connected` - WebSocket连接建立

### 事件流示例
1. 用户点击"添加PDF"按钮 → 发布 `ui:button:click` 事件
2. UI管理器捕获事件 → 触发文件选择对话框
3. 文件选择完成 → 发布 `pdf:add:start` 事件
4. PDF管理器捕获事件 → 通过WebSocket发送文件到后端
5. 操作完成 → 发布 `pdf:add:success` 或 `pdf:add:error` 事件
6. UI管理器更新界面状态

## 使用用例

### 1. PDF文件管理
- **添加文件**: 通过对话框选择PDF文件，自动上传并刷新列表
- **删除文件**: 选择文件后删除，支持批量操作
- **文件查看**: 显示文件列表，支持排序和筛选

### 2. 调试和监控
- **调试面板**: 显示系统状态、事件日志和错误信息
- **实时监控**: WebSocket连接状态和通信情况
- **错误追踪**: 详细的错误记录和报告

### 3. 系统集成
- **WebSocket通信**: 与后端服务实时数据同步
- **事件驱动**: 支持与其他模块的事件协作
- **状态管理**: 本地状态与服务器状态同步

## 兼容性与性能

### 兼容性
- ✅ QtWebEngine 异步加载支持
- ✅ WebSocket 标准协议
- ✅ 响应式设计（桌面和移动端）

### 性能指标
- 🚀 首次加载时间 < 2秒（目标）
- 💾 内存使用优化
- ⚡ 事件响应延迟 < 100毫秒

## 规范文档

详细的开发规范、架构约束和最佳实践已整理至：
📋 [PDF-Home模块规范文档](docs/SPEC.md)

该文档包含：
- 全局规范映射表
- 架构设计原则
- 事件系统规范
- 开发规范详解
- 文件结构标准
- 兼容性要求

## 快速开始

```javascript
// 初始化应用
const app = new PDFHomeApp();
await app.initialize();

// 获取应用状态
const state = app.getState();

// 获取诊断信息
const diagnostics = app.getDiagnostics();
```

## 总结

v3 版本的 PDF-Home 模块成功实现了重构目标，通过事件驱动的组合式架构，提供了更清晰的结构、更好的可维护性和更稳定的性能。模块化的设计使得各部分职责明确，易于测试和扩展，为后续功能开发奠定了坚实基础。