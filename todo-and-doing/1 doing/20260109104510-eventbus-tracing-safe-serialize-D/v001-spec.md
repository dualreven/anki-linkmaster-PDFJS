# EventBus tracing：避免序列化导致的 Maximum call stack size exceeded

**功能ID**: 20260109104510-eventbus-tracing-safe-serialize-D  
**优先级**: 高（P0：污染日志，组合场景必现）  
**版本**: v001  
**创建时间**: 2026-01-09 10:45:10  
**状态**: 设计中

## 现状说明
- 手工复现：打开搜索栏（pdf-search UI 打开）时，点击大纲项进行跳转，会出现报错日志：
  - `事件回调执行出错：Maximum call stack size exceeded [Serialization Error: Maximum call stack size exceeded]`
- 功能不受影响，但日志链路异常会误导排障，并可能掩盖真实错误。

## 根因假设（需验证）
- `EventBus` 在 **enableTracing** 情况下会写入 `messageTrace.data`，目前实现为 `JSON.stringify(data)`（未 try/catch）。
- 当 `data` 包含“深层结构/循环引用/某些不可序列化对象”时，`JSON.stringify` 直接抛 `Maximum call stack size exceeded`，被 EventBus 捕获并打印为“事件回调执行出错”。
- 该错误属于 tracing/日志辅助链路，不应影响业务事件回调执行。

## 提出需求
- tracing/日志链路 **不得因为 payload 序列化失败而抛异常**（Fail-Fast 不适用于 tracing：这里必须 Fail-Closed 到占位字符串，避免污染业务回调）。
- 保持现有追踪结构不变，只修复“序列化不安全”。

## 追加交付（你需要多做的 1+2+3）
### 1) 组合场景回归测试（推荐：最贴近用户复现）
- 新增一条回归测试，模拟“search UI 打开 + outline 导航触发的事件链路”在 **enableTracing=true** 下不会因为序列化而报错。
- 允许的实现方式（二选一，按成本最低）：
  1. **最小复现**：在测试里构造一个“深对象/循环引用”的 payload，走 `eventBus.emit(...)`，断言不抛异常（这是最稳的）；  
  2. **组合链路**：在测试里直接触发与该组合场景相关的事件（如 outline 导航事件），并注入一个会触发深对象的 payload（如果容易复现）。
- 验收：测试必须能稳定复现“之前会报错”的条件（至少是深对象/循环引用）。

### 2) 修复范围扩展（统一治理，避免漏网）
- 在 `src/frontend/common/event/**` 内全局搜索类似写法：
  - `JSON.stringify(data)` / `JSON.stringify(payload)` / `...substring(...)`（用于 tracing/日志）
- 对所有 tracing/日志链路中的 stringify 统一改为“安全序列化”：
  - try/catch 包裹；
  - 失败写占位字符串；
  - 成功仍保持截断策略。
- 目标：避免只修 `event-bus-emitter.js`，但 `event-bus-with-tracing.js` 或其他 tracing 实现仍爆栈。

### 3) 文档化策略（避免未来回归）
- 更新项目内 EventBus 标准文档（选一个最合适的位置）：
  - 建议优先：`docs/standards/event-bus.md`（如果存在）
  - 或：`src/frontend/common/event/README-message-tracing.md`
- 必须写清楚：
  - tracing/日志链路 **不得抛异常影响业务回调**；
  - payload 必须截断；不可序列化则用占位字符串；
  - 这是“观测能力”的 Fail-Closed 策略。

## 解决方案（建议）
- 修改 `src/frontend/common/event/event-bus-emitter.js`：
  - 将 `messageTrace.data = JSON.stringify(data).substring(0, 500)` 改为：
    - try/catch 包裹；
    - 失败时写入短字符串：`[Unserializable payload: <error>]`；
    - 成功时仍截断（维持现有上限）。
- 如 `event-bus-with-tracing.js` 存在相同写法，也一并修复（保持一致）。

## 约束条件
### 仅修改本模块代码
- 只允许修改：`src/frontend/common/event/**`
- 允许新增测试：`src/frontend/common/event/__tests__/**`
- 禁止改 pdf-viewer 各 feature 的业务逻辑（本任务只修 tracing）。

## 可行验收标准
### 必须通过
- `pnpm -s run lint`

### 必须新增测试（至少 1 条，防回归）
- 用例：`enableTracing: true` 时，`eventBus.emit("some:event", deepOrCircularObject)` 不应抛异常。
  - 断言：emit 返回/执行完成；并且内部不会抛 “Maximum call stack size exceeded”。
  - 允许额外断言：trace 里 data 为占位字符串（可选，避免过耦合内部结构）。
### 建议新增测试（可选，但如果你能做就做）
- 针对“组合链路”的回归测试（对应本 bug 的手工复现步骤），确保未来 pdf-search / pdf-outline 改动不会再触发类似日志污染。

## 协作协议（并行开发提速版，必须遵守）
- 必须提交到 `worker/refactor-D`（工作区干净），提供 **commit hash**。
- 必须在 `working-log.md` 写明：复现步骤、修复点、验收命令与结果。
