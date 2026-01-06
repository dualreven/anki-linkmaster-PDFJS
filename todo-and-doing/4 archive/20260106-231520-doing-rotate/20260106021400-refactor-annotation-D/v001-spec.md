# pdf-annotation 内部重构规格说明（D）

**功能ID**: 20260106021400-refactor-annotation-D  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-06 02:14:00  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 现状说明

- `main` 已完成关键边界收敛：`AnnotationManager V2` 不再订阅 EventBus；事件桥接由 `AnnotationFeature` 承担，并补齐 unsubs 清理。
- 本任务在此基础上继续做“内部模块化 + 测试补强”，不改变对外行为。

## 存在问题（要解决的）

- 标注工具链路复杂，容易出现订阅泄漏、状态/DOM 不一致、回归测试覆盖不均。

## 提出需求

- 仅在 `src/frontend/pdf-viewer/features/pdf-annotation/**` 内做内部重构与测试补强。
- 不引入兜底：任何非预期输入必须抛错或显式记录错误（Fail-Fast）。

## 约束条件

### 仅修改本模块代码

- 仅允许改动：`src/frontend/pdf-viewer/features/pdf-annotation/**`
- **禁止**改动 `infra-sidebar` 对外契约（本轮冻结）。

## 可行验收标准

### 单元测试

- 至少新增/更新 1 条回归测试覆盖本次改动点（例如 destroy 解绑、事件桥接行为、WS 持久化触发条件等）。
- 建议执行：
  - `pnpm exec jest src/frontend/pdf-viewer/features/pdf-annotation --runInBand`

### Lint

- `pnpm run lint` 通过。

