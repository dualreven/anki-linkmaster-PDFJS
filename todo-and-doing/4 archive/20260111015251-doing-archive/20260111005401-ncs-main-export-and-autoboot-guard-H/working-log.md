# 20260111005401-ncs-main-export-and-autoboot-guard-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 把 `main.js` 从“脚本式自启动装配”改为“可导出、可调用、可卸载”的模块，供 feature-based bootstrap 调用。
### 工作步骤:
1. 提取/导出 createApp/legacyBootstrap API，返回 `{ destroy() }`。
2. 移除/关闭自启动（避免双启动）。
3. 新增 Jest：`main-export.contract.test.js`。
### 工作结果:
- （待实现）
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。

## 工作记录2
**时间**: 2026-01-11 01:18
### 工作内容:
- `main.js` 改为可复用模块：导出 `createNewCardSchedulerAppOrThrow(...)` 并返回 `{ destroy() }`；移除自启动逻辑。
- 新增 Jest 回归测试覆盖导出与 destroy 可调用。
### 工作步骤:
1) 重构 `src/frontend/new-card-scheduler/main.js`：把原装配/启动逻辑改为 `createNewCardSchedulerAppOrThrow(...)`，并把清理汇聚到 `destroy()`。
2) 移除模块级自启动（不再在 import 时执行启动）。
3) 新增 `src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js`：断言导出存在、返回 destroy 且 destroy 可调用。
4) 验收：`pnpm -s run lint`；`pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js -i`。
### 工作结果:
- 交付 commit：`3598e537`
- Lint：通过（`pnpm -s run lint`）。
- Jest：通过（`pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js -i`）。
