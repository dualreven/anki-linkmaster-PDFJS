# 20260110123105-core-state-manager-granular-events-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:31:05
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 batchUpdate / field-changed 的最小回归测试
2. 实现粒度化事件管道并保持兼容
3. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 14:29
### 工作内容:
- 新增更细粒度的字段级订阅：`onFieldChanged(field, handler)`（Fail-Fast 校验字段与 handler）。
- `batchUpdate` 支持两种调用形态：
  - `batchUpdate((sm)=>{ ... })`（原语义保持）；
  - `batchUpdate({ ...updates })`（便捷入口，复用 setMany + 合并发一次 `STATE.CHANGED`）。
- 保持兼容：`PDF_VIEWER_EVENTS.STATE.CHANGED` 仍按原约定发射；在此基础上新增字段级回调（非 EventBus 事件，不影响旧订阅者）。

### 回归测试（新增/增强）
- `src/frontend/pdf-viewer/core/__tests__/state-manager.test.js`：
  - `batchUpdate({ ...updates })`：只触发一次 `STATE.CHANGED`；
  - `onFieldChanged`：单字段触发/相同值不触发/unsubscribe 生效；
  - `batchUpdate` 内多字段变化：对应字段各触发一次。

### 验收
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/core/__tests__/state-manager.test.js" -i` ✅
- `pnpm -s run lint` ✅

### 交付信息
- commit: `acf5991e324d8f4cb9481bf923b518412471206e`
