# PDFViewer 面条化扫描报告 (B - infra-ui/infra-sidebar)

**报告ID**: `20260108213300-pdfviewer-scan-B`  
**生成时间**: 2026-01-08 21:33:00  
**扫描范围**:
- `src/frontend/pdf-viewer/features/infra-ui/**`
- `src/frontend/pdf-viewer/features/infra-sidebar/**`

## 1. 命令清单

```bash
# 无法在当前环境执行 rg, 使用 search_file_content 代替
# rg -n "eventBus\.(on|onGlobal|once)\( " src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S
# rg -n "addEventListener\(|removeEventListener\(" src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S
# rg -n "setTimeout\(|setInterval\(" src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S

pnpm -s run lint
```

## 2. 风险清单 (P0/P1/P2)

### P0：严重风险（内存泄漏、运行时错误）

1.  **风险**: `setTimeout` 未清理，导致内存与逻辑泄漏。
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/index.js:88`
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/index.js:97`
    - **描述**: `SidebarManager` 中的两个 `setTimeout` (`t1`, `t2`) 没有在任何销毁或卸载逻辑中被 `clearTimeout` 清理。当 Sidebar 实例被销毁重建时，这些计时器会继续存在，可能导致意外的 UI 更新或错误。

2.  **风险**: `document` 级别事件监听器未在组件销毁时完全清理。
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/index.js:467` (`addEventListener("mousemove")`)
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/index.js:488` (`addEventListener("mouseup")`)
    - **描述**: `SidebarManager` 的侧边栏宽度拖拽功能，在 `mousedown` 时向 `document` 注册 `mousemove` 和 `mouseup` 事件。虽然 `mouseup` 事件会清理自身和 `mousemove`，但如果 `SidebarManager` 在拖拽过程中（`mousedown`之后，`mouseup`之前）被销毁，这两个事件监听器将永远留在 `document` 上，造成内存泄漏和潜在的 CPU 浪费。

### P1：高度风险（职责混杂、强耦合）

1.  **风险**: “万能”事件处理中心，高度耦合。
    - **文件**: `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-ui-controls.js`
    - **文件**: `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-event-listeners.js`
    - **描述**: 这两个文件是典型的“面条代码”核心。它们合计订阅了超过 15 个不同的 `eventBus` 事件，涵盖了缩放、导航、页面状态、文件加载、标注状态等多个不相关的领域。这使得：
        - **逻辑难以追踪**：很难确定一个UI行为是由哪个事件触发的。
        - **维护成本高**：修改任何一个相关功能，都可能影响到这个文件的逻辑。
        - **测试困难**：需要模拟大量事件才能覆盖其全部分支。
    - **关联**：`ui-manager-core-ui-controls.js:22, 27, 32, 36, 40, 79, 87, 96, 145, 152`, `ui-manager-core-event-listeners.js:28, 53, 64, 105, 125, 142, 172`

2.  **风险**: UI 交互逻辑与应用状态管理逻辑混杂。
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/index.js`
    - **描述**: `SidebarManager` 同时承担了 **UI 交互**（处理 resizer 的 `mousedown`/`mousemove` 事件）和 **应用状态协调**（订阅 `eventBus` 的 `TOGGLE_REQUESTED`, `OPEN_REQUESTED` 等事件）。这违反了单一职责原则，使得模块功能臃肿且难以理解。

### P2：中度风险（代码异味、潜在 Bug）

1.  **风险**: 命令式 DOM 操作与事件绑定。
    - **文件**: `src/frontend/pdf-viewer/features/infra-ui/components/ui-zoom-controls.js`
    - **描述**: 该组件通过 `addEventListener` 手动为多个按钮绑定和解绑事件。虽然存在 `destroy` 方法进行清理，但这种命令式的代码风格比声明式（如模板事件绑定）更冗长且更容易出错。其中包含的 `setTimeout`（`L236`, `L249`）用于 UI 反馈，虽然风险不高，但也增加了代码的复杂性。

2.  **风险**: 跨 Feature 的 EventBus 依赖。
    - **文件**: `src/frontend/pdf-viewer/features/infra-sidebar/pdf-layout-adapter.js:46`
    - **描述**: 订阅 `SIDEBAR_MANAGER.LAYOUT_UPDATED` 事件。虽然这是 EventBus 的一个合理用途（用于跨 Feature 通信），但它也创建了一个隐式的依赖关系。随着系统复杂性增加，这类依赖会让数据流变得难以预测。在可能的情况下，应优先考虑更显式的数据流（如 props 或 store 订阅）。

## 3. 建议拆分点

1.  **拆分 `SidebarManager` 的 Resizer 逻辑**
    - **建议**: 创建一个独立的、可复用的 `DraggableResizer` UI 组件。
    - **职责**: 该组件应完全封装 `mousedown`, `mousemove`, `mouseup` 的事件处理，管理自身的 DOM 监听器生命周期，并在尺寸变化时仅对外派发一个 `dimensionChange` 事件。
    - **收益**: `SidebarManager` 不再关心 DOM 细节，只消费 `dimensionChange` 事件，变得更轻、更专注。P0 的事件泄漏风险也随之转移到这个可独立测试的组件中。

2.  **拆分 `ui-manager-core-*` 的巨型事件处理器**
    - **建议**: 废除 `ui-manager-core-ui-controls.js` 和 `ui-manager-core-event-listeners.js` 中的 `eventBus.on` 模式。
    - **步骤**:
        1.  将这些模块改造为“哑”组件或服务，只暴露**公开方法**（如 `updateZoom(scale)`, `updatePage(pageNumber)`）。
        2.  将所有的 `eventBus` 订阅逻辑**上移**到 `infra-ui` Feature 的入口/编排层。
        3.  在编排层中，订阅事件，然后调用这些“哑”组件的公开方法。
    - **收益**: 实现了控制反转（IoC），使得 UI 组件不再依赖全局事件总线，数据流变为“单向”（`Event -> Feature Root -> Component Method`），极大提高代码的可读性和可维护性。

## 4. 回归测试建议

- **场景**: 防止 `SidebarManager` 的 `document` 事件监听器泄漏。
- **测试用例**: `SidebarManager should clean up document listeners on destroy, even during a drag operation`
- **实现**:
    1.  **Setup**: 初始化 `SidebarManager`，并 spying `document.removeEventListener`。
    2.  **Act**:
        - 模拟在 resizer 句柄上触发 `mousedown` 事件。
        - 在不触发 `mouseup` 的情况下，立即调用 `sidebarManager.destroy()`。
    3.  **Assert**:
        - 断言 `document.removeEventListener` 至少被调用了两次。
        - 验证一次调用是为了移除 `mousemove` 监听器，另一次是为了移除 `mouseup` 监听器。
- **目的**: 该测试能精确捕捉到 P0 中描述的内存泄漏场景，确保销毁逻辑的健壮性。

