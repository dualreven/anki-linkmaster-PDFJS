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

## 2026-01-10：PDFViewer 面条化治理继续推进（新一轮任务下发 A~E）
- 依据：
  - `docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`
  - `docs/reports/20260109-infra-nav-url-loader-scan-F.md`
  - `docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
  - `docs/reports/20260108-pdfviewer-scan-D.md`
- 任务目录：
  - A（P0：Annotation 模型单一真源）：`todo-and-doing/1 doing/20260110040857-annotation-model-single-source-A/`
  - B（ScreenshotTool store-reactive）：`todo-and-doing/1 doing/20260110040857-pdf-annotation-screenshot-store-reactive-B/`
  - C（adapters 去 URL pdfId 依赖）：`todo-and-doing/1 doing/20260110040857-adapters-pdfid-provider-C/`
  - D（debounce/throttle 可取消）：`todo-and-doing/1 doing/20260110040857-pdf-search-debounce-cancel-D/`
  - E（TextLayerManager 生命周期回归）：`todo-and-doing/1 doing/20260110040857-text-layer-manager-selection-lifecycle-E/`
- 同步：已对 `anki-linkmaster-A/B/C/D/E` worktree 执行单向覆盖同步到 `main`（2026-01-10 03:45；`git reset --hard main` + `git clean -fd`）。
  - 说明：
    - 旧 A（`20260110033516-pdf-url-loader-install-split-A`）已归档到 `todo-and-doing/4 archive/20260110040857-doing-archive/`；
    - 旧 B/C/D/E（`20260110033517~20260110033520`）已归档到同一目录，并以 `20260110040857-*` 重新下发覆盖；
    - 本轮仅下发 A~E 五个任务目录。

## 2026-01-10：已知问题（延期）
- KI-20260110-01：outline/search 组合操作偶发触发爆栈日志（`Maximum call stack size exceeded`），用户确认“不太重要”，暂不修复，仅文档化与建 todo。
  - 文档：`docs/bugs/pdf-viewer-known-issues.md`
  - todo：`todo-and-doing/2 todo/20260110014111-outline-search-callstack-overflow-deferred-D/`

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
  - 当前 `new-card-scheduler` UI 仍默认使用 `FakeEngine`（H 任务为并行解耦设计）；G 的真实引擎已合入并有回归测试，下一步可在不改 UI 的前提下切换到真实引擎。

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
- 任务目录（doing）：
  - F（gui_launcher 一键注入样例草稿卡）：`todo-and-doing/1 doing/20260110105623-card-planner-gui-launcher-manual-test-F/`
  - G（UI 直接创建空卡）：`todo-and-doing/1 doing/20260110105623-card-planner-create-empty-card-G/`
  - H（final-output 回执 toast 可见性）：`todo-and-doing/1 doing/20260110105623-card-planner-final-output-ack-ui-H/`
  - I（final-output completed 回显 payload 便于验收）：`todo-and-doing/1 doing/20260110105623-card-planner-final-output-echo-I/`

### 2026-01-10：H(final-output 回执 toast)（worktree 交付）
- 交付（`worker/feature-H`）：`ea673af`（发送补齐 `request_id/timestamp`；订阅 `final-output:completed/failed` 并 toast；dispose 解绑；新增 Jest 回归测试）

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
