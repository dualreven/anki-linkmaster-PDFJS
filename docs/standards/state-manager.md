# StateManager（响应式状态管理）说明

> 代码入口：`src/frontend/common/micro-service/state-manager.js`

## 目标
- 为各功能域提供“命名空间隔离”的响应式状态（基于 `Proxy`）。
- 支持 `subscribe`（按路径订阅）、`defineComputed`（计算属性）、`snapshot/restore`（快照恢复）、`history`（变化历史）。

## 文件结构（面条治理后）
- `src/frontend/common/micro-service/state-manager.js`：对外 API 入口（`StateManager` / `createStateManager` / default）。
- `src/frontend/common/micro-service/state-manager-reactive-state.js`：内部实现（`ReactiveState`，含 proxy/notify/history 等）。

## 对外 API（保持兼容）
### `new StateManager(options?)`
- `options.logger`：可注入 logger（未提供则默认 `getLogger("StateManager")`）。

### `stateManager.createState(namespace, initialData?) -> stateProxy`
返回 `Proxy`，并在返回值上挂载不可枚举的辅助方法：
- `stateProxy.subscribe(path, callback) -> unsubscribe`
- `stateProxy.defineComputed(name, getter)`
- `stateProxy.snapshot() -> { namespace, data, timestamp }`
- `stateProxy.restore(snapshot)`
- `stateProxy.getHistory(limit?)`
- `stateProxy.clearHistory()`

### `stateManager.getState(namespace) -> stateProxy | null`
### `stateManager.hasState(namespace) -> boolean`
### `stateManager.deleteState(namespace)` / `destroyState(namespace)`
### `stateManager.getAllNamespaces() -> string[]`
### `stateManager.clear()`
### `stateManager.snapshot() -> { states, timestamp }`
### `stateManager.restore(globalSnapshot)`
- 若 `globalSnapshot.states[namespace]` 不存在于当前 manager，会记录 warn 并跳过（不做兜底恢复）。

## 关键行为约束（设计取舍）
- `subscribe` 支持父路径订阅：例如订阅 `filters`，当 `filters.name` 变化时也会触发。
- `defineComputed` 当前实现是“粗粒度失效”：任一状态路径变化都会把所有 computed 标为 dirty（后续如需可做精确依赖追踪）。
- `restore` 以“保持 proxy 引用不变”为前提：会清空并回填同一个原始 data 对象，然后触发 `notifyAll`。
- 订阅回调异常不会吞掉：会 `logger.error(...)` 记录错误（避免 silent-fail）。

