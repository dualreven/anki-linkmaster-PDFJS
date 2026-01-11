# GUI Launcher - 增强 Card Planner 测试入口（填充测试ID/复制token/一键注入）（F）

**功能ID**: 20260111161611-gui-launcher-card-planner-testids-F  
**优先级**: P1（提升可测性，减少手工误差）  
**版本**: v001  
**创建时间**: 2026-01-11 16:16  
**状态**: doing  

## 目标
在 `gui_launcher.py` 增加可视化测试入口，便于验证：
- `ann_test_1` / `ann_test_2` 是否为“DB 命中真 id”
- Card Planner 智能输入框对“命中 id”是否胶囊化

## 需求（必须满足）
1) 在 CardPlanner 测试区新增按钮/功能：
   - **填充测试ID**：把输入框填为 `ann_test_1,ann_test_2`（或分号/逗号按现有控件规范）；
   - **复制样例 token**：复制 `[[ann_test_1]] [[ann_test_2]]` 到剪贴板（便于粘贴到 Q/A 输入框）。
2) 若已有 “annotation bulk-get selftest”：
   - 增加“一键用测试ID执行 bulk-get selftest”并在 GUI 上显示返回条数/是否包含两条 id（可用 label）。
3) 必须添加最小回归测试（如已有 python 测试体系则加；若无，则至少保证改动为纯 UI 组装且 Fail‑Fast，不吞异常），并写明验证方式到 `report.md`。

## 约束（严格隔离 scope，禁止与其他任务重叠）
### 允许修改/新增（仅限）
- `gui_launcher.py`
- （可选）对应 python 测试文件（若项目已有）

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/**`（G 的 scope）
- 禁止修改：后端 DB/插件（H 的 scope）
- 禁止修改：`docs/**`（I 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅（全仓门禁）
- （如有）python 定向测试 ✅
- `report.md`（必须提交）：scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

