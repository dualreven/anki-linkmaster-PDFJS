# infra-ui coordinator 拆分与瘦身规格说明

**功能ID**: 20260110175029-infra-ui-coordinator-slim-B  
**优先级**: 中（P1/P2）  
**版本**: v001  
**创建时间**: 2026-01-10 17:50:29  
**状态**: 设计中

## 现状说明
- `infra-ui` 已引入 `infra-ui-coordinator.js` 作为统一装配层，但该文件仍集中承载大量 `eventBus.on(...)` 订阅（面条风险点聚集）。

## 存在问题
- coordinator 过载：单文件订阅过多事件，后续继续演进容易“回到上帝对象”。
- 订阅清理的可读性与可验证性不足（难以一眼看清 uninstall 是否覆盖全部订阅）。

## 提出需求
1) 将 `infra-ui-coordinator.js` 按领域拆分为多个 installer（例如 nav/zoom/view-mode/status），coordinator 只做编排与生命周期管理。
2) 新增 1 条回归测试：验证 uninstall 后所有订阅都被清理（至少对关键事件集合做断言）。

## 解决方案
- 新增目录：`src/frontend/pdf-viewer/features/infra-ui/subscriptions/`（或同级合理位置）
- 每个子模块导出 `installXxxSubscriptions({ eventBus, ...deps }) -> cleanupFn[] | cleanupFn`
- coordinator 收敛为：组合 installers + 统一 cleanup

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/infra-ui/**`

### 严格遵循 Fail-Fast
- installer 缺少依赖/事件名不匹配必须抛错，不允许静默兜底。

## 可行验收标准
### 单元测试
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/__tests__/... -i` 新增/更新测试通过。

