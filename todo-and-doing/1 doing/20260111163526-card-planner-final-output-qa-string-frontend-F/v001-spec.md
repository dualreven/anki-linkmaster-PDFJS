# Card Planner - Final Output：Q/A 从 string[] 升级为 string（前端）（F）

**功能ID**: 20260111163526-card-planner-final-output-qa-string-frontend-F  
**优先级**: P0（闭环必需：否则 final-output 400）  
**版本**: v001  
**创建时间**: 2026-01-11 16:35  
**状态**: doing  

## 背景
契约已更新：`docs/contracts/card-planner.md`（提交：`40149c89`）。  
最终制卡输出 `Q/A` 不再是 `annotation-id[]`，改为 `string`，内容中可嵌入 `[[annotation-id]]` token。

当前前端实现仍发送 `Q/A: string[]`（见 `src/frontend/new-card-scheduler/planner/app.js`），需要同步升级，否则后端校验会 400。

## 需求（必须满足）
1) `card-planner:final-output:requested` 的 `data.cards[]` 结构升级：
   - `title: string`
   - `Q: string`
   - `A: string`
2) 规划器内部若仍以 “Q/A id 列表” 作为真源：在 `toFinalCards()` 阶段将其序列化为字符串（建议 `[[id]]` 以换行拼接）。
3) Fail‑Fast：发送前校验 `Q/A` 为 string（允许空串与否按现有策略/文档提示，但必须一致）。
4) 必须更新回归测试（Jest）：至少覆盖
   - final-output payload 结构为 `Q/A: string`；
   - 发射后能正确处理 ACK（completed/failed）路径（如已有现成回归则更新）。

## 建议序列化规则（实现一致性）
- 若引擎真源仍是 `annotationId[]`：
  - `Q = qIds.map(id => \`[[${id}]]\`).join(\"\\n\")`
  - `A = aIds.map(id => \`[[${id}]]\`).join(\"\\n\")`
- 若未来支持混合文本：本任务不做（避免扩大 scope）。

## 约束（严格隔离 scope）
### 允许修改/新增（仅限）
- `src/frontend/new-card-scheduler/planner/**`
- `src/frontend/new-card-scheduler/__tests__/**`

### 禁止修改
- 禁止修改：后端 `src/backend/msgCenter_server/**`（H 的 scope）
- 禁止修改：`gui_launcher.py`（v010 F scope；本任务不碰）
- 禁止修改：`docs/**`（I 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务测试文件集> -i` ✅
- `report.md`（必须提交）：scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

