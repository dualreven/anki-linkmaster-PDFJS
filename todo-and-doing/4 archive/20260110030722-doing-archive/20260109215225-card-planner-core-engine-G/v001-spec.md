# Card Planner - Core Engine（G）规格说明

**功能ID**: 20260109215225-card-planner-core-engine-G  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-09 21:52:25  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/feature-G`（worktree: `C:\Users\napretep\PycharmProjects\anki-linkmaster-G`）

## 真源
- 权威契约：`docs/contracts/card-planner.md`

## 目标（只做 Core，不做 UI）
在 `src/frontend/new-card-scheduler/planner/**` 内实现草稿卡核心引擎，保证：
1) 数据结构：DraftCard = `{ tempId, title:"", Q:string[], A:string[] }`（Q/A 为原始 annotation-id；保持顺序，不去重）
2) 选择：维护 `selectedTempId`（无选中为 null）
3) 插入引擎：实现 `Target + Distribution`（对齐契约第 4/7 节）
4) 操作：创建/删除/命名/重排（reorder API，用于拖拽）
5) 输出：
   - `toFinalCards()` → `Array<{title,Q,A}>`（纯数组，顺序=当前排序）
   - `getState()` → `{ draftCardTempIds, selectedTempId }`

## Fail-Fast（必须完全一致）
- `newIndex(x)`：0-based；不存在直接抛错（不自动创建补齐）
- `cardId(tempId)`：只接受草稿卡临时 id；不存在抛错
- `last`：
  - 未选中：有卡→最近创建；无卡→创建新卡并作为 last
  - 已选中：上一张；选中第 0 张→抛错

## 与现有代码的关系（禁止造轮子）
- 必须以现有 `src/frontend/new-card-scheduler/planner/cards-model.js` 为基底重构或演进，允许拆分文件，但禁止新建第二套并存模型。
- 若现有 token 形态为 `[[id]]`：允许内部继续用 token，但“最终输出边界”必须输出原始 id 字符串（更推荐内部直接用原始 id 以减少歧义）。

## 必须新增的回归测试（最小集）
在 `src/frontend/new-card-scheduler/planner/__tests__/` 新增测试文件（建议命名：`cards-engine.contract.test.js`），覆盖：
1) `title` 默认 `""` 且会出现在 `toFinalCards()` 输出
2) 删除卡片后不出现在输出数组
3) reorder 后输出顺序变化
4) `newIndex(x)`：x=0 可用；越界抛错
5) `cardId(tempId)`：不存在抛错
6) `last` 三分支行为（未选中无卡/未选中有卡/已选中上一张；选中第 0 张抛错）
7) `alternate-faces(startFace=Q)`：按 QAQA… 分配，必要时自动创建新卡，保持顺序不去重

## 约束条件
- 仅修改 `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`
- 禁止兜底/静默修复：任何非预期输入/状态必须抛错（Fail‑Fast）

## 验收（DoD）
- 必须提交到 `worker/feature-G`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/cards-engine.contract.test.js -i`

## 交付格式（复制给调度者）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/new-card-scheduler/planner/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ...`
- `notes`: `<是否改动了既有 cards-model 结构/是否需要 UI 配合>`
