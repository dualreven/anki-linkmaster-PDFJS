# WS/Adapter/Bootstrap 内部重构规格说明（A）

**功能ID**: 20260106021330-refactor-ws-adapter-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-06 02:13:30  
**预计完成**: 2026-01-06  
**状态**: 设计完成 / 待开发  

## 现状说明

- `main` 已完成并行基线（见 tag：`foundation-20260106014352`），并新增门禁禁止 Manager 内订阅 EventBus。
- 本任务仅负责 **pdf-viewer 的 WS/Adapter/Bootstrap 内部治理**，为后续 Feature 并行开发提供稳定底座。

## 存在问题（要解决的）

- Adapter/Bootstrap 链路容易变“总线面条”：重复桥接、初始化时序不一致、队列消息不释放等。
- 缺少“按目录治理”的明确边界，导致并行开发时容易互相踩文件。

## 提出需求

- 只在指定目录范围内做重构/加固：
  - `src/frontend/pdf-viewer/adapters/**`
  - `src/frontend/pdf-viewer/bootstrap/**`
  - （如确实需要）`src/frontend/pdf-viewer/features/infra-app/**`
- 保证对外行为不退化：不引入兜底，任何非预期输入应明确失败并可观测（logger）。

## 解决方案（原则）

- EventBus 仅用于跨边界桥接；Adapter 侧不要吞异常，不要静默失败。
- 初始化顺序以测试为准：先安装基础设施/适配器，再 connect。
- 尽量“薄适配器”：Adapter 负责路由/翻译，不把业务状态塞进去。

## 约束条件

### 仅修改本模块代码

- 仅允许改动：`src/frontend/pdf-viewer/adapters/**`、`src/frontend/pdf-viewer/bootstrap/**`（以及必要的 `infra-app` 支撑）。
- **禁止**改动 `src/frontend/pdf-viewer/features/infra-sidebar/**`（本轮 `infra-sidebar` 对外契约冻结）。

### 严格遵循规范与门禁

- 必须遵循 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 引用的规范。
- 必须通过 ESLint（包含自定义门禁）与行数门禁。

## 可行验收标准

### 单元测试

- 至少新增/更新 1 条回归测试，覆盖本次修复点（例如初始化顺序、队列释放、错误分发等）。
- 建议执行：
  - `pnpm exec jest src/frontend/pdf-viewer/features/infra-app/__tests__/app-core-feature.ws-setup-order.test.js --runInBand`
  - `pnpm exec jest src/frontend/pdf-viewer/adapters --runInBand`

### Lint

- `pnpm run lint` 通过。

## 并行开发边界（防互相干扰）

- 本任务不应修改以下目录：
  - `src/frontend/pdf-viewer/features/infra-ui/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`

