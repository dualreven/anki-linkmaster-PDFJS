# PDFViewer pdf-annotation：Tools 改为 store-reactive + 清理 Zombie Code

**功能ID**: 20260109001750-pdfviewer-remediation-annotation-tools-C  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-09 00:17:50  
**状态**: 设计中

## 现状说明
- 扫描报告：`docs/reports/20260108-pdfviewer-scan-C.md`
- 涉及范围：`src/frontend/pdf-viewer/features/pdf-annotation/**`

## 存在问题
- Tools（`ScreenshotTool`/`TextHighlightTool` 等）通过 CRUD 事件驱动 marker 增删，存在“状态变化不经事件”的不同步风险。
- `AnnotationSidebarUI` 已 store 驱动，但 `subscriptions.js` 残留无效回调（Zombie Code），会误导维护者。
- 多处 `setTimeout` 用于规避竞态，生命周期不清晰。

## 提出需求
- Tools 订阅 `AnnotationManager.store`，marker 渲染以 state 推导（diff）为主。
- 清理 `annotation-sidebar-ui/subscriptions.js` 的无效接口，避免“双重驱动”。
- 逐步抽出共享的 marker layer/adapter（如涉及范围过大，可先做最小可落地版本）。

## 解决方案（建议）
- 先选一个 tool（优先 screenshot）做“store-reactive”样板，并补测试；再推广到 text-highlight。
- 若需要 PDF.js 生命周期（page rendered/scale）监听，优先集中到 1 个 adapter，避免每个 tool 重复订阅。

## 约束条件
### 仅修改本模块代码
- 只允许修改：`src/frontend/pdf-viewer/features/pdf-annotation/**`
- 允许新增测试：`src/frontend/pdf-viewer/features/pdf-annotation/**/__tests__/**`
- 禁止修改其他 feature（如需跨模块改动，Fail-Fast：停下并在 working-log 里提出变更点与理由）。

### 严格遵循规范
- 开工前必须阅读：`src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准
### 必须通过
- `pnpm -s run lint`

### 必须新增/更新测试（至少 1 条，防回归）
- store 更新后 sidebar 自动刷新（不依赖 CREATED/DELETED 事件）。
-（可选）marker 恢复不依赖 `ANNOTATION.DATA.LOADED`（或将其降级为“仅提示”信号）。

## 协作协议（并行开发提速版，必须遵守）
本项目的“并行”目标是：**各分支并行排雷，主干一次性集成验收**，避免在合并阶段才补交付物。

### 完成定义（DoD：没有 commit hash 就不算完成）
- 必须提交到对应 worktree 分支（工作区干净），并给出 **commit hash**。
- 必须通过最小验收：`pnpm -s run lint` + “本任务新增/改动的测试文件集”。
- 必须在 `working-log.md` 写明：改动范围（目录）、验收命令与结果、风险点（如跨模块边界）。

### 合入 main 的交付格式（复制这段到群里/issue）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `<只改动的目录列表>`
- `tests`: `<lint命令>` + `<jest --runTestsByPath ...>`（贴出通过结论）
- `notes`: `<是否触碰跨模块契约/是否需要人工点检>`

### 集成方式（主干一次性验证）
- 默认不做 rebase；**main 仅 cherry-pick 功能提交**（避免把“同步 main 的提交”二次合并）。
- main 侧只跑一次门禁：`lint` + `jest --runTestsByPath <四个任务新增测试并集>`；通过即合入。

