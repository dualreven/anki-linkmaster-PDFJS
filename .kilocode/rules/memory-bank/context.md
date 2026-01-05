# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地 (完成)
- **基建**：`observable.js` + `observable.test.js` (100% pass)。
- **规范**：`docs/MIGRATION-EVENTBUS-TO-OBSERVABLE.md`。
- **Zoom 迁移**：`UIZoomControls` -> `ZoomManager`。
- **Layout 迁移**：`UILayoutControls` -> `LayoutManager`。
- **Core State 迁移**：`UIManagerCore` -> `ViewerManager` (Doc/Page/Loading)。
  - **Cleanup**：删除了 `src/frontend/pdf-viewer/ui/ui-state-manager.js`。
  - **Refactor**：`UIManagerCore` 现仅负责装配 Managers 和 View Drivers (`DOMManager` 等)，单文件行数已降至 < 500。

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor)。
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过。