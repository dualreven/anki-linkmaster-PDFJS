# PDFViewer infra-ui：拆分 ui-manager-core 的巨型订阅中心

**功能ID**: 20260109001740-pdfviewer-remediation-infra-ui-B  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-09 00:17:40  
**状态**: 设计中

## 现状说明
- 扫描报告：`docs/reports/20260108-pdfviewer-scan-B.md`
- 涉及范围：`src/frontend/pdf-viewer/features/infra-ui/**`

## 存在问题
- `ui-manager-core-ui-controls.js` / `ui-manager-core-event-listeners.js` 订阅大量不相关事件，形成“上帝对象”。
- UI 子模块既订阅 EventBus 又做 DOM/状态更新，数据流难追踪，测试困难。

## 提出需求
- 把 EventBus 订阅上移到 infra-ui feature 的装配层（或更合适的协调层）。
- UI 子模块改为“哑模块”：只暴露方法（如 `updateZoom`/`setPageIndicator`），不直接订阅 EventBus。
- 拆分边界清晰：缩放/导航/标题/状态提示等各自独立。

## 解决方案（建议）
- 以最小切割为主：先把 `eventBus.on*` 从子模块搬到协调层，保持对外行为不变。
- 每次拆分必须配 1 条回归测试，防止事件遗漏/行为变化。

## 约束条件
### 仅修改本模块代码
- 只允许修改：`src/frontend/pdf-viewer/features/infra-ui/**`
- 允许新增测试：`src/frontend/pdf-viewer/features/infra-ui/**/__tests__/**`（按现有结构放置）
- 禁止触碰其他 feature（如需跨模块改动，Fail-Fast：停下并在 working-log 里提出变更点与理由）。

### 严格遵循规范
- 开工前必须阅读：`src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准
### 必须通过
- `pnpm -s run lint`

### 必须新增/更新测试（至少 1 条，防回归）
- 事件→协调层→子模块方法调用链可测（建议 spy 子模块公开方法，触发对应事件，断言被调用）。

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

