# 其余 Feature Observable 迁移清单（按收益/风险排序）

> 本文件由 `pdf-translator` 迁移样板产出：参考 **Manager + Store（ObservableState）** 路线。
> 目标：后续 Feature 迁移时，统一“事件 -> Manager -> Store -> UI”链路，减少事件面条与状态泄漏。

## 迁移顺序建议（先高收益/低风险）

1) `pdf-url-loader`
   - 现状：偏命令式/事件式触发加载与错误处理
   - 目标：把 `isLoading / progress / error / url / pdfId` 等收敛到 store，UI 订阅渲染
   - 风险：低（状态域集中、依赖少）
   - 建议测试：
     - store 驱动 UI（加载中/成功/失败 3 态）
     - destroy 后 unsubscribe（避免重复渲染/重复监听）

2) `pdf-quick-actions`
   - 现状：按钮/快捷动作分散订阅 EventBus，状态与 UI 耦合
   - 目标：把“当前选区/可用动作/显示隐藏/热键触发”状态统一到 store
   - 风险：中（与选区、高亮等交互多）
   - 建议测试：
     - 选区变化 -> store 更新 -> UI 渲染动作启用/禁用
     - destroy 后不再响应选区事件

3) `pdf-resume`
   - 现状：流程/持久化分支较多，容易出现“状态隐式耦合”
   - 目标：把 `enabled / lastSaved / pending / error / currentPageSnapshot` 显式到 store
   - 风险：中（涉及持久化协议、与 viewer 状态交互）
   - 建议测试：
     - 触发保存 -> store.pending -> 保存完成/失败状态收敛
     - 恢复逻辑的幂等性（重复恢复不应产生额外副作用）

4) `ai-assistant`
   - 现状：通常包含对话/流式/多阶段状态，事件面条风险最高
   - 目标：把 `session / messages / streaming / toolCalls / error` 收敛到 store；UI 只订阅渲染
   - 风险：高（交互复杂、边界多）
   - 建议测试：
     - streaming 状态切换（开始/增量/结束/错误）
     - destroy 后停止订阅与停止流式更新（防止内存泄漏）

## 统一迁移“样板步骤”（建议每个 Feature 都按此走）

1) **先补 2 条回归测试**
   - store 驱动（关键状态变化能驱动 UI/行为）
   - destroy 解绑（unsubscribe 后不再渲染/不再响应）
2) **引入 `Manager + ObservableState`**
   - Manager 负责业务逻辑、写 store、（可选）继续 emit 领域事件用于兼容
3) **Feature 层仅做桥接**
   - 继续监听外部事件，但只调用 manager 方法，不再在 Feature 内部维护 UI 状态
4) **UI 只订阅 store**
   - `store.subscribe(..., { fireImmediately:true })`
   - `destroy()` 必须清理 unsubscribe + timer/DOM

