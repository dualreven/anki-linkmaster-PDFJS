# doing 归档说明（2026-01-10 17:20）

本归档包含上一批 Card Planner v002 任务（F/G/H/I）的交付目录。

## 归档原因（验收未通过，需要返工）
- 用户手工验收反馈：步骤 1/2/3/5 通过；**步骤 4（注入样例草稿卡）失败**。
- 失败回执（关键字段）：
  - `type=card-planner:ingest:failed`
  - `code=404`
  - `error_code=NO_TARGET_FOUND`
  - `message=未找到任何匹配的目标客户端（共尝试 1 个路由）`

## 初步定位（供后续任务引用）
- 触发点：MsgCenter `forward` 路由在目标 `client_id=new-card-scheduler` 未注册/不可路由时直接失败。
- 现状：MsgCenter 目前仅对 `pdf-viewer:navigate:requested` 做了 auto-launch + pending-forward（避免 `NO_TARGET_FOUND`）；Card Planner ingest 未覆盖该机制。

## 下一步
- 已计划下发 v003 修复任务到对应 worktree（以“避免竞态 + 防回归测试”为核心）。

