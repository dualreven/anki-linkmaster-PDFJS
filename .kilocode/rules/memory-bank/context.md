# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地 (完成)
- **基建**：`observable.js` + `observable.test.js` (100% pass).
- **Core 迁移**：`ZoomManager`, `LayoutManager`, `ViewerManager` (Completed).
- **Feature 迁移**：`SearchManager`, `OutlineManager`, `SidebarManager`, `AnnotationManager V2` (Completed).
- **架构优势**：
  - **Single Source of Truth**：所有业务状态收敛于 Managers.
  - **Reactive View**：UI 组件通过 Selector 订阅状态，实现数据驱动.
  - **Unidirectional Data Flow**：View -> Manager (Action) -> Store (State) -> View (Re-render).
  - **Interop**：保持了对旧 EventBus 事件的兼容，支持 Hybrid 模式.

## 2026-01-05 修复与加固
- 修复了 `AnnotationManager V2` 的路径错误、方法遗漏和测试冲突问题.
- 完成了对 `SearchBox`, `OutlineSidebarUI`, `SidebarManagerFeature`, `AnnotationFeature` 的深度改造.
- 全量 Jest 测试回归通过 (26/26 Annotation Suites).

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor).
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过.