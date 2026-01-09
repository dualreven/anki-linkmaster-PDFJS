# 20260110014111-infra-ui-event-subscriptions-lift-B 工作日志
**参考标准**: v001-spec.md

## 2026-01-10 01:41
### 工作内容
- 任务下发（待 B 开工）。
### 下一步计划
- B：先补装配层回归测试，再迁移一组订阅并保证 cleanup 对称。

## 2026-01-10 02:49
### 工作内容
- 选定 `VIEW_MODE.RENDER_MODE_CHANGED` 做“小步上移”：从 `UILayoutControls` 内部订阅迁移到 `InfraUICoordinator`。
- `UILayoutControls` 改为“哑模块”：移除 `eventBus.on`，仅暴露 `onRenderModeChanged(data)` 供装配层调用。
- 新增装配层回归测试：emit 事件后断言公开方法被调用，并验证 destroy 后不再响应。

### 验收
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/__tests__/infra-ui-view-mode-render-mode-changed.subscription-lift.test.js -i` ✅

