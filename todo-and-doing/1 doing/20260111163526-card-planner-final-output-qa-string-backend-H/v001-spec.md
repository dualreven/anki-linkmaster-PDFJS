# Card Planner - Final Output：Q/A 从 string[] 升级为 string（后端）（H）

**功能ID**: 20260111163526-card-planner-final-output-qa-string-backend-H  
**优先级**: P0（闭环必需：否则 final-output 400）  
**版本**: v001  
**创建时间**: 2026-01-11 16:35  
**状态**: doing  

## 背景
契约已更新：`docs/contracts/card-planner.md`（提交：`40149c89`）。  
最终制卡输出 `Q/A` 从 `string[]` 改为 `string`（文本中可嵌入 `[[annotation-id]]` token）。

当前后端 handler 仍按 `Q/A: string[]` 严格校验（见 `src/backend/msgCenter_server/handlers/card_planner/final_output.py`），需要同步升级。

## 需求（必须满足）
1) 后端校验升级：
   - `data.cards[]` 中 `Q/A` 必须为 string（允许空串与否按文档/现有策略统一）。
2) 返回 `card-planner:final-output:completed` 时，`data.cards` 回显也应为新结构（Q/A string）。
3) 必须添加/更新后端回归测试（pytest）：覆盖
   - 合法 payload（Q/A string）通过；
   - 非法 payload（Q/A 非 string）返回 failed（400）。

## 约束（严格隔离 scope）
### 允许修改/新增（仅限）
- `src/backend/msgCenter_server/handlers/card_planner/final_output.py`
- `src/backend/msgCenter_server/__tests__/**`（或项目既有后端测试目录）

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/**`（F 的 scope）
- 禁止修改：`gui_launcher.py`（F 的 v010 scope）
- 禁止修改：`docs/**`（I 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅（全仓门禁）
- 后端定向测试 ✅（pytest/等）：必须在 `report.md` 写出命令与结果
- `report.md`（必须提交）：scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

