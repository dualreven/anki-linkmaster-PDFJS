# Memory Bank - Context（近7日）

最后更新：2026-01-09

## 当前主线：PDFViewer 面条代码整治（进行中）
- **目标**：把 `src/frontend/pdf-viewer/**` 中“事件驱动 + 状态驱动混杂、职责过载、订阅泄漏”等面条化热点拆分并加回归测试。
- **并行扫描（已完成）**：
  - 已给 A/B/C/D 下发 `pdfviewer-spaghetti-scan-*` doing；各自输出扫描报告到各 worktree 的 `AItemp/reports/*-pdfviewer-scan-*.md`（注意：`AItemp/` 被 gitignore）。
- **扫描汇总（已完成）**：
  - 扫描报告与汇总计划已入库：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`。
- **第一轮并行重构（已合入 main，待手工点检）**：
  - A(adapters)：`feat(pdf-viewer-adapters): converge inbound routing and decouple pdfId`
  - B(infra-ui)：`refactor(infra-ui): introduce coordinator and slim ui-manager-core`
  - C(pdf-annotation)：`refactor(pdf-annotation): make screenshot tool store-reactive`
  - D(bootstrap/search/outline)：`fix(pdf-viewer): cleanup bootstrap zoom guard; tighten search/outline`
  - 门禁：`pnpm -s run lint` + 关键 Jest 路径通过（由 main 侧统一跑）。
- **下一步**：用户使用 `gui_launcher` 手工点检上述行为；如发现 bug，按责任模块下发新的 doing 并同步给对应 worktree。

## 2026-01-09：组合场景日志报错（待修复，已下发任务）
- **现象**：打开搜索栏时点击大纲跳转，出现日志：
  - `事件回调执行出错：Maximum call stack size exceeded [Serialization Error: Maximum call stack size exceeded]`
- **影响**：不影响功能，但污染日志/误导排障。
- **怀疑根因**：tracing 记录链路对 payload 直接 `JSON.stringify(data)` 未保护，遇到深对象/循环引用时爆栈。
- **已下发修复任务（D，P0）**：`todo-and-doing/1 doing/20260109104510-eventbus-tracing-safe-serialize-D/v001-spec.md`

## 2026-01-09：并行工作树扩展（A~F）
- 新增 worktree：E / F（基于 main），用于 6 AI 并行。
- 新一轮任务（A~F）已下发至 `todo-and-doing/1 doing/`（见各任务目录 `v001-spec.md`）。

## 近期关键事实（已完成/可复用）

### 2026-01-08：pdf-anchor 测试阻塞修复（已完成）
- **现象**：`src/frontend/pdf-viewer/features/pdf-anchor/index.js` 引用 `./services/anchor.manager.js`，但文件缺失导致 Jest 报 `Cannot find module`。
- **修复**：合入 `refactor(pdf-anchor): add anchor manager store`（新增 `src/frontend/pdf-viewer/features/pdf-anchor/services/anchor.manager.js` 并对齐 tracker/store 接口）。
- **验证**：`pnpm -s run lint` + 多个 `pdf-anchor` Jest 用例通过。

### 2026-01-07：Feature 内部 EventBus 增量门禁（已完成）
- **目的**：防止在 `src/frontend/pdf-viewer/features/**` 新增/扩大“Feature 内部 UI↔Manager 依赖 EventBus 事件闭环”的混合态。
- **实现**：`scripts/ci/feature-internal-eventbus-gates.js`（baseline 增量策略）并接入 `pnpm -s run lint`。
- **文档**：`docs/standards/feature-internal-eventbus-gates.md`。

### 2026-01-07：并行合入效率工具（已完成）
- **命令**：`pnpm -s run merge:sweep`
- **实现**：`scripts/sweep_and_merge.py` + `scripts/merge_fastlane.py`（自动发现 worktree 领先提交、批量 cherry-pick、跑 lint + 指定 Jest）。
- **文档**：`docs/reports/20260107-merge-optimization-plan.md`。

### 2026-01-05：标注侧边栏空白兼容修复（已完成）
- **根因**：历史 screenshot 数据仅含像素 `rect`，缺少 `rectPercent`；严格解析导致“一条坏数据拖垮整批”。
- **修复策略**：兼容 legacy 字段并逐条解析跳过坏条，避免 UI 全空白。
