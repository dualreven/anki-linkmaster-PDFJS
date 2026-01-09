# PDFViewer adapters 入站分发收敛与去耦

**功能ID**: 20260109001730-pdfviewer-remediation-adapters-A  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-09 00:17:30  
**状态**: 设计中

## 现状说明
- 扫描报告：`docs/reports/20260108-pdfviewer-scan-A.md`
- 涉及范围：`src/frontend/pdf-viewer/adapters/**`

## 存在问题
- 入站消息分发（routing）逻辑碎片化（类内 + bridge 并存），数据流难追踪。
- 出站 handler 依赖 URL（`getCurrentPdfIdFromWindow()`），适配器难以独立测试/复用。
- handler 订阅清理依赖手工维护 subscriptions bag，容易漏清理导致泄漏。

## 提出需求
- 收敛入站分发为单入口（插件化/handler 列表均可），减少装配层分支与重复逻辑。
- `pdfId` 获取方式可注入/可替换：适配器不得直接依赖 `window.location`。
- 订阅清理统一化：handler 返回 cleanup（函数或数组），由装配层集中管理。

## 解决方案（建议）
- 将入站 routing 抽为 `ws-inbound-handlers/*`（或等价目录），统一由 `ws-inbound-bridge`/adapter 装配调用。
- 将 `pdfId` 来源封装为 `PdfIdProvider`（接口/函数），在 adapter 构造或 install 时注入。
- 统一 cleanup 管理：adapter 的 `destroy/uninstall` 只处理“一处清理入口”。

## 约束条件
### 仅修改本模块代码
- 只允许修改：`src/frontend/pdf-viewer/adapters/**`
- 允许新增测试：`src/frontend/pdf-viewer/adapters/__tests__/**`
- 禁止修改其他 feature/模块（如需跨模块改动，Fail-Fast：停下并在 working-log 里提出变更点与理由）。

### 严格遵循规范
- 开工前必须阅读：`src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准
### 必须通过
- `pnpm -s run lint`

### 必须新增/更新测试（至少 1 条，防回归）
- Leak test：adapter destroy 后 eventBus 订阅被移除（按本模块已有测试风格实现）。
- Race test（可选但推荐）：gate 等待期间 destroy，不抛未捕获异常。

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

