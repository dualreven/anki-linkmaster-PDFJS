# Memory Bank - Context（近7日）

最后更新：2026-01-11

## 规划者（Planner）硬约束（必须遵守）
- **worktree 必须自检并产出报告**：每个任务必须在 worktree 内跑 `pnpm -s run lint` + 定向测试（Jest/pytest 等），并在任务目录提交 `report.md`（含 scope、命令、结果、commit hash）。
- **worktree 必须提交交付**：自检通过后必须 `git commit`（没有 commit hash 不算完成；禁止只改不提）。
- **任务必须隔离**：每个任务必须写死 `scope`（允许修改的目录/文件列表），且不同任务的 `scope` **不允许重叠**；目标是 main 合并时不应产生冲突。
- **规划者职责与验收策略**：规划者仅负责派工/归档/同步/收集与合并验收（不写业务代码）；验收时优先阅读 worktree `report.md` 以减少重复跑 lint/test，但 main 侧仍需跑一次集成门禁；每批次需给出总体进度粗评（0~10）与下一步风险点并记录到 context。

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
## 2026-01-10：前端面条化复评（完成）
- 对比：`main@88998f5` → `main@045c42e`
- 结论：整体仍偏低，粗评约 **2~3/10**；上一轮指出的 **P0（Annotation 模型重复真源）已修复为单一真源 + 防回归测试**。
- 门禁（只读）：`pnpm -s run ci:frontend-line-limit` ✅（含 feature-internal-eventbus-gates / pdfviewer-global-listener-gates）。
- 报告：`AItemp/reports/20260110170745-frontend-spaghetti-report.md`（本地；`AItemp/` gitignore）。

## 2026-01-10：PDFViewer 面条化治理继续推进（新一轮任务下发 A~E）
- 依据：
  - `docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`
  - `docs/reports/20260109-infra-nav-url-loader-scan-F.md`
  - `docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
  - `docs/reports/20260108-pdfviewer-scan-D.md`
- 任务目录：A~E（首轮）均已合并并归档至 `todo-and-doing/4 archive/20260110110206-doing-archive/`。
- 同步：已对 `anki-linkmaster-A/B/C/D/E` worktree 执行单向覆盖同步到 `main`（2026-01-10 03:45；`git reset --hard main` + `git clean -fd`）。
  - 说明：
    - 旧 A（`20260110033516-pdf-url-loader-install-split-A`）已归档到 `todo-and-doing/4 archive/20260110040857-doing-archive/`；
    - 旧 B/C/D/E（`20260110033517~20260110033520`）已归档到同一目录，并以 `20260110040857-*` 重新下发覆盖；
    - 本轮仅下发 A~E 五个任务目录。
  - 验收合入（2026-01-10）：A/B/C/D/E 已合并并通过 Jest+lint。
  - 人工验收（2026-01-10）：用户确认已通过，相关任务已归档：`todo-and-doing/4 archive/20260110110206-doing-archive/`。

## 2026-01-10：PDFViewer 近期批次索引（已归档）
- 20260110123105 批次 A~E：`todo-and-doing/4 archive/20260110162925-doing-archive/`（已合入 main，Jest+lint ✅，用户已人工点检确认）

## 2026-01-10：已知问题（延期）
- KI-20260110-01：outline/search 组合操作偶发触发爆栈日志（`Maximum call stack size exceeded`），用户确认“不太重要”，暂不修复，仅文档化与建 todo。
  - 文档：`docs/bugs/pdf-viewer-known-issues.md`
  - todo：`todo-and-doing/2 todo/20260110014111-outline-search-callstack-overflow-deferred-D/`

## 2026-01-10：pdf-home 打开失败（已修复）
- 用户日志（2026-01-10 16:41）：
  - `js: [BOOT] import index.js failed TypeError: Failed to fetch dynamically imported module: http://localhost:3000/pdf-home/index.js`
- 根因（已定位）：Windows + QtWebEngine 下 `localhost` 的 IPv4/IPv6 解析不稳定；Vite 可能仅监听 `::1`，导致 `127.0.0.1:<vite_port>` 连接被拒绝，从而出现“页面加载完成但动态 import 拉取失败”。
- 修复（已在 main 实施，待手工点检）：统一前端 loopback host 为 `127.0.0.1`；Vite 默认 `VITE_HOST=127.0.0.1`；`ensure_vite` 以 IPv4 可达为准并同步写入 `url_port=vite_port`；补回归测试覆盖（dev_server + URL 构建）。

## 2026-01-10：近期批次索引补充（已归档）
- 20260110014111 批次 A~E：`todo-and-doing/4 archive/20260110031204-doing-archive/`（已合入 main，Jest+lint ✅，用户已人工点检确认）
- 20260110175029 批次 A~E：`todo-and-doing/4 archive/20260110185147-doing-archive/`（已合入 main，Jest+lint ✅，用户已人工点检确认）

## 2026-01-10：清理 ABCDE 旧任务目录（已归档）
- 说明：`todo-and-doing/1 doing/202601092234**-*` 为旧一轮下发目录，未开始编码且无交付 commit；为避免继续误读为“当前任务”，已按约定移入 archive。
- 归档位置：`todo-and-doing/4 archive/20260110022652-doing-archive/`

## 2026-01-11：Card Planner / New Card Scheduler（摘要）
- 说明：本节非 PDFViewer 面条化主线；为满足 `context.md` 行数门禁，仅保留摘要（细节以 working-log 为准）。
- 当前状态：v004 修复已合入 main（2026-01-10），用于解决 Step3 注入“queued 但未生效”的链路缺口（客户端注册 + queued 自愈打开窗口 + ACK_META 可观测 + 注册状态可视）。
- v004：注入链路修复已合入并归档：`todo-and-doing/4 archive/20260110212636-doing-archive/`。
- v005：`annotation:bulk-get` 超时修复已合入并归档：`todo-and-doing/4 archive/20260111000112-doing-archive/`。
- v006：NCS 启动范式对齐已合入并归档：`todo-and-doing/4 archive/20260111015251-doing-archive/`。
- v007：修复 NCS 空白/未注册已合入并归档：`todo-and-doing/4 archive/20260111125406-doing-archive/`；v008：修复 legacy feature 安装失败（eventBus 上下文字段对齐）+ 增强自检/创建空卡/等待注册注入 已合入并归档：`todo-and-doing/4 archive/20260111141035-doing-archive/`。

## 2026-01-09：PDFViewer 面条化治理详细记录（已归档）
- 说明：为满足 `context.md` 行数门禁（<200），已将 2026-01-09 的详细过程记录迁移到归档文件（不加载进上下文）。
- 归档：`docs/context-archive/2026-01/context-2026-01-week2.md`

## 2026-01-10：新卡片规划器实现复核（16:40）
- 报告：`AItemp/reports/20260110164032-new-card-scheduler-implementation-check.md`
- 结论：核心能力（engine/UI/paste/meta/final-output）已具备；与 MsgCenter `to` 新协议的关键点（forward 注入 + planner 侧仅 toast/render）已对齐；`state:get` 的回执路由仍需文档明确。

## 2026-01-10：pdf-annotation Sidebar zombie cleanup（C）
- 结论：`AnnotationSidebarUI` 列表渲染为 store 驱动；sidebar subscriptions 不订阅 CRUD 事件（避免双驱动回潮）。
- 回归：`src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.store-driven.test.js`
- 交付：`b115188`（`worker/refactor-C`）

## 2026-01-10：验收合并 ABCDE（20260110175029 批次）✅
- 合入（main）：
  - A：`078578f`（pdf-home loopback host 验证/排障文档）
  - B：`f9b963b`（infra-ui coordinator subscriptions 拆分 + uninstall 清理回归）
  - C：`c286cae`（sidebar store-driven 契约回归测试强化）
  - D：`56641fc`（任务重复关闭：本批无代码改动）
  - E：`8535dfd`（KeyboardHandler 防重复监听 + 回归）
- 门禁：`pnpm -s run lint` ✅；Jest（定向）✅
- 归档：`todo-and-doing/4 archive/20260110185147-doing-archive/`

## 2026-01-10：PDFViewer 面条化治理复评（补充：含 ABCDE 批次合入）
- 粗评分：**约 4/10**（上一轮复评为 2~3/10；本轮合入进一步补齐了“可卸载/可测试”的硬门槛）。
- P0-1（全局监听器缺少卸载）：✅ 已治理：`src/frontend/pdf-viewer/bootstrap/page-zoom-guard-feature.js:85`（install）/`:96`（uninstall）。
- P1-A（adapters URL 依赖）：✅ 已治理（adapters 不再直接依赖 `window.location`/URL 来取 pdfId）。
- P1-B（infra-ui 巨型订阅中心）：🟡 部分治理：已抽出 coordinator+subscriptions，但 `ui-manager-core-*` 旧壳仍在（需后续继续瘦身/迁移）。
  - 证据：`src/frontend/pdf-viewer/features/infra-ui/infra-ui-coordinator.js:33`（destroy 清理订阅）。
- P1-C（pdf-annotation tools store-reactive）：🟡 部分治理：sidebar 已 store-driven；CommentTool 已改为 store-reactive（去 `DATA.LOADED` 硬依赖），其余 tools 仍需持续推进。

## 2026-01-10：CommentTool store-reactive（C）
- 结论：CommentTool marker 渲染/恢复由 `annotationManager.store` 驱动，移除对 `ANNOTATION.DATA.LOADED` 的硬依赖（避免事件驱动补画导致分叉）。
- 回归：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool.store-reactive.test.js`
- 交付（main）：`b3006488`
- P1-D（search/outline 解耦）：🟡 基本治理：search DOM bindings 已收敛到 DOM manager 且带 cleanup 测试；outline UI 不再直连 WS 事件。
  - 证据：`src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js:5`（init/cleanup 契约）。
- P0 结构性债务提示（“标注模型重复真源”）：当前 `pdf-annotation` 侧为**复出口**而非重复实现：`src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js:4`（唯一真源说明）。

## 2026-01-10：PDFViewer 面条化治理新派工（A~E）
- 批次：`20260110195258`（已下发到 `todo-and-doing/1 doing/`，准备同步覆盖到 A~E worktree）。
- A：Annotation 单真源防分叉门禁（lint）：`todo-and-doing/1 doing/20260110195258-pdfviewer-annotation-single-source-guard-A/`
- B：infra-ui 移除 filename→pdfId 兜底 + 清理 setTimeout 竞态：`todo-and-doing/1 doing/20260110195258-pdfviewer-infra-ui-remove-fallback-timeouts-B/`
- C：CommentTool store-reactive（去 DATA.LOADED 依赖）：`todo-and-doing/1 doing/20260110195258-pdfviewer-annotation-commenttool-store-reactive-C/`
- D：pdf-search 移除旧 DOM bindings 壳（收敛到 DOMManager）：`todo-and-doing/1 doing/20260110195258-pdfviewer-pdf-search-remove-dom-bindings-shell-D/`
- E：PDFViewerManager PDF.js EventBus bridge 可卸载（防监听泄漏）：`todo-and-doing/1 doing/20260110195258-pdfviewer-manager-pdfjs-bridge-uninstall-E/`

## 2026-01-10：验收合并 ABCDE（20260110195258 批次）✅
- 合入（main）：
  - A：`13fe160a`（annotation 单真源 lint 门禁）
  - B：`7f77cba5`（移除兜底 + RENDER.READY 初始化 + 回归）
  - C：`b3006488`（CommentTool store-reactive + 回归）
  - D：`0c1d5df3`（移除 search DOM bindings 旧壳 + 回归）
  - E：`3d016edf`（PDFViewerManager bridge 可卸载 + 回归）
- 门禁：`pnpm -s run lint` ✅；Jest（定向）✅
- 归档：`todo-and-doing/4 archive/20260110211119-doing-archive/`

## 2026-01-10：PDFViewer 面条化治理新派工（A~E，20260110220446）
- 说明：本批不升级 KI-20260110-01（爆栈）为必须修；E 的 CI gate 要求严格失败（无 allowlist 过渡）。
- A（core）：LifecycleManager 全局错误监听器可卸载（已验收归档）：`todo-and-doing/4 archive/20260111002542-doing-archive/20260110220446-pdfviewer-core-lifecycle-error-listeners-uninstall-A/`
- B（infra-ui）：coordinator 迁移收尾 + 严格隔离订阅（已验收归档）：`todo-and-doing/4 archive/20260111002542-doing-archive/20260110220446-pdfviewer-infra-ui-coordinator-hardening-B/`
- C（pdf-annotation）：TextHighlightTool store-reactive 扩面（已验收归档）：`todo-and-doing/4 archive/20260111002542-doing-archive/20260110220446-pdfviewer-annotation-tooling-store-reactive-expansion-C/`
- D（assets）：GlobalErrorToast 可卸载（已验收归档）：`todo-and-doing/4 archive/20260111002542-doing-archive/20260110220446-pdfviewer-assets-global-error-toast-uninstall-D/`
- E（CI）：禁止 components 直接 `eventBus.on(...)`（严格失败；已验收归档）：`todo-and-doing/4 archive/20260111002542-doing-archive/20260110220446-ci-pdfviewer-no-eventbus-on-in-components-E/`

## 2026-01-11：验收合并 ABCDE（20260110220446 批次）✅
- 合入（main，隔离提取合入）：
  - A：`daa0cc05`（LifecycleManager 全局错误监听器可卸载 + 回归）
  - B：`396d3505`（infra-ui subscriptions 强化 + 回归）
  - C：`7df1766b`（TextHighlightTool：补回归，覆盖 store unsubscribe）
  - D：`5a489bd4`（GlobalErrorToast 可安装/可卸载 + 回归）
  - E：`863d7d99`（CI gate：禁止 components 直接 `eventBus.on(...)`，增量严格）
- 门禁：`pnpm -s run lint` ✅；Jest（定向）✅
- 归档：`todo-and-doing/4 archive/20260111002542-doing-archive/`

## 2026-01-10：已知但暂不升级的 bug（记录）
- KI-20260110-01（爆栈）：仍未修复；用户确认“暂不重要/不升级为必须修”。后续如复现路径清晰，再单独下发专项任务。


## 2026-01-11：PDFViewer 面条化治理新派工（A~E，20260111010855）
- 本批任务 A~E 已全部验收归档：`todo-and-doing/4 archive/20260111022704-doing-archive/`。
  - 旧 E（pdf-home 修复，已过时）已归档：`todo-and-doing/4 archive/20260111013701-doing-archive/20260111010855-gui-launcher-vite-loopback-host-and-pdf-home-reliability-E/`。

## 2026-01-11：验收合并 ABCDE（20260111010855 批次）✅
- 合入（main）：
  - A：`9736a77c`（KeyboardHandler lifecycle hardening + 回归增强）
  - B：`c2a73537`（ui-manager-core assembly 抽离 + 装配/销毁回归）
  - C：`566f9002`（annotation toggle button keydown 可卸载 + 回归）
  - D：`1cab5375`（pdf-search：订阅从 components 上移，满足 `pdfviewer-no-eventbus-on-in-components` gate + 回归）
  - E：`157417e8`（outline store-driven selection + UI 边界/cleanup 回归）
- 门禁：`pnpm -s run lint` ✅；Jest（定向）✅
- 归档：`todo-and-doing/4 archive/20260111022704-doing-archive/`

## 2026-01-11：PDFViewer 面条化治理新派工（A~E，20260111140159）
- 治理进度（规划者粗评）：约 **6/10**（目标：继续把“订阅/副作用/等待竞态”收敛到可卸载 + 可测的装配层）
- 执行者 DoD（硬要求）：`pnpm -s run lint` + 定向 `pnpm exec jest --runTestsByPath <tests> -i` ✅；更新各自 `report.md`（含命令与输出摘要、commit hash、改动文件清单）；最终必须 git 提交
- 任务目录（doing）：
  - A：`todo-and-doing/1 doing/20260111140159-pdfviewer-adapters-inbound-router-slim-A/`
  - B：`todo-and-doing/1 doing/20260111140159-pdfviewer-infra-ui-side-effects-hardening-B/`
  - C：`todo-and-doing/1 doing/20260111140159-pdfviewer-annotation-screenshot-store-reactive-C/`
  - D：`todo-and-doing/1 doing/20260111140159-pdfviewer-bootstrap-cancellable-wait-D/`
  - E：`todo-and-doing/1 doing/20260111140159-pdfviewer-url-loader-contract-hardening-E/`
