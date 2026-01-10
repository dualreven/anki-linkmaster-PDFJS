# Memory Bank - Context（近7日）

最后更新：2026-01-10

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
- 任务目录：
  - A（P0：Annotation 模型单一真源，已合并归档）：`todo-and-doing/4 archive/20260110110206-doing-archive/20260110040857-annotation-model-single-source-A/`
  - B（ScreenshotTool store-reactive，已合并归档）：`todo-and-doing/4 archive/20260110110206-doing-archive/20260110040857-pdf-annotation-screenshot-store-reactive-B/`
  - C（adapters 去 URL pdfId 依赖，已合并归档）：`todo-and-doing/4 archive/20260110110206-doing-archive/20260110040857-adapters-pdfid-provider-C/`
  - D（debounce/throttle 可取消，已合并归档）：`todo-and-doing/4 archive/20260110110206-doing-archive/20260110040857-pdf-search-debounce-cancel-D/`
  - E（TextLayerManager 生命周期回归，已合并归档）：`todo-and-doing/4 archive/20260110110206-doing-archive/20260110040857-text-layer-manager-selection-lifecycle-E/`
- 同步：已对 `anki-linkmaster-A/B/C/D/E` worktree 执行单向覆盖同步到 `main`（2026-01-10 03:45；`git reset --hard main` + `git clean -fd`）。
  - 说明：
    - 旧 A（`20260110033516-pdf-url-loader-install-split-A`）已归档到 `todo-and-doing/4 archive/20260110040857-doing-archive/`；
    - 旧 B/C/D/E（`20260110033517~20260110033520`）已归档到同一目录，并以 `20260110040857-*` 重新下发覆盖；
    - 本轮仅下发 A~E 五个任务目录。
  - 验收合入（2026-01-10）：A/B/C/D/E 已合并并通过 Jest+lint。
  - 人工验收（2026-01-10）：用户确认已通过，相关任务已归档：`todo-and-doing/4 archive/20260110110206-doing-archive/`。

## 2026-01-10：PDFViewer 面条化治理下一批任务（新下发 A~E）
- 依据：
  - `docs/reports/20260109-infra-nav-url-loader-scan-F.md`
  - `docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
- 任务目录（doing）：
  - A：`todo-and-doing/4 archive/20260110162925-doing-archive/20260110123105-infra-nav-navigation-service-cleanup-A/`
  - B：`todo-and-doing/4 archive/20260110162925-doing-archive/20260110123105-pdf-url-loader-install-split-B/`
  - C：`todo-and-doing/4 archive/20260110162925-doing-archive/20260110123105-pdf-outline-ws-decouple-C/`
  - D：`todo-and-doing/4 archive/20260110162925-doing-archive/20260110123105-core-state-manager-granular-events-D/`
  - E：`todo-and-doing/4 archive/20260110162925-doing-archive/20260110123105-core-lifecycle-error-scope-E/`
  - 验收合入（2026-01-10）：已合并并通过 Jest+lint；用户确认人工验收通过。

## 2026-01-10：已知问题（延期）
- KI-20260110-01：outline/search 组合操作偶发触发爆栈日志（`Maximum call stack size exceeded`），用户确认“不太重要”，暂不修复，仅文档化与建 todo。
  - 文档：`docs/bugs/pdf-viewer-known-issues.md`
  - todo：`todo-and-doing/2 todo/20260110014111-outline-search-callstack-overflow-deferred-D/`

## 2026-01-10：新问题（待处理）— pdf-home 打开失败
- 用户日志（2026-01-10 16:41）：
  - `js: [BOOT] import index.js failed TypeError: Failed to fetch dynamically imported module: http://localhost:3000/pdf-home/index.js`
- 初步判断：更像 dev server/端口/静态路由不一致导致 `index.js` 404 或连接失败（HTML 可 loadFinished，但 dynamic import 取模块失败）。
- 后续动作（进行中）：追溯引入点（git log/blame 聚焦 launcher/ports/pyqtui），并明确责任 worktree 后下发修复任务；其余 worktree 下发互不影响的重构任务。

## 2026-01-10：新一轮并行重构任务下发（A~E）
- A：`todo-and-doing/1 doing/20260110014111-pdfviewer-adapters-gate-cancel-A/`
- B：`todo-and-doing/1 doing/20260110014111-infra-ui-event-subscriptions-lift-B/`
- C：`todo-and-doing/1 doing/20260110014111-pdf-annotation-sidebar-timeout-zombie-cleanup-C/`
- D：`todo-and-doing/1 doing/20260110014111-pdf-search-dom-manager-extract-D/`
- E：`todo-and-doing/1 doing/20260110014111-ui-keyboard-handler-idempotent-cleanup-E/`
  - 任务目录归档：`todo-and-doing/4 archive/20260110031204-doing-archive/`

### 2026-01-10：A~E 验收合入 main（完成）
- 合入：
  - A：`8f56a12`（adapters gate 可取消 + 回归）
  - B：`238e233`（infra-ui 订阅上移 + 回归）
  - C：`db2cae3`（annotation sidebar timeout 清理 + 回归）
  - D：`ab6a0f3`（search box DOMManager 集中绑定 + 回归）
  - E：`1d921d2`（keyboard handler leak guard 回归）
- 门禁（main 侧）：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <上述新增/改动测试路径集合> -i` ✅

## 2026-01-10：清理 ABCDE 旧任务目录（已归档）
- 说明：`todo-and-doing/1 doing/202601092234**-*` 为旧一轮下发目录，未开始编码且无交付 commit；为避免继续误读为“当前任务”，已按约定移入 archive。
- 归档位置：`todo-and-doing/4 archive/20260110022652-doing-archive/`

## 2026-01-10：Card Planner（F/G/H）合入 main（已通过门禁，待手工点检）
- 合入内容：
  - F（MsgCenter 后端）：`annotation:bulk-get:requested` handler + 单测（`ba015ae`）
  - F（todo 记录）：`todo-and-doing/...-bulk-get-F/working-log.md`（`d7b451a`）
  - G（前端 core engine）：草稿卡引擎 + 契约回归测试（`68b3e6c`）
  - G（todo 记录）：`todo-and-doing/...-core-engine-G/working-log.md`（`4497712`）
  - H（前端 UI/wiring）：粘贴插入 + MsgCenter 收发 + UI 回归测试（`45883e1`）
  - H（todo 记录）：`todo-and-doing/...-ui-and-wiring-H/working-log.md`（`308bb13`）
- 门禁（main 侧）：
  - `pnpm -s run lint` ✅
  - `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_annotation_bulk_get_unit.py` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/cards-engine.contract.test.js -i` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i` ✅
- 备注：
  - 说明：H 任务当时为并行解耦设计，历史上 UI 曾使用 `FakeEngine`；后续已完成“引擎接入 UI”（见下文交付记录），当前代码侧已可直接使用真实引擎。

## 2026-01-10：new-card-scheduler 侧边栏遮挡修复（已合入 main，待手工验收）
- 合入（main）：
  - `8a88d90 feat(new-card-scheduler): sidebar push layout`
  - `60b5a50 docs(todo): log sidebar push delivery`
- 后续小改动（main）：
  - `b24fbd4 fix(new-card-scheduler): keep small toggle button when collapsed`
  - `3ff174e docs(todo): log sidebar toggle handle tweak`
- 回归测试：`src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js`
- 手工点检：打开 `http://localhost:3000/new-card-scheduler/`，折叠/展开时主区域随之收缩/扩张；折叠后仍保留可点击的小开关按钮用于再次展开。

## 2026-01-10：Card Planner 手工测试能力补齐（F/G/H/I 新任务下发）
- 背景：当前环境不具备“外部条件”注入/创建草稿卡与联调回执，需补齐可手工点检入口。
- 已交付（但人工验收失败，已归档）：`todo-and-doing/4 archive/20260110125102-doing-archive/`
  - 失败：MsgCenter 拒绝 `to="new-card-scheduler"`；且 new-card-scheduler 出现多窗口（应全局唯一）。
- v002 修复（已合入 main；验收发现 Step4 竞态问题，已归档以便返工）：
  - F（注入修复：forward 到窗口）：`1684a35`（docs：`9848040`）
    - 注入消息必须用 `to=[{"client_id":"new-card-scheduler"}]`（`to` 字符串仅允许 `"backend"`）
  - G（清空草稿卡）：`9a4c5e6`
  - H（ingest 注入可视化反馈）：`563aa69`（docs：`906e7e3`）
  - I（new-card-scheduler 全局唯一/单例激活）：`5fe678e`
  - 归档：`todo-and-doing/4 archive/20260110172024-doing-archive/`

## 2026-01-10：Card Planner 手工验收 Step4 失败（NO_TARGET_FOUND）→ 下发 v003
- 现象：`card-planner:ingest:requested` 使用 forward `to=[{"client_id":"new-card-scheduler"}]`，但 MsgCenter 返回 `NO_TARGET_FOUND(404)`，窗口未新增卡片。
- 初步定位：目标窗口 WS 尚未完成注册/不可路由时，MsgCenter forward 直接失败（仅 `pdf-viewer:navigate:requested` 有 pending-forward 特例）。
- v003 任务（doing）：
  - F（注入 ACK 可观测性增强）：`todo-and-doing/1 doing/20260110172214-card-planner-gui-launcher-inject-observability-F/`
  - G（窗口侧 WS 状态展示）：`todo-and-doing/1 doing/20260110172214-card-planner-new-card-scheduler-ws-status-G/`
  - H（Planner ingest completed/failed 回执）：`todo-and-doing/1 doing/20260110172214-card-planner-ingest-contract-ack-H/`
  - I（MsgCenter pending-forward 支持 ingest）：`todo-and-doing/1 doing/20260110172214-card-planner-msgcenter-pending-forward-ingest-I/`

## 2026-01-10：任务调整（删除非主线 G/H/I 任务，围绕 Card Planner 重新下发）
- 已删除（不再维护）：
  - `todo-and-doing/1 doing/20260110024409-pdfviewer-adapters-gate-cancel-G/`
  - `todo-and-doing/1 doing/20260110024410-pdf-search-dom-manager-extract-H/`
  - `todo-and-doing/1 doing/20260110024411-infra-ui-event-subscriptions-lift-I/`
- Card Planner（G/H/I）本轮交付（已合入 main 并归档）：
  - G（引擎接入 UI）：`91e6984` + `3dbe243`
  - H（标注元信息默认 WS）：`46da3e7`（docs：`3724914`）
  - I（Final Output 后端 handler）：`d7cdd9b`
  - 归档：`todo-and-doing/4 archive/20260110103959-doing-archive/`

## 2026-01-10：归档（Card Planner F/G/H）
- 用户确认后已将已完成的 Card Planner 三条任务从 `todo-and-doing/1 doing/` 归档到：
  - `todo-and-doing/4 archive/20260110030722-doing-archive/`

## 2026-01-09：PDFViewer 面条化治理详细记录（已归档）
- 说明：为满足 `context.md` 行数门禁（<200），已将 2026-01-09 的详细过程记录迁移到归档文件（不加载进上下文）。
- 归档：`docs/context-archive/2026-01/context-2026-01-week2.md`

## 2026-01-10：新卡片规划器实现复核（16:40）
- 报告：`AItemp/reports/20260110164032-new-card-scheduler-implementation-check.md`
- 结论：核心能力（engine/UI/paste/meta/final-output）已具备；与 MsgCenter `to` 新协议的关键点（forward 注入 + planner 侧仅 toast/render）已对齐；`state:get` 的回执路由仍需文档明确。
