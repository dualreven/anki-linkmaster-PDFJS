# Card Planner - new-card-scheduler 显示 WS 注册/连接状态（辅助验收）

**功能ID**: 20260110172214-card-planner-new-card-scheduler-ws-status-G  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 17:22  
**状态**: 设计中  

## 现状说明
- Step4 的根因属于“窗口未注册导致不可路由”的竞态；用户侧很难直观看到“当前窗口是否已完成 WS 连接/注册”。
- `new-card-scheduler/main.js` 会尝试 `wsClient.connect()`，但 UI 主视图并未持续显示连接状态（仅有启动 toast）。

## 提出需求
- 在新卡片规划器窗口中提供一个低侵入、常驻的状态显示：
  - 当前 `client_id`（通常是 `new-card-scheduler`）
  - WS 连接状态：`connecting/connected/failed/disconnected`（至少能区分 connected vs not）
  - 连接失败时给出可读错误信息（Fail-Fast，不要静默失败）
- **注意**：这是“验收辅助/可观测性”，不改变业务行为，不引入新的协议依赖。

## 解决方案（建议）
- 在 `src/frontend/new-card-scheduler/` 内实现一个轻量状态组件，挂载在顶部工具栏区域（不遮挡主 workspace）。
- 监听现有 WSClient/eventBus 的连接事件（优先复用现有事件常量与错误处理工具），若缺少事件则在不破坏封装的前提下补齐最小事件发射。
- 保持代码拆分与行数门禁：避免把大量逻辑堆进 `main.js`。

## 约束条件
- 仅修改前端新卡片规划器模块相关代码：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试（必须新增/补齐）
- Jest：验证状态组件在不同状态输入下的渲染（至少覆盖 connected vs failed 文案）。
  - 若你选择纯函数渲染/无 DOM 依赖，可用最小测试即可。

### 人工验收
- 打开 `http://localhost:3000/new-card-scheduler/`：
  - 能看到 client_id 与 WS 状态；
  - 断开/连不上 MsgCenter 时有明确提示。

