# Backend - 为 `annotation:bulk-get` 增加 2 个测试伪标注ID（H）

**功能ID**: 20260111161611-backend-annotation-bulk-get-test-ids-H  
**优先级**: P0  
**版本**: v001  
**创建时间**: 2026-01-11 16:16  
**状态**: doing  

## 目标
提供 2 个“数据库存在的伪标注 id”，用于手工/自动测试 Card Planner 的“DB 命中才胶囊化”能力。

## 需求（必须满足）
1) 数据库中存在并可查询的测试标注 id：
   - `ann_test_1`
   - `ann_test_2`
2) 通过 MsgCenter/WS 触发 `annotation:bulk-get:requested`（`ann_ids` 包含以上 id）时，后端返回的 `annotation:bulk-get:completed` 必须包含对应条目（`data.annotations[].id`）。
3) 必须添加防回归测试（pytest 或现有后端测试体系）：覆盖“bulk-get 能查到两条测试标注”。

## 约束（严格隔离 scope，禁止与其他任务重叠）
### 允许修改/新增（仅限）
- 后端 `annotation:bulk-get` 相关实现与持久化层（含 DB 初始化/seed），以及对应测试文件

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/**`（G 的 scope）
- 禁止修改：`gui_launcher.py`（F 的 scope）
- 禁止修改：`docs/**`（I 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅（全仓门禁）
- 后端定向测试 ✅（pytest/等）：必须在 `report.md` 写出命令与结果
- `report.md`（必须提交）：scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

