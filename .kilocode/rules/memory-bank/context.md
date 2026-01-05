# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-05 前端架构重构：Observable Pattern 落地 (完成)
- **基建**：`observable.js` + `observable.test.js` (100% pass).
- **Core 迁移**：`ZoomManager`, `LayoutManager`, `ViewerManager` (Completed).
- **Feature 迁移**：`SearchManager`, `OutlineManager`, `SidebarManager`, `AnnotationManager V2` (Completed).

## 2026-01-05 修复与加固
- **AnnotationFeature**: 修复了方法缺失、路径错误、测试冲突、模型校验等问题。全量测试通过。
- **OutlineFeature**: 修复了 `app-bootstrap-feature.js` 的导入错误。

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor).
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过.
