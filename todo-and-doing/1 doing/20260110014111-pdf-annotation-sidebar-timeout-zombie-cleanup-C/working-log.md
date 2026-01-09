# 20260110014111-pdf-annotation-sidebar-timeout-zombie-cleanup-C 工作日志
**参考标准**: v001-spec.md

## 2026-01-10 01:41
### 工作内容
- 任务下发（待 C 开工）。
### 下一步计划
- C：先写 fake timers 回归测试，再清理 zombie code 与 timeout。

## 2026-01-10 02:46
### 工作内容
- 已新增回归测试（fake timers）：destroy 后推进 timers，不应再写入 DOM。
- 已实现 Sidebar destroy 清理所有 timeout，避免 destroy 后触碰 DOM。
- 已清理 `subscriptions.js` 中未被调用的 comment 相关 zombie code（移除 handler/参数/订阅）。

### 验收
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.timeout-cleanup.test.js -i` ✅
