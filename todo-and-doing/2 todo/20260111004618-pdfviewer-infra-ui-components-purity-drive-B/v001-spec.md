# PDFViewer infra-ui：组件纯度提升（订阅全部上移）+ 回归扩展

**功能ID**: 20260111004618-pdfviewer-infra-ui-components-purity-drive-B
**优先级**: 高（P1-B：继续拆掉“巨型事件中心”回潮点）
**版本**: v001
**创建时间**: 2026-01-11 00:46:18
**状态**: 设计中

## 目标
- 进一步提升 infra-ui “组件纯度”：
  - `components/**` 只做纯方法/纯状态，不直接订阅 app eventBus（已存在门禁趋势，但本任务要完成迁移收尾）
  - 所有订阅集中在 `subscriptions/**`，并由 coordinator 装配
- 清理 infra-ui 内残留的 try/catch 兜底与隐式行为（遵循 Fail-Fast 原则）

## 约束条件（严格代码隔离：必须遵守）
### scope（只允许改这些）
- `src/frontend/pdf-viewer/features/infra-ui/**`
- `todo-and-doing/1 doing/20260111004618-pdfviewer-infra-ui-components-purity-drive-B/working-log.md`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`、`src/frontend/pdf-viewer/assets/**`、`scripts/ci/**`
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`

### 自检（提交前必须执行并贴到 working-log）
- `git diff --name-only main..HEAD` 结果必须全部落在上述 scope 内；否则视为未完成（必须重提）。

## 可行验收标准（DoD）
- 必须提交 git，并提供 **commit hash**
- 回归测试（至少 2 条，且要覆盖“迁移结果”）：
  1) coordinator destroy 后订阅全部清理（不再响应事件）
  2) 初始化流程不依赖 `setTimeout`（必须由明确事件驱动）
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅
