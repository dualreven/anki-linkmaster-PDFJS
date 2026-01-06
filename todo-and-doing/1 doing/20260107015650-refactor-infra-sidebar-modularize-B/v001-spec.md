# Infra Sidebar 模块化拆分规格说明

**功能ID**: 20260107015650-infra-sidebar-modularize-B  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-07 01:56:50  
**状态**: 设计中

## 现状说明
- `src/frontend/pdf-viewer/features/infra-sidebar/index.js` 同时承担：DOM 构建、全局拖拽监听、EventBus 桥接、布局计算、uninstall 清理。
- 虽然已补“uninstall 清理”回归测试，但代码职责仍偏集中，阅读/维护成本高（典型“面条”风险点）。

## 存在问题
- 单文件职责过多，修改时容易引入回归，且复用困难。

## 提出需求
- 在不改变对外事件契约/行为的前提下，把 infra-sidebar 拆成更清晰的模块（UI/resize/layout/event-bridge）。
- 保证 uninstall/destroy 仍能完整清理（已有回归测试必须继续通过）。

## 解决方案
- 拆分文件（示例，允许微调命名）：
  - `sidebar-ui-renderer.js`：纯 DOM 构建与渲染；
  - `sidebar-resize-handlers.js`：拖拽相关 document listeners；
  - `sidebar-layout-runner.js`：layoutEngine 调用与布局应用；
  - `index.js`：只保留装配、对外 API、生命周期与 subscription bag。
- 保持/补充测试：至少覆盖“toggle→destroy→不再响应/不再残留 document listener”。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/infra-sidebar/**`。

## 可行验收标准
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-sidebar/__tests__/sidebar-toggle-destroy-cleanup.test.js -i` 通过

## 协作协议（并行开发提速版，必须遵守）
（见 `todo-and-doing/3 template/v001-spec-template.md` 的同名章节；本任务必须完整遵守）

