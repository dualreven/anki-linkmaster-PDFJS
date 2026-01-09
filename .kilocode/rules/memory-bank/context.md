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

## 2026-01-09：组合场景日志报错（已修复）
- **现象**：打开搜索栏时点击大纲跳转，出现日志：
  - `事件回调执行出错：Maximum call stack size exceeded [Serialization Error: Maximum call stack size exceeded]`
- **影响**：不影响功能，但污染日志/误导排障。
- **根因**：tracing 记录链路对 payload 直接 `JSON.stringify(data)` 未保护，遇到深对象/循环引用时爆栈。
- **修复**：EventBus tracing 序列化改为 Fail-Closed（失败写占位字符串，不影响业务回调执行），并补回归测试（见下方 D 任务记录）。

## 2026-01-09（完成）A：pdf-outline 事件 payload 体积治理
- **任务**：`todo-and-doing/1 doing/20260109104600-outline-event-payload-hygiene-A/v001-spec.md`
- **提交**：`e78feb9`
- **改动**：
  - `OUTLINE.SELECT.CHANGED` 发射 payload 收敛为 `{ outlineItemId }`（不再携带 `outlineItem/raw/children`）
  - `OUTLINE.NAVIGATE.REQUESTED` 统一为 `{ pageAt, position }`（顶层字段；保留对旧 `{ outlineItem }` 的兼容解析）
- **验收**：
  - `pnpm -s run lint` ✅（含行数门禁）
  - `pnpm exec jest --runTestsByPath` ✅（新增 `outline-event-payload-hygiene.test.js` + 相关用例）

## 2026-01-09（已完成）B：infra-sidebar DraggableResizer 抽离 + 泄漏回归测试
- **提交（worktree B）**：`55b5c9a refactor(infra-sidebar): extract draggable resizer`（参见 `todo-and-doing/1 doing/20260109104620-infra-sidebar-draggable-resizer-B/working-log.md`）。
- **范围**：`src/frontend/pdf-viewer/features/infra-sidebar/**`
- **要点**：
  - 抽离 `DraggableResizer` 封装拖拽绑定/解绑；destroy 支持“拖拽中途销毁清理 document 监听器”；
  - `SidebarManagerFeature` 不再常驻注册 document mousemove/mouseup，降低泄漏面。
- **回归**：新增“mousedown 后立刻 destroy 必须解绑”单测，更新既有 uninstall 清理测试覆盖“拖拽中途卸载”。

## 2026-01-09（完成）C：pdf-annotation TextHighlightTool store-reactive
- **任务**：`todo-and-doing/1 doing/20260109104640-text-highlight-store-reactive-C/v001-spec.md`
- **提交**：`a74d95e`
- **要点**：TextHighlightTool 订阅 `AnnotationManager.store`，用 state diff 驱动 overlay 增删改，减少 EventBus 交织与订阅泄漏风险。

## 2026-01-09（完成）D：EventBus tracing safe serialize（P0）
- **任务**：`todo-and-doing/1 doing/20260109104510-eventbus-tracing-safe-serialize-D/v001-spec.md`
- **提交**：`2bf0b3b`
- **要点**：`enableTracing=true` 时 tracing/日志链路对 payload 的序列化改为 Fail-Closed（失败写占位字符串，不影响业务回调执行）。
- **回归**：新增 `src/frontend/common/event/__tests__/event-bus.tracing.safe-serialize.regression.test.js` 覆盖循环引用与 stringify 抛错场景。

## 2026-01-09：A~F 第二轮交付（已验收并合入 main）
- **门禁**：`pnpm -s run lint` ✅；Jest（按路径）✅。
- **main 合入（可回溯）**：
  - A：`5565695`（outline payload 收敛）+ `29eddbd`（memory-bank 记录）
  - B：`5c75fb9`（DraggableResizer 抽离）+ `1636a85`（todo/memory-bank 记录）
  - C：`c03bf67`（TextHighlightTool store-reactive）
  - D：`6635e8d`（safe serialize + 回归）+ `542c4b7`（todo 记录）
  - E：`561bf17`（报告：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`）
  - F：`554ccdd`（报告：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`）

## 2026-01-09（完成）E：PDFViewer core/ui 面条化扫描报告
- **产出**：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`

## 2026-01-09（完成）F：infra-nav / pdf-url-loader 面条化扫描报告
- **产出**：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`

## 2026-01-09：手工点检反馈（P0 仍存在）
- **现象**：仅在“搜索栏打开 + 点击大纲跳转”组合场景仍出现 `Maximum call stack size exceeded`。
- **初步定位**：报错来源不再是 tracing 序列化；疑似 `pdf-viewer:navigation:goto` 的同步事件环（subscriberId：`InfraUICoordinator.NavGoto`）。

## 2026-01-09：A~F 第三轮任务下发（进行中）
- **协作约定（本轮）**：各 worktree 不要改 `memory-bank`；只改任务范围 + 任务目录 `working-log.md`；main 侧验收合入时统一更新 `memory-bank`，避免冲突。
- **任务目录**：见 `todo-and-doing/1 doing/`（D 仅修复上述 P0 bug，其余为互不干扰的小步重构/回归测试）。
- **流程文档**：并行调度/验收合入的固定流程已沉淀到 `.kilocode/rules/memory-bank/workflow-parallel-worktrees.md`。

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
