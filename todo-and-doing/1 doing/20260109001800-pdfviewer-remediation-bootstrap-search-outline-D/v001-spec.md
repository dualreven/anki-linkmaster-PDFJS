# PDFViewer bootstrap/search/outline：P0 清理 + 解耦

**功能ID**: 20260109001800-pdfviewer-remediation-bootstrap-search-outline-D  
**优先级**: 高（含 P0）  
**版本**: v001  
**创建时间**: 2026-01-09 00:18:00  
**状态**: 设计中

## 现状说明
- 扫描报告：`docs/reports/20260108-pdfviewer-scan-D.md`
- 涉及范围：
  - `src/frontend/pdf-viewer/bootstrap/**`
  - `src/frontend/pdf-viewer/features/pdf-search/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**`

## 存在问题
- P0：`app-bootstrap-feature.js` 安装了全局 `wheel`/`keydown` 监听器，但缺少卸载。
- search：DOM bindings 与业务逻辑混杂，`SearchManager` 职责过载。
- outline：UI 组件直接订阅 `WEBSOCKET_EVENTS`，跨层耦合。

## 提出需求
- P0：在销毁/卸载路径中明确移除 wheel/keydown 监听器（Fail-Fast：必须可验证）。
- search：拆出 DOM manager（只管 DOM），业务逻辑留在 manager/service。
- outline：WS 消息只进入 manager/adapter，UI 只订阅领域事件/store。

## 解决方案（建议）
- 先做 P0（全局监听器卸载）并补测试，再做 search/outline 拆分。
- search：新增 `SearchBoxDOMManager`，提供 `init()`/`cleanup()`，由 SearchFeature 装配调用。
- outline：把 WS 订阅收敛到 `OutlineManager`（或等价桥接层），UI 不再直连 `WEBSOCKET_EVENTS`。

## 约束条件
### 仅修改本模块代码
- 只允许修改：
  - `src/frontend/pdf-viewer/bootstrap/**`
  - `src/frontend/pdf-viewer/features/pdf-search/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
- 允许新增测试：
  - `src/frontend/pdf-viewer/bootstrap/**/__tests__/**`
  - `src/frontend/pdf-viewer/features/pdf-search/**/__tests__/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**/__tests__/**`
- 禁止修改其他 feature（如需跨模块改动，Fail-Fast：停下并在 working-log 里提出变更点与理由）。

### 严格遵循规范
- 开工前必须阅读：`src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准
### 必须通过
- `pnpm -s run lint`

### 必须新增/更新测试（至少 1 条，防回归）
- P0：destroy/uninstall 后 wheel/keydown 监听器被移除（可通过 spy `window.removeEventListener` 或全局标记清空可验证）。
- search DOM manager：init/cleanup 绑定与解绑可测（JSDOM）。

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

