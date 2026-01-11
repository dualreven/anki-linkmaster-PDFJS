# Docs - Card Planner：DB 命中才胶囊化 + 测试ID + 验收清单（I）

**功能ID**: 20260111161611-docs-card-planner-db-hit-token-I  
**优先级**: P1  
**版本**: v001  
**创建时间**: 2026-01-11 16:16  
**状态**: doing  

## 目标
把本轮新约束写入开发文档，避免后续误解与回归：
- `[[annotationId]]` 仅在 DB 命中时胶囊化（A 方案：只影响渲染）
- 两个测试伪标注 id：`ann_test_1`、`ann_test_2`
- 手工验收清单 + 单测/后端测命令索引
- 更新“新卡片规划器总体进度”（0~10）与下一步风险点

## 需求（必须满足）
1) 更新 `docs/contracts/card-planner.md`：
   - 增加一节：`[[id]]` token 的“渲染语义”（命中才胶囊化；未命中当普通文本）
   - 明确“命中定义”：以 `annotation:bulk-get:completed` 返回集合为准
   - 写入测试 id：`ann_test_1`、`ann_test_2`
2) 增加/更新一个“手工验收清单”文档（可新建 `docs/reports/...` 或补到 `docs/contracts/card-planner.md`）：
   - gui_launcher 如何一键填充/复制 token
   - 打开 new-card-scheduler 后如何粘贴并观察胶囊化
3) 必须在 `report.md` 写明变更文件清单与 `pnpm -s run lint` 结果，并 git 提交。

## 约束（严格隔离 scope，禁止与其他任务重叠）
### 允许修改/新增（仅限）
- `docs/**`
- `todo-and-doing/1 doing/20260111161611-docs-card-planner-db-hit-token-I/**`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/**`（G 的 scope）
- 禁止修改：后端 DB/插件（H 的 scope）
- 禁止修改：`gui_launcher.py`（F 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅（全仓门禁）
- `report.md`（必须提交）：scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

