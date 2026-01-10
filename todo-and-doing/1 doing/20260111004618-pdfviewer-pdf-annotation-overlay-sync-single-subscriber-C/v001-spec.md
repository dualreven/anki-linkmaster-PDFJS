# PDFViewer pdf-annotation：OverlaySync 单订阅器（消灭多点补画/多点订阅）

**功能ID**: 20260111004618-pdfviewer-pdf-annotation-overlay-sync-single-subscriber-C
**优先级**: 高（P1-C：持续 store-reactive，减少面条分叉点）
**版本**: v001
**创建时间**: 2026-01-11 00:46:18
**状态**: 设计中

## 目标
- 现状：CommentTool / TextHighlightTool 等可能各自订阅 store 做补画，容易出现多个订阅点/多套 diff 逻辑。
- 目标：新增一个 “OverlaySync 单订阅器”：
  - 由 feature 装配层订阅一次 `AnnotationManager.store`（或统一 state 源）
  - 以 annotation type 分发给各工具的 overlay controller（screenshot/text-highlight/comment），避免每个 tool 各写一份订阅逻辑
  - 统一在 uninstall 时清理订阅（Fail-Fast：必须返回 unsubscribe 且必须调用）

## 约束条件（严格代码隔离：必须遵守）
### scope（只允许改这些）
- `src/frontend/pdf-viewer/features/pdf-annotation/**`
- `todo-and-doing/1 doing/20260111004618-pdfviewer-pdf-annotation-overlay-sync-single-subscriber-C/working-log.md`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`、`src/frontend/pdf-viewer/assets/**`、`scripts/ci/**`
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`

### 自检（提交前必须执行并贴到 working-log）
- `git diff --name-only main..HEAD` 结果必须全部落在上述 scope 内；否则视为未完成（必须重提）。

## 可行验收标准（DoD）
- 必须提交 git，并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) 单订阅器：install 后只订阅一次 store；uninstall 后订阅清理（可用 spy/计数断言）
  2) store 更新：三类标注的 overlays 都能被正确委托/恢复（不依赖 DATA.LOADED）
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅
