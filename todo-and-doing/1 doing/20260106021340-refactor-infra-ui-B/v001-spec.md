# infra-ui 单向数据流治理规格说明（B）

**功能ID**: 20260106021340-refactor-infra-ui-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-06 02:13:40  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 现状说明

- `infra-ui` 已引入 `ViewerManager/ZoomManager/LayoutManager + ObservableState`，但仍存在部分“事件通道 + 状态通道”并行的链路。

## 存在问题（要解决的）

- 双真源/双通道：UI 点击 → manager → emit → handler → 引擎 → 再回写，容易产生循环与漂移。
- destroy/解绑不一致导致幽灵行为（尤其是 DOM listener 与 store subscribe 混用时）。

## 提出需求

- 只在 `src/frontend/pdf-viewer/features/infra-ui/**` 内做内部重构与测试补强。
- 不改事件常量与跨 Feature 契约（避免影响其它分支）。

## 解决方案（原则）

- 明确单一真源：对外“命令”可以仍走 EventBus，但内部状态必须收敛到 store，并确保回写方向唯一。
- 订阅与 DOM listener 必须对称清理（避免泄漏）。

## 约束条件

### 仅修改本模块代码

- 仅允许改动：`src/frontend/pdf-viewer/features/infra-ui/**`
- **禁止**改动 `infra-sidebar` 的对外契约与实现（本轮冻结）。

## 可行验收标准

### 单元测试

- 至少新增/更新 1 条回归测试（例如缩放状态同步、destroy 解绑、避免重复订阅等）。
- 建议执行：
  - `pnpm exec jest src/frontend/pdf-viewer/features/infra-ui --runInBand`

### Lint

- `pnpm run lint` 通过。

