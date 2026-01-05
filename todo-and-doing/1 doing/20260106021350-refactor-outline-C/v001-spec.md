# pdf-outline 内部重构规格说明（C）

**功能ID**: 20260106021350-refactor-outline-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-06 02:13:50  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 现状说明

- `pdf-outline` 已迁移到 `OutlineManager + ObservableState`，并与 WS 适配层协作。
- 侧边栏基础设施由 `infra-sidebar` 提供，本任务只消费其对外契约。

## 存在问题（要解决的）

- Outline UI / WS 回执 / 本地状态更新之间仍可能存在冗余刷新或时序耦合点。
- 需要把内部逻辑进一步“模块化+可测”，降低后续维护成本。

## 提出需求

- 仅在 `src/frontend/pdf-viewer/features/pdf-outline/**` 内做内部重构与测试补强。
- **不改** `infra-sidebar` 对外契约（事件/payload/服务名）。

## 约束条件

### 仅修改本模块代码

- 仅允许改动：`src/frontend/pdf-viewer/features/pdf-outline/**`

### 保持 infra-sidebar 契约不变

- 禁止改动侧边栏事件名与 payload 形状；例如以下事件契约必须保持：
  - `PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED` payload `{ sidebarId }`
  - `PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSE_REQUESTED` payload `{ sidebarId }`
  - `PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED` payload `{ sidebarId }`
  - `PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED` payload `{ totalWidth, layouts? }`

## 可行验收标准

### 单元测试

- 至少新增/更新 1 条回归测试覆盖本次改动点。
- 建议执行：
  - `pnpm exec jest src/frontend/pdf-viewer/features/pdf-outline --runInBand`

### Lint

- `pnpm run lint` 通过。

