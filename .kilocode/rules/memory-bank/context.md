# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地 (进度：90%)
- **基建**：`observable.js` + `observable.test.js` (100% pass)。
- **Core 迁移**：
  - `UIZoomControls` -> `ZoomManager`。
  - `UILayoutControls` -> `LayoutManager`。
  - `UIManagerCore` -> `ViewerManager` (Doc/Page/Loading)。
- **Feature 迁移**：
  - `SearchFeature` -> `SearchManager` (Query/Results/Options)。
    - Refactored `SearchBox` to subscribe to `SearchManager` for View updates.
    - Deleted legacy `search-state-manager.js`.
    - Updated `search-box.behavior.test.js` to support new DI.

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor)。
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过。
