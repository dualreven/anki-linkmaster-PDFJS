# PDF-Home UI管理器规范

## 概述
PDF-Home模块使用独立的UI管理器，专门负责PDF列表管理的用户界面功能。

## 职责范围

### 核心职责
- PDF列表表格的渲染和管理
- 用户操作按钮的事件处理（添加、删除、批量操作）
- 与PDF表格组件（Tabulator）的集成
- 全局事件监听（PDF列表更新、WebSocket连接状态）
- 调试界面管理

### 不包含的职责
- PDF查看器的UI控制（由pdf-viewer模块管理）
- 通知系统（使用DOMUtils的全局方法）
- 进度条显示（使用DOMUtils的全局方法）

## 架构设计

```javascript
class UIManager {
  // 状态管理
  #state = {
    pdfs: [],
    loading: false,
    websocketConnected: false,
    error: null
  }

  // DOM元素引用
  #elements = {
    container: null,
    addPdfBtn: null,
    batchDeleteBtn: null,
    pdfTableContainer: null,
    ...
  }

  // 依赖
  #eventBus: EventBus
  #logger: Logger
  #pdfTable: TableWrapper (注入)
}
```

## 关键设计原则

### 1. 模块独立性
- 只负责PDF-Home的UI逻辑
- 不依赖pdf-viewer的任何组件
- 通过事件总线与其他模块通信

### 2. 表格组件集成
- 接受外部注入的表格实例（TableWrapper）
- 支持多种表格操作API
- 处理表格数据变化和用户交互

### 3. 事件驱动
- 监听PDF列表更新事件
- 发出用户操作事件
- 处理WebSocket连接状态变化

## 核心功能

### 表格管理
- 初始化和配置PDF表格
- 处理表格数据变化
- 管理空状态显示

### 用户交互
- 单个PDF添加/删除
- 批量删除操作
- PDF打开请求
- 快捷键支持（Ctrl+N添加，Ctrl+D调试）

### 状态同步
- 实时更新PDF列表
- 反映加载状态
- 显示连接状态

## 使用示例

```javascript
// PDFHomeApp中的使用
const uiManager = new UIManager(eventBus);

// 注入表格实例
uiManager.pdfTable = tableWrapper;

// 初始化
await uiManager.initialize();
```

## 扩展性

### 添加新功能
1. 在#elements中添加DOM元素引用
2. 在#setupEventListeners中添加事件处理
3. 在#render中更新UI状态

### 自定义表格操作
- 通过注入的表格实例调用API
- 监听表格事件并响应
- 保持与全局状态的同步

## 注意事项

1. **表格注入**：UIManager依赖外部注入的表格实例，不应自己创建
2. **事件命名**：使用标准的事件常量，避免硬编码
3. **状态管理**：保持状态与UI的同步更新
4. **清理工作**：在destroy时正确清理所有事件监听器