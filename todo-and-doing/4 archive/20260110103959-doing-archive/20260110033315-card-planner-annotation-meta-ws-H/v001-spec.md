# Card Planner - Annotation Meta WS（H）规格说明

**功能ID**: 20260110033315-card-planner-annotation-meta-ws-H  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 03:33:15  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`

## 真源（必须对齐）
- `docs/contracts/card-planner.md`（7.4 节：`annotation:bulk-get:*`）

## 现状说明
- `src/frontend/new-card-scheduler/planner/adapters/annotation-meta-adapter.js` 已支持 `mode=ws`，但 `planner/app.js` 当前默认 `mode=mock`。
- MsgCenter 后端 `annotation:bulk-get:requested` handler 已合入 main（可用）。

## 目标
让 new-card-scheduler 在开发模式下默认走 WS 拉取标注元信息（title/type/...），并在 UI 中显示（最小可用）：
1) 追加标注后，Q/A 预览应显示真实 `title/type`（缺失则 fallback 为 id）。
2) 超时/失败必须 Fail-Fast 给出明确错误（允许仅 toast，不得静默吞错）。

## 解决方案（建议）
- 修改 `src/frontend/new-card-scheduler/planner/app.js`：
  - `createAnnotationMetaAdapter({ mode: "ws", wsClient, eventBus, logger })`
  - 若 WS 请求失败：显示提示并保持 UI 可用（但不得伪装成功）。
- 补一个 adapter 回归测试（建议路径）：
  - `src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js`
  - 模拟 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED` 收到 `annotation:bulk-get:completed`，断言 promise resolve。

## 约束条件
- 仅修改：`src/frontend/new-card-scheduler/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径> -i` ✅
- 手工点检：
  - 启动 MsgCenter（8765）后打开 `new-card-scheduler`，粘贴 `ann_id`，应看到 title/type（至少 mock 不再出现）

*** Add File: todo-and-doing/1 doing/20260110033315-card-planner-annotation-meta-ws-H/working-log.md
# 20260110033315-card-planner-annotation-meta-ws-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 03:33:15
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 对齐 `docs/contracts/card-planner.md` 7.4
2. app.js 默认改为 ws mode
3. 新增 adapter ws 回归测试
4. 验收：lint + jest by path
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成交付并回填 commit hash

