# Card Planner - gui_launcher ACK_META 解析修复（兼容顶层字段）

**功能ID**: 20260110185158-card-planner-gui-launcher-ack-meta-parse-F  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 18:51  
**状态**: 设计中  

## 现状说明（用户反馈）
- 当前注入日志能打印 ACK JSON，但 `[ACK_META]` 里 `code/status/message/error_code` 解析为 `None`：
  - 实际 ACK 示例：`{\"type\":\"card-planner:ingest:completed\", ... \"status\":\"accepted\",\"code\":202,\"message\":\"...\"}`
  - 但当前解析似乎只从 `ack.data` 读取这些字段。

## 提出需求
- 修复 ACK_META 解析：同时兼容两种 ACK 形态（Fail‑Fast，字段缺失要明确）：
  1) 顶层：`ack.code / ack.status / ack.message / ack.error_code`
  2) 旧形态：`ack.data.code / ack.data.status / ack.data.message / ack.data.error_code`
- 当 `code=202` 时提示应准确（已排队等待注册→自动注入）；当 `404 NO_TARGET_FOUND` 时应提示“目标未注册/不可路由”。

## 约束条件
- 仅修改：
  - `gui_launcher.py`
  - `src/gui_launcher/__tests__/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试（必须新增/补齐）
- pytest：覆盖以下 ACK 输入：
  - 顶层 code=202 的 ACK：ACK_META 必须能解析出 202/accepted/message
  - 顶层 code=404 error_code=NO_TARGET_FOUND：ACK_META 必须解析出 404/NO_TARGET_FOUND
  - data 内层形态的 ACK：仍能通过（兼容性）

