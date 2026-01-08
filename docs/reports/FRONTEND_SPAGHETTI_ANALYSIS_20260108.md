# 前端模块“面条代码”现状评估与优化建议

**日期：** 2026-01-08
**评估对象：** `src/frontend/pdf-viewer` 及核心 Feature 模块
**上下文：** 项目正处于从 `EventBus` 事件驱动架构向 `Manager + Store` (ObservableState) 状态驱动架构迁移的过程中。

## 1. 现状总结 (Executive Summary)

经过代码审计，当前前端架构处于 **"混合过渡期"**。

*   **架构演进方向正确：** 已经引入了 `ObservableState` 和 `Feature-based` 架构，明确了 `UI -> Manager -> Store` 的单向数据流目标。
*   **SearchFeature (标杆)：** 已基本完成重构，实现了标准的 Manager+Store 模式，UI 订阅 State 变化，逻辑清晰。
*   **AnnotationFeature (混合态)：** 虽然引入了 Manager 和 Store，但 **UI (Sidebar) 仍然主要依赖 EventBus 事件更新**，尚未真正实现“数据驱动视图”。这导致了 Manager 既要维护 State 也要发射 Event，而 UI 还在处理复杂的事件回调。
*   **EventBus 依赖仍重：** 虽然业务逻辑开始收敛，但组件间的“胶水代码”依然大量依赖 EventBus，导致调用链在 IDE 中难以直接追踪。

## 2. 模块详细分析

### 2.1 基础设施 (`src/frontend/common`)
*   **`ObservableState`**: 实现完善，支持 `subscribe`, `selector`, `fail-fast` 和调试日志，足以支撑业务需求。
*   **`EventBus`**: 依然庞大且功能复杂（支持 Tracing, Validation, Scoping）。这是历史包袱，也是目前模块间通信的必要手段。

### 2.2 搜索模块 (`features/pdf-search`) - ✅ 优秀范例
*   **Manager**: `SearchManager` 内部维护了完整的 `SearchStore`。
*   **UI**: `SearchBox` 在初始化时订阅了 `searchManager.store`。
    *   `isVisible` 状态变化 -> 触发 `show()/hide()`。
    *   `results` 数据变化 -> 触发 `updateResultCounter()`。
*   **优点**: UI 组件不再需要监听 "SEARCH_RESULT_UPDATED" 这种细碎事件，只需响应状态快照。逻辑高度内聚。

### 2.3 标注模块 (`features/pdf-annotation`) - ⚠️ 待优化
*   **Manager**: `AnnotationManager` (v2) 内部有 `AnnotationStore`，正确管理了 CRUD。
*   **UI**: `AnnotationSidebarUI` **没有订阅 Store**。
    *   它依赖 `AnnotationFeature` 入口文件中的 `setupEventListeners` 和 `installAnnotationSidebarSubscriptions` 胶水代码。
    *   它监听 `ANNOTATION.CREATED`, `ANNOTATION.UPDATED` 等事件来增删改 DOM 卡片。
*   **问题**:
    1.  **数据流不一致**: Manager 改了 Store，但 UI 是靠 EventBus 通知更新的。如果 Event 发射漏了，UI 就和 Store 不一致。
    2.  **代码冗余**: Manager 里必须写 `store.set(...)` 紧接着 `eventBus.emit(...)`。
    3.  **复杂性**: UI 类需要处理 "Add", "Update", "Remove" 等多个原子操作，而不是简单地 "Render List"。

## 3. 优化建议 (Action Plan)

为了进一步消除“面条代码”并统一架构，建议执行以下优化：

### 3.1 短期目标：重构 AnnotationFeature UI (高优先级)
**目标：** 让 `AnnotationSidebarUI` 真正变为数据驱动。

1.  **注入 Manager**: 修改 `AnnotationSidebarUI` 构造函数，接收 `AnnotationManager` 实例。
2.  **订阅 State**: 在 `initialize()` 中，订阅 `manager.store` 的 `annotations` 字段。
    ```javascript
    // 伪代码
    this.unsubscribe = this.manager.store.subscribe(
      state => state.annotations,
      (annotations) => this.render(annotations) // 全量/Diff 渲染
    );
    ```
3.  **移除事件监听**: 删除 `AnnotationSidebarUI` 对 `ANNOTATION.CREATED/UPDATED/DELETED` 的直接监听。
4.  **保留 Command**: UI 对用户的操作（如点击删除）依然调用 `manager.deleteAnnotation()`，保持单向流。

### 3.2 中期目标：严格化 EventBus 用途
**目标：** 禁止 Feature **内部** 使用 EventBus 进行逻辑闭环。

*   **规则**:
    *   Feature 内部 (Manager <-> UI): **必须** 使用 ObservableState。
    *   Feature 之间 (e.g. Search -> Nav): **可以使用** EventBus (或直接通过 Container 获取对方 Service)。
    *   应用级 (Lifecycle): **可以使用** EventBus。
*   **执行**: 在 Code Review 中拦截在 Feature 内部定义 `INTERNAL_EVENT` 的行为。

### 3.3 长期目标：UI 组件无状态化
*   目前的 `SearchBox` 和 `AnnotationSidebarUI` 依然保留了一些内部 UI 状态（如 DOM 引用、临时输入状态）。
*   建议进一步将 UI 拆分为纯渲染函数或更细粒度的组件，完全由 Props (State) 驱动，向 React/Vue 的思维模式靠拢（即使不引入框架）。

## 4. 结论

项目没有处于“无法维护”的各种面条代码中，而是处于**架构升级的深水区**。`SearchFeature` 证明了新架构的可行性与优势。接下来的重点应是**将 `AnnotationFeature` 等重型模块的 UI 层彻底接入 State 驱动**，断开 Feature 内部对 EventBus 的依赖，从而彻底根治逻辑碎片化问题。
