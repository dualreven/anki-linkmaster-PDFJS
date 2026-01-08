# PDF Anchor Sidebar（AnchorSidebarUI）拆分说明

目标：把 `anchor-sidebar-ui.js` 从“UI+逻辑混杂的面条文件”拆成职责单一模块，并把单文件行数压到 ≤500，同时修复 toolbar 的 `document.click` 监听泄漏。

## 拆分后的文件与职责

- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js`
  - 侧栏生命周期：`initialize()` / `destroy()`
  - 主路径：订阅 `AnchorManager.store(ObservableState)` 渲染（不再依赖 EventBus 原子事件驱动 UI）
  - 兼容路径：允许 `new AnchorSidebarUI(eventBus)` 时启用 EventBus→store legacy bridge（仅用于 UI-only 测试/冒烟）
  - 状态：`#anchors/#selectedId/#activeId/#pdfId/#lastRequestPayload`（均由 store 推导/同步）
  - 装配/委托：toolbar / dialog / table 的 DOM 构造委托给子模块

- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-toolbar.js`
  - 工具栏 DOM：添加/删除/修改/复制下拉/跳转激活/取消激活
  - 复制逻辑：execCommand → Clipboard API → QWebChannel（PyQt 环境）
  - **修复点（方案B）**：注册 `document.addEventListener("click", hideMenu)` 的同时，提供 `cleanup()` 并在 `destroy()` 里 `removeEventListener`，避免泄漏。

- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-dialog.js`
  - 弹窗 DOM：名称/页码/位置输入 + 保存/取消

- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-table.js`
  - 表格 DOM：thead/tbody 构造（列：名称/页码/页内位置/是否激活）

## 回归测试

- `src/frontend/pdf-viewer/features/pdf-anchor/components/__tests__/anchor-sidebar-ui.toolbar-cleanup.test.js`
  - 断言：`destroy()` 会移除 toolbar 注册到 `document` 的 click 监听（同一 handler 引用）。

## 事件常量约束

- 所有 `eventBus.on/emit` 的事件名均来自 `PDF_VIEWER_EVENTS` 命名空间常量，避免触发 `custom/event-name-format`。
