# PDFViewer pdf-search：Manager 瘦身 + 绑定清理强化（无时间窗）

**功能ID**: 20260111004618-pdfviewer-pdf-search-manager-slim-and-cleanup-D
**优先级**: 中（P1-D：继续压缩面条 & 提升可维护性）
**版本**: v001
**创建时间**: 2026-01-11 00:46:18
**状态**: 设计中

## 目标
- 在已有 DOMManager 基础上继续收敛职责：
  - `SearchManager/SearchBox` 中的 DOM/状态混杂进一步拆分（Manager 只做业务状态与事件编排）
  - 强化 install/uninstall 的 cleanup（绑定、订阅、timer）——不得依赖时间窗（禁止 setTimeout 作为“等一等”）

## 约束条件（严格代码隔离：必须遵守）
### scope（只允许改这些）
- `src/frontend/pdf-viewer/features/pdf-search/**`
- `todo-and-doing/1 doing/20260111004618-pdfviewer-pdf-search-manager-slim-and-cleanup-D/working-log.md`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`、`src/frontend/pdf-viewer/assets/**`、`scripts/ci/**`
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`

### 自检（提交前必须执行并贴到 working-log）
- `git diff --name-only main..HEAD` 结果必须全部落在上述 scope 内；否则视为未完成（必须重提）。

## 可行验收标准（DoD）
- 必须提交 git，并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) install→uninstall→install：DOM bindings 不重复（计数/spy）
  2) 不存在时间窗依赖（不允许用 setTimeout 兜底初始化）
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅
