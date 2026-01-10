# doing 归档说明（2026-01-10 21:26）

本归档包含 Card Planner v004（F/G/H/I）任务目录。

## 归档原因（验收通过，但发现新问题）
用户手工验收：
- ✅ 草稿卡已注入成功（Step3 已恢复）
- ❌ 仍出现错误 toast：`标注元信息拉取失败：annotation:bulk-get 超时`（截图显示可能重复弹出）

## 基于事实的初步定位（供后续任务引用）
1) MsgCenter 后端对非注册消息 **强制要求 `to` 字段**（见 `src/backend/msgCenter_server/core/message_validator.py`），缺失会返回 `*:failed (INVALID_TO_FIELD, code=400, message=缺少 to 字段)`。
2) new-card-scheduler 侧 `annotation:bulk-get:requested` 当前未携带 `to:"backend"`，且 adapter 仅监听 `completed`，忽略 `failed` → UI 最终表现为“超时”。
3) 同类风险：`card-planner:final-output:requested`、以及 planner 侧回执消息（如 `card-planner:ingest:*` / `card-planner:state:get:*`）也可能存在“未带 to”的隐患，需要一并清理，避免回归。

## 下一步
下发 v005（F/G/H/I）：
- G：修复 planner 侧所有“发往后端”的消息补 `to:"backend"`；`annotation:bulk-get` 必须处理 `failed`；并做 toast 去重（Jest）。
- I：后端 `annotation:bulk-get` 依赖不可用时 fail-fast（错误信息明确且可测试，pytest）。
- H：增强可观测性：展示 annotation bulk-get 的 request_id/状态，并约束重复 toast（Jest）。
- F：`gui_launcher` 增加 annotation bulk-get 自检按钮（人工验收工具，pytest）。

