# 20260109104510-eventbus-tracing-safe-serialize-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-09 10:45:10
### 工作内容:
- 任务创建（优先级最高，D 立即处理）
### 工作步骤:
1. 复现：打开搜索栏 + 点击大纲跳转，观察控制台/日志
2. 定位：`src/frontend/common/event/event-bus-emitter.js` tracing 的 stringify
3. **先写测试**：deep/circular payload 在 `enableTracing: true` 下 emit 不应抛异常
4. **扩展修复范围**：统一修复 `src/frontend/common/event/**` 中 tracing/logging stringify（避免漏网）
5. **补文档**：写清 tracing 的 Fail-Closed 策略（不影响业务回调）
6. `pnpm -s run lint` + `jest --runTestsByPath <new test>` 通过
### 工作结果:
- N/A
### 存在问题:
- N/A
### 下一步计划:
- D 提交 commit hash，main 批量集成

## 工作记录2
**时间**: 2026-01-09 11:20:00
### 工作内容:
- 修复 EventBus tracing/日志链路的 payload 序列化不安全问题（Fail-Closed），并补回归测试与文档说明。
### 改动范围（严格）
- `src/frontend/common/event/**`
### 工作结果:
- tracing/日志链路的 payload 序列化改为安全序列化：失败时写入占位字符串，避免污染“事件回调执行出错”。
- 回归测试覆盖：循环引用 payload + 强制 stringify 抛错（模拟 `Maximum call stack size exceeded`）。
- 文档补充：明确 tracing/日志链路必须 Fail-Closed，不得影响业务回调执行。
### 验收:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath "src/frontend/common/event/__tests__/event-bus.tracing.safe-serialize.regression.test.js" --runInBand` ✅
### DoD:
- `commit(s)`: `2bf0b3b`
