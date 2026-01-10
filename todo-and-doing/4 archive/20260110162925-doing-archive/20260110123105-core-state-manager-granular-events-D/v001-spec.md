# [pdf-viewer][D][P2] core：StateManager 事件粒度化（batchUpdate / field-changed）

**功能ID**: 20260110123105-core-state-manager-granular-events-D  
**优先级**: 低（P2，非阻断，但能显著降噪）  
**版本**: v001  
**创建时间**: 2026-01-10 12:31:05  
**预计完成**: 2026-01-13  
**状态**: 开发中  
**负责分支**: `worker/refactor-D`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-D`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
- 发现：`StateManager` 频繁对 `STATE.CHANGED` 广播整份快照，订阅者被迫自行 diff，页面切换会“灌”多次事件，增加耦合与调试成本。

## 目标
1) 提供批量更新能力（例如 `batchUpdate(updates)`），多字段更新只发一次（或可配置）事件。
2) 为订阅者提供更细粒度的事件（例如 `STATE.FIELD_CHANGED`），避免所有人都订阅全量快照。
3) 保持兼容：现有订阅 `STATE.CHANGED` 的行为不应被破坏（若需变更，必须先加迁移层与测试）。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/core/**` 相关最小文件集
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：不允许 silently ignore 非法字段。

## 必须新增回归测试（至少 1 条）
- 建议覆盖：
  1) `batchUpdate` 多字段只触发一次 `STATE.CHANGED`；
  2) `FIELD_CHANGED` 携带字段名与新值，且不会漏发/重复发。

## 验收（DoD）
- 必须提交到 `worker/refactor-D`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

