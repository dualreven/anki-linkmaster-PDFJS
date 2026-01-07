# Feature 内部 EventBus 门禁（增量）

目标：持续收敛“Feature 内部（UI ↔ Manager）依赖 EventBus 做闭环更新”的混合态，实现更可预测的状态流与可测试性。

## 核心准则

- **Feature 内部通信（UI ↔ Manager）**：以 `ObservableState` 为主（UI 订阅 store，Manager 更新 store）。
- **EventBus 只用于跨 Feature / 跨窗口 / 外部桥接**：例如 WS 入站桥接、跨模块导航、全局生命周期事件等。
- **Fail-Fast**：不引入“兜底式”隐式同步；发现混合态回退应让门禁失败，而不是悄悄放行。

## 为什么要禁止闭环

闭环典型症状：
- UI 既订阅 store 又订阅 EventBus，状态更新来源不唯一；
- 同一条状态变化会触发多次渲染（重复 emit / 重复刷新）；
- 订阅清理不完整导致泄漏（卸载后仍响应事件）。

## 门禁做什么（增量策略）

脚本：`scripts/ci/feature-internal-eventbus-gates.js`

- 扫描范围：`src/frontend/pdf-viewer/features/**`
- 统计对象：EventBus 订阅热点（`.on/.onGlobal/.once`），包括：
  - 直接调用：`eventBus.on(...)` / `this.#eventBus.onGlobal(...)` 等
  - bind/解构别名：例如 `const onGlobal = this.#eventBus.onGlobal.bind(...)` 后的 `onGlobal(...)`
- baseline：`scripts/ci/baselines/feature-internal-eventbus-gates.json`
- 失败条件：
  - **NEW**：新文件出现订阅（baseline 无记录且订阅数 > 0）
  - **GROWN**：已有文件订阅数超过 baseline
- 目标：只阻止“新增/增长”，避免一次性全仓阻塞；迁移完成后再逐步收紧 baseline。

## 如何更新 baseline

当你有明确理由需要新增订阅（极少数情况）或在迁移阶段暂时无法消除时：

```bash
node scripts/ci/feature-internal-eventbus-gates.js --write-baseline
```

注意：这会把当前扫描范围内“订阅数>0”的文件写入 baseline，建议配合代码 review 使用。

## 推荐迁移模式（store 驱动 UI）

最小模式：
- Manager：
  - 提供 `store = new ObservableState({...})`
  - 所有状态变更通过 `store.set(...)`
- UI：
  - 在 `initialize()` 里 `store.subscribe(...)`
  - 在 `destroy()/uninstall()` 里执行 unsubscribe（必须清理）

测试建议：
- 用单测断言：`destroy/uninstall` 后不再响应订阅回调；
- 避免依赖全局单例 eventBus 造成跨测试污染（必要时 `destroy()`）。

