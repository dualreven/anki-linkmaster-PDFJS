# PDFViewer pdf-annotation ScreenshotTool store-reactive 推进（C）规格说明

**功能ID**: 20260111140159-pdfviewer-annotation-screenshot-store-reactive-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 14:01  
**状态**: 进行中

## 现状说明
- pdf-annotation 侧已逐步推进 tools 的 store-reactive（以 store 状态驱动渲染），但 ScreenshotTool 仍存在“事件驱动残留/双驱动风险”。

## 存在问题
- 当状态变化路径不经过某些 CRUD 事件时，事件驱动渲染可能不同步；维护者容易误判“必须 emit 某事件”才能刷新。
- 面条化风险点在于：订阅散落、渲染触发条件不一致、卸载清理难以证明。

## 提出需求（目标）
1) 推进 ScreenshotTool 的 marker 渲染/恢复为 store-reactive（以 `annotationManager.store`/同等 store 为真源）。  
2) 清理/下沉事件依赖：若仍需事件，仅保留为“触发重算/刷新”的薄信号，并在代码中明确其非真源。  
3) 补 1 条防回归测试：覆盖“store 变化 → marker 渲染跟随 + uninstall 后不残留订阅/监听”。

## 非目标（本任务不做）
- 不调整 Annotation 模型真源位置（避免与历史 P0 反复拉扯）。
- 不修改 pdf-annotation 之外的 feature。

## 约束条件（硬规则）
### 仅修改本模块代码（严格隔离）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/adapters/**`
  - `src/frontend/pdf-viewer/bootstrap/**`
  - `src/frontend/pdf-viewer/features/infra-ui/**`
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`

### 必须遵循模块规范
先阅读并遵守：
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) **必须 git 提交**并提供 commit hash。  
2) **必须自验通过**：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新：
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-annotation-screenshot-store-reactive-C/working-log.md`
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-annotation-screenshot-store-reactive-C/report.md`

