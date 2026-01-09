# pdf-outline：事件 payload 体积治理（避免传递深对象）

**功能ID**: 20260109104600-outline-event-payload-hygiene-A  
**优先级**: 中（P1：降低事件耦合与日志风险）  
**版本**: v001  
**创建时间**: 2026-01-09 10:46:00  
**状态**: 设计中

## 现状说明
- 当前 `OutlineSidebarUI` 在 `OUTLINE.SELECT.CHANGED` 与 `OUTLINE.NAVIGATE.REQUESTED` 相关事件里可能携带较大的对象（例如 `outlineItem` / `raw`）。
- 即使 D 修复 tracing stringify，本任务仍用于 **长期治理**：跨模块事件只传“最小必要字段”。

## 提出需求
- `OUTLINE.SELECT.CHANGED` payload 只包含：
  - `outlineItemId`（string）
- `OUTLINE.NAVIGATE.REQUESTED` payload 只包含：
  - `outlineItemId` 或 `{ pageAt, position }`（二选一，按现有使用者最小改动）
- 禁止在 EventBus payload 里塞入整棵 outline 对象（深层 children / raw）。

## 约束条件
### 仅修改本模块代码
- 只允许修改：
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - `src/frontend/pdf-viewer/outline/**`
- 禁止修改搜索/标注等其他 feature。

## 可行验收标准
- `pnpm -s run lint`
- 新增/更新至少 1 条测试，验证 payload 形状（不包含 `outlineItem` 大对象）。

## 协作协议
- 提交到 `worker/refactor-A`，提供 commit hash。

