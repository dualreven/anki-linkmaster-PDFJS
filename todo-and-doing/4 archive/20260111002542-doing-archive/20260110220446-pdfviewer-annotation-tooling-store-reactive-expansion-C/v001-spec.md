# PDFViewer pdf-annotation：工具层 store-reactive 扩面（TextHighlightTool）

**功能ID**: 20260110220446-pdfviewer-annotation-tooling-store-reactive-expansion-C
**优先级**: 高（P1-C：持续消灭“事件驱动补画”）
**版本**: v001
**创建时间**: 2026-01-10 22:04:46
**状态**: 设计中

## 现状说明
- CommentTool 已完成 store-reactive（上一批已合入）。
- 仍存在其他工具“依赖事件/加载信号补画”的风险（尤其是 TextHighlight）。

## 提出需求
- 将 TextHighlightTool 的 overlays/markers 渲染与恢复，改为完全由 `AnnotationManager.store` 驱动：
  - CRUD 事件可用于写入，但渲染必须来自 state
  - uninstall 必须清理订阅（防泄漏）
  - 禁止静默兜底：缺依赖就抛错/Fail-Fast

## 解决方案（建议）
- 抽出 `*-subscriptions.js` / `*-store-reactive.js` 之类的纯逻辑模块，避免 index.js 继续变大。
- 对 store 变化做 diff（至少按 annotationId 去重），减少重复重绘。

## 约束条件（代码隔离：必须遵守）
### 允许修改的 scope（不允许越界）
- `src/frontend/pdf-viewer/features/pdf-annotation/**`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`（避免与 A 冲突）
- **禁止修改**：`scripts/ci/**`（避免与 E 冲突）
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 规范
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD）
- 必须 `git commit` 并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) store 更新 → overlays/markers 恢复/刷新（不依赖 DATA.LOADED）
  2) uninstall/destroy → 订阅清理（不会继续响应 store 变化）
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅

## 交付格式
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/pdf-viewer/features/pdf-annotation/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
