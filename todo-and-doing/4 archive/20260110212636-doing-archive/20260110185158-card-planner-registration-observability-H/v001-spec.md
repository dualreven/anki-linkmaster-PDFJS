# Card Planner - 注册状态可观测（Planner 侧）

**功能ID**: 20260110185158-card-planner-registration-observability-H  
**优先级**: 低-中（辅助验收）  
**版本**: v001  
**创建时间**: 2026-01-10 18:51  
**状态**: 设计中  

## 现状说明
- 目前窗口只显示 `ws=connected/failed`，但 Step3 的关键在于“是否完成 MsgCenter 注册（RouteRegistry 有 client_id）”。
- 若注册失败/重复注册等，需要在窗口内直观看到（否则只能读后端日志）。

## 提出需求
- 在新卡片规划器窗口内提供“注册状态”可观测：
  - 监听来自 MsgCenter 的 `client:register:completed` / `client:register:failed`
  - 显示 `reg=ok|failed`，并在失败时显示简短 error（Fail‑Fast）
- 不改变 Card Planner 业务语义，仅用于验收与诊断。

## 约束条件
- 仅修改：
  - `src/frontend/new-card-scheduler/**`

## 可行验收标准
### 单元测试（必须新增/补齐）
- Jest：构造 inbound 消息事件（可复用现有 wiring 的测试方式），断言面板显示 `reg=ok/failed`。

### 人工验收
- 打开窗口后能看到 `reg=ok`；若后端返回注册失败，窗口能显示错误信息。

