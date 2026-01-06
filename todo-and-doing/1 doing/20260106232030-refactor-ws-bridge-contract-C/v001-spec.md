# WS 入站桥接契约收敛（C）

**功能ID**: 20260106232030-refactor-ws-bridge-contract-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-06 23:20:30  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 现状说明
- WS 入站消息会被多个层同时消费（Adapter/Feature），容易出现重复发射领域事件、重复刷新等“面条”问题。

## 提出需求
- 明确“单一发射点”：同一类 WS message → 领域事件的发射只能由一个层负责（其余层只更新 store/状态）。
- 把去重策略做成可复用、可测试的契约（避免靠临时补丁维持）。

## 约束条件（并行边界）
- 仅允许改动：
  - `src/frontend/pdf-viewer/adapters/**`（仅 ws inbound 相关）
  - `src/frontend/pdf-viewer/features/pdf-outline/**`（如需对接）
- 禁止改动事件名常量与跨 feature payload 形状。

## 可行验收标准
- 至少新增/更新 1 条回归测试，覆盖“同一条入站消息不会触发两次 OUTLINE/ANCHOR 的 SUCCESS”。
- 命令：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/adapters -i`
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-outline -i`

## 协作协议（并行开发提速版，必须遵守）
见 `todo-and-doing/3 template/v001-spec-template.md` 的“协作协议”章节。

