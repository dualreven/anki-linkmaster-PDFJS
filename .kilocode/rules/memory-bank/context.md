# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地
- **基建**：`observable.js` + `observable.test.js` (100% pass)。
- **规范**：`docs/MIGRATION-EVENTBUS-TO-OBSERVABLE.md`。
- **Pilot 迁移 (Zoom)**：`UIZoomControls` -> `ZoomManager` (已完成)。
- **Phase 2 迁移 (Layout)**：`UILayoutControls` -> `LayoutManager` (已完成)。
  - **Manager**：`src/frontend/pdf-viewer/features/infra-ui/components/layout.manager.js`。
  - **Tests**：`src/frontend/pdf-viewer/features/infra-ui/components/__tests__/layout.manager.test.js` (Pass)。
  - **Refactor**：`UILayoutControls` 作为 View + Driver，负责将 Store 状态应用到 `pdfViewerManager`。

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor)。
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过。
