# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地 (进度：100% Core + Major Features)
- **基建**：`observable.js` + `observable.test.js` (100% pass).
- **Core 迁移**：
  - `ZoomManager` / `LayoutManager` / `ViewerManager` (Completed).
- **Feature 迁移**：
  - `SearchManager` (Completed).
  - `OutlineManager` (Completed).
  - `SidebarManager` (Completed).
  - `AnnotationManager` (Completed).
    - `core/annotation-manager.js` (Legacy) -> Deleted.
    - `core/annotation.manager.v2.js` (Observable) -> Implemented.
    - `Annotation.js` model updated to support partial updates validation.

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor).
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过.
