# 20260110014111-ui-keyboard-handler-idempotent-cleanup-E 工作日志
**参考标准**: v001-spec.md

## 2026-01-10 01:41
### 工作内容
- 任务下发（待 E 开工）。
### 下一步计划
- E：先写回归测试，再加幂等与卸载对称实现。

## 2026-01-10 02:41
### 工作内容
- 已确认 `KeyboardHandler` 现有实现已包含“document 监听幂等 + destroy 对称卸载 + document↔DomEventHub 切换清理”。
- 新增回归测试：`destroy()` 后触发 `keydown` 不再触发 `eventBus.emit`。
- 按 Fail-Fast 原则移除 DomEventHub unsubscribe 的 `try/catch` 兜底：异常直接冒泡。

### 改动范围
- `src/frontend/pdf-viewer/ui/keyboard-handler.js`
- `src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js`

### 自验命令
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js -i` ✅

### 交付信息
- main 合入：`1d921d2`
