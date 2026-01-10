# [pdf-viewer][A][P0] 标注模型：消除重复真源，收敛为单一实现（防分叉）

**功能ID**: 20260110040857-annotation-model-single-source-A  
**优先级**: P0（结构性债务，必须先治理）  
**版本**: v001  
**创建时间**: 2026-01-10 04:08:57  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-A`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-A`）

## 背景（外部发现的 P0）
当前存在两份“标注模型 Annotation”的实现，且行为已出现差异，属于**重复真源**，后续极易分叉回面条：
- `src/frontend/common/models/annotation.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js`

现状观测（示例差异，非穷举）：
- screenshot 校验：一处允许 legacy `rect`，一处强制 `rectPercent`（行为不一致）
- comments 归一化：一处会补齐 `annotationId`，一处不会（行为不一致）
- update 逻辑：一处先 merge 再 validate，一处先 validate changes（行为不一致）

## 目标
在**不引入新行为分叉**的前提下，达成：
1) `Annotation` / `AnnotationType` / `HighlightColor` **只有一个实现真源**；
2) `pdf-annotation` feature 内部不再维护独立实现（最多保留“薄 shim 复出口”，禁止复制逻辑）；
3) 所有引用路径统一、可追溯，后续新增字段/校验只改一处；
4) 必须新增最小防回归测试：保证“两个入口导出的对象一致（同一引用）或关键行为一致”。

## 方案约束（必须遵守）
- Fail-Fast：不得新增任何“静默兜底继续跑”的逻辑；如需兼容旧数据，必须用**显式的 adapter/迁移函数**，并配测试。
- 禁止两份实现继续并存：允许保留 `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js` 但只能做 re-export / thin wrapper（不得含业务逻辑）。
- 优先减少改动面：优先选择“已有引用最多”的路径作为唯一真源，并把另一路径改为复出口。

## 建议落地路径（可调整，但 DoD 不变）
1) 选定唯一真源（建议）：`src/frontend/common/models/annotation.js`
2) 将 `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js` 改为**纯 re-export**（或删除并让 `models/index.js` 从 common 导出）
3) 统一 `pdf-annotation` feature 内 import 口径：一律走 `models/index.js`（index 再从 common 导出），避免未来又出现第二条入口
4) 清理重复测试：feature 侧模型测试改为验证 re-export 或迁移到 common 侧

## 必须新增回归测试（至少 1 条）
新增一个 Jest 测试，覆盖至少一项：
- `common/models/annotation.js` 与 `pdf-annotation/models/index.js` 导出的 `Annotation` **同一引用**（`toBe`），或在同样输入下通过/抛错一致。

## 验收（DoD）
- 必须提交到 `worker/refactor-A`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

