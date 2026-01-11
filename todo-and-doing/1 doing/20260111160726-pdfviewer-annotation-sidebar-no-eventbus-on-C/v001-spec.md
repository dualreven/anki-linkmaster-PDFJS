# PDFViewer pdf-annotation：Sidebar subscriptions 去 components 化（C）规格说明

**功能ID**: 20260111160726-pdfviewer-annotation-sidebar-no-eventbus-on-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 16:07  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js` 仍存在 `eventBus.on(...)`。
- 这属于“components 目录内订阅 EventBus”的面条化高风险点，后续很容易继续堆逻辑回到双驱动。

## 提出需求（目标）
1) 移除 `features/pdf-annotation/components/**` 下的 `eventBus.on(...)`（至少覆盖 sidebar UI 订阅点）。  
2) 订阅必须迁移到 Feature install/uninstall（装配层），或改为 store 驱动（推荐）。  
3) 补 1 条防回归测试：验证 uninstall/destroy 后不残留订阅，并且 sidebar 的关键行为仍可被触发（用最小事件/状态驱动链路验证）。

## 约束条件（硬规则）
### 严格隔离（scope 不可重叠）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/features/ai-assistant/**`

### 必须先读规范
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) 必须 git 提交并提供 commit hash。  
2) 必须自验通过：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新并提交：
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-annotation-sidebar-no-eventbus-on-C/working-log.md`
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-annotation-sidebar-no-eventbus-on-C/report.md`

