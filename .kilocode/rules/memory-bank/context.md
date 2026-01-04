# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-02/03 完成：多模块面条治理（≤500）
- FilterBuilder v2, PDFEditFeature, Logger, PDFSorter, FeatureRegistry, TranslatorSidebarUI, AnchorSidebarUI, SearchResults, PDFAnchor, Core Managers 等均已完成拆分治理，全量 JS 单文件 ≤500 行。

## 2026-01-04 修复：viewer 未启动时导航自动启动并待转发
- 修复 `standard_server.py` 支持 `client_socket=None` 触发 auto-launch，并新增测试覆盖。

## 2026-01-05 前端架构重构：Observable Pattern 落地
- **基建**：`observable.js` + `observable.test.js` (100% pass)。
- **规范**：`docs/MIGRATION-EVENTBUS-TO-OBSERVABLE.md`。
- **Pilot 迁移完成**：`UIZoomControls` 迁移至 `ZoomManager`。
  - **Manager**：`src/frontend/pdf-viewer/features/infra-ui/components/zoom.manager.js` (Store + Logic)。
  - **Tests**：`src/frontend/pdf-viewer/features/infra-ui/components/__tests__/zoom.manager.test.js` (Pass)。
  - **Refactor**：UI 组件改为订阅 Manager；EventBus 仅用于 Interop 和 Legacy Bridge。
  - **Wiring**：`ui-manager-core-ui-controls.js` 负责装配和双向同步。

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor)。
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过。