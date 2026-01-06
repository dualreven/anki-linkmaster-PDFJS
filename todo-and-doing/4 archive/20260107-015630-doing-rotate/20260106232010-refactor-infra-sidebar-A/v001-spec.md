# infra-sidebar 基础设施收敛规格说明（A）

**功能ID**: 20260106232010-refactor-infra-sidebar-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-06 23:20:10  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 现状说明
- `pdf-viewer` 多个 feature 依赖“侧边栏能力”，但基础设施与对外契约容易漂移，导致并行改动互相影响。
- 上一轮并行任务已完成：infra-ui/outline/annotation 等关键修复已逐步合入 main。

## 提出需求
- 把 `infra-sidebar` 做成稳定底座：对外契约清晰、初始化/销毁幂等、订阅/DOM 清理一致、可测。

## 约束条件（并行边界）
- 仅允许改动：
  - `src/frontend/pdf-viewer/features/infra-sidebar/**`
  - （如确有必要）`src/frontend/pdf-viewer/features/infra-ui/**` 的“对接点”，但禁止改动跨 feature 事件契约形状
- 禁止无兜底：任何非预期输入必须抛错或显式失败（logger 可观测）。

## 可行验收标准
- 单测：至少新增 1 个回归测试，覆盖“toggle/open/close + destroy 清理”关键路径。
- 命令：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-sidebar -i`

## 协作协议（并行开发提速版，必须遵守）
见 `todo-and-doing/3 template/v001-spec-template.md` 的“协作协议”章节；本任务交付必须给出 commit hash + 验收命令结果。

