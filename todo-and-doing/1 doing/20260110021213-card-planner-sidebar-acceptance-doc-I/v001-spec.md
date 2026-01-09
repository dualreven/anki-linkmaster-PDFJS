# Card Planner - Sidebar Acceptance Doc（I）规格说明

**功能ID**: 20260110021213-card-planner-sidebar-acceptance-doc-I  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 02:12:13  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-I`

## 目标
把“new-card-scheduler 侧边栏折叠/展开（push layout）”的验收步骤固化为文档，降低后续交接成本。

## 交付物
新增文档（建议路径其一）：
- `docs/checklists/new-card-scheduler-sidebar-acceptance.md`

内容必须包含：
1) 行为定义（展开推开 / 收起扩张；按钮触发；宽度=280px）
2) 可复制命令（lint + 单测路径）
3) 最小手工点检清单（3~5 条）
4) 常见问题排查（例如 Vite 端口从 `logs/runtime-ports.json` 读取，默认 3000）

## 约束条件
- 仅修改：`docs/**`（新增文件为主）
- 禁止修改：`.kilocode/rules/memory-bank/**`（由 main 侧统一更新）

## 验收（DoD）
- 必须提交到 `worker/feature-I`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`

*** Add File: todo-and-doing/1 doing/20260110021213-card-planner-sidebar-acceptance-doc-I/working-log.md
# 20260110021213-card-planner-sidebar-acceptance-doc-I 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 02:12:13
### 工作内容:
- 初始化任务（未开始撰写）。
### 工作步骤:
1. 对齐 v001 需求：仅折叠/展开，按钮触发
2. 汇总验收命令与手工点检步骤
3. 新增 `docs/checklists/new-card-scheduler-sidebar-acceptance.md`
4. 自检：`pnpm -s run lint`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成文档并交付 commit hash

