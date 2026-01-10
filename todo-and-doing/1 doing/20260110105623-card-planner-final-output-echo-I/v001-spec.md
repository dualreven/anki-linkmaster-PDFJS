# [card-planner][I] MsgCenter：Final Output completed 回执回显 payload（便于人工验收）

**功能ID**: 20260110105623-card-planner-final-output-echo-I  
**优先级**: 中（验收便利性）  
**版本**: v001  
**创建时间**: 2026-01-10 10:56:23  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-I`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-I`）

## 背景
当前后端 handler `card-planner:final-output:requested` 已实现并返回 completed/failed，但 completed 回执仅返回 count，人工难以确认“后端实际接收并校验的 cards 内容”。

在没有下游“真正制卡程序”的阶段，为了人工验收，需要让回执更可观察。

## 目标
当收到 `card-planner:final-output:requested` 并校验通过时：
- `card-planner:final-output:completed` 的 `data` 中回显（echo）已校验通过的 payload（至少包含 `cards`），用于人工验收比对；
- 校验失败时保持 `failed`（400）并携带明确错误原因。

## 约束
- 仅修改：`src/backend/msgCenter_server/**`
- Fail-Fast：非法输入必须 failed（400），不得静默吞错。
- 不改变请求 payload 契约：`data.cards` 的结构必须继续严格校验（见 `docs/contracts/card-planner.md` 7.3）。

## 建议实现（可调整，DoD 不变）
在 `src/backend/msgCenter_server/handlers/card_planner/final_output.py`：
- completed response 的 `data` 从 `{count}` 扩展为 `{count, cards}`（cards 即已校验通过的输入）
- 单测增加断言：回显 cards 与输入一致

## 必须新增回归测试（至少 1 条）
扩展现有 pytest：
- `src/backend/msgCenter_server/handlers/__tests__/test_card_planner_final_output_unit.py`

覆盖点：
1) success：`resp["data"]["cards"] == 输入 cards`
2) invalid：保持 failed 且 code=400

## 验收（DoD）
- `pnpm -s run lint` ✅
- `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_card_planner_final_output_unit.py` ✅

