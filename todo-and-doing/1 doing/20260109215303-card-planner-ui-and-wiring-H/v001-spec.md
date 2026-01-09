# Card Planner - UI & MsgCenter Wiring（H）规格说明

**功能ID**: 20260109215303-card-planner-ui-and-wiring-H  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-09 21:53:03  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/feature-H`（worktree: `C:\Users\napretep\PycharmProjects\anki-linkmaster-H`）

## 真源
- 权威契约：`docs/contracts/card-planner.md`（第 2/3/5/7 节）

## 目标（只做 UI/交互/消息收发；算法由 G 负责）
在 `src/frontend/new-card-scheduler/**` 内实现 UI 与 MsgCenter wiring，使其满足：

### 1) 草稿卡 UI（拖拽/删除/命名/选中）
- 列表展示草稿卡（按当前顺序），并支持：
  - 选中卡片（更新 selected）
  - 删除卡片
  - 拖拽排序（reorder）
  - 命名（编辑 `title`，默认 `""`）

### 2) Ctrl+V 粘贴插入（严格按契约）
- 必须先选中某卡片，并点击该卡片的 `Q` 或 `A` 区域设置粘贴焦点（selectedTempId + face）。
- 未选中时 `Ctrl+V`：提示无效（不自动创建、不自动选择）。
- 解析规则：仅支持 `;` 分隔，保持顺序，不去重；结果为原始 annotation-id 字符串数组。
- 行为：追加（append）到目标卡片的目标面。

### 3) MsgCenter 消息（按契约第 7 节）
必须支持：
- 接收 `card-planner:ingest:requested`：
  - 解析 `op + annotation_ids`
  - 调用 engine 执行插入（失败则 Fail‑Fast 返回 `card-planner:ingest:failed`）
  - 成功返回 `card-planner:ingest:completed`
- 接收 `card-planner:state:get:requested`：
  - 返回 `card-planner:state:get:completed`，payload 必须含 `{ draftCardTempIds, selectedTempId }`
- 发射 `card-planner:final-output:requested`：
  - UI 提供按钮触发“发射最终制卡信息”
  - payload：`{ cards: [{title,Q,A}, ...] }`（顺序=当前排序）

### 4) 标注元信息展示（与 F 并行）
- 若 `annotation:bulk-get:requested` 可用：调用并展示返回的 `title/type/...`
- 开发期允许 mock/占位，但必须保留 adapter 层以便切换到真实消息（禁止把 mock 散落在 UI 里）

## 并行解耦（必须遵守）
本任务必须可在 G 未合入时独立推进：
- UI 通过最小 engine 接口工作；可先写 `FakeEngine` 供单测与 UI 开发。
- 等 G 合入后再用 adapter 适配真实 engine（单文件集中适配）。

Engine 最小接口（UI 假定存在）：
- `getState(): { draftCardTempIds: string[], selectedTempId: string|null }`
- `getCardsForView(): Array<{ tempId: string, title: string, QCount: number, ACount: number }>`
- `dispatchIngest({ op, annotationIds }): void`（失败抛错）
- `setSelected(tempId|null): void`
- `renameCard(tempId, title): void`
- `deleteCard(tempId): void`
- `reorderCards(fromIndex, toIndex): void`
- `toFinalCards(): Array<{ title: string, Q: string[], A: string[] }>`

## 约束条件
- 仅修改 `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`
- Fail‑Fast：任何非预期输入/状态必须明确报错（不能静默吞掉）
- 消息 `type` 必须与 `docs/contracts/card-planner.md` 一致（禁止私自改名）

## 必须新增的回归测试（最小集）
在 `src/frontend/new-card-scheduler/**/__tests__/` 新增测试文件（建议：`card-planner.ui-and-wiring.contract.test.js`），覆盖：
1) 未选中时 `Ctrl+V`：提示无效（可通过 mock notification 或事件断言）
2) 选中+点击 Q/A 设置粘贴焦点：粘贴后调用 engine 的 `dispatchIngest` 且 face 正确
3) 状态请求响应：payload 含 `selectedTempId`
4) UI 调用：拖拽排序/删除/命名都会调用 engine 对应方法（用 FakeEngine 断言调用）

## 验收（DoD）
- 必须提交到 `worker/feature-H`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i`

## 交付格式（复制给调度者）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/new-card-scheduler/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ...`
- `notes`: `<是否依赖 F 的 bulk-get/是否引入 UI 组件改动>`
