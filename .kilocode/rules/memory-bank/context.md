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

## 2026-01-10：任务调整（侧边栏遮挡改为 F 单点负责 + G/H/I 领取其它任务）
- 变更：已撤销“侧边栏遮挡修复拆分 FGHI”的旧任务目录；现改为 **F 单 worktree 完整交付**（实现+wiring+回归测试）。
- 当前任务：
  - F（new-card-scheduler 侧边栏 push）：`todo-and-doing/1 doing/20260110024408-new-card-scheduler-sidebar-push-F/`
  - G（pdf-viewer adapters gate/destroy）：`todo-and-doing/1 doing/20260110024409-pdfviewer-adapters-gate-cancel-G/`
  - H（pdf-search DOMManager）：`todo-and-doing/1 doing/20260110024410-pdf-search-dom-manager-extract-H/`
  - I（infra-ui 订阅清理）：`todo-and-doing/1 doing/20260110024411-infra-ui-event-subscriptions-lift-I/`

## 2026-01-10：归档（Card Planner F/G/H）
- 用户确认后已将已完成的 Card Planner 三条任务从 `todo-and-doing/1 doing/` 归档到：
  - `todo-and-doing/4 archive/20260110030722-doing-archive/`

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

## 2026-01-09：手工点检反馈（二次确认）
- **结论**：第三轮 D 的修复合入后，P0 仍可复现（以手工点检结果为准）。
- **策略**：D 继续专注该 P0 的复现、最小化用例与修复；本轮不再给 D 分派新任务。

## 2026-01-09：第4轮（ABCEF）验收合入
- **main 合入**：
  - A：`16b3f9e`（Lifecycle 全局错误监听卸载对称）
  - B：`abf34a8`（StateManager.batchUpdate 异常安全）
  - C：`f85c2cc`（NavigationService waitForPageReady 可取消）
  - E：`86ed055`（pdf-url-loader uninstall 清理加固；另已移除误提交的 AItemp 文件：`c28548e`）
  - F：`a3c842c`（DOMElementManager required DOM 契约 + 单测）
- **门禁**：`pnpm -s run lint` ✅；Jest（按路径）✅。

## 2026-01-09：回归（已修复）infra-ui 启动缺失 DOM 元素
- **现象**：`infra-ui` 安装时报 `Missing required DOM elements: pdf-container, viewer-container`，连带 `pdf-outline` / `pdf-search` 报依赖缺失。
- **根因**：`DOMElementManager` 的 required DOM id 与真实运行时 DOM（`index.html` 的 `viewerContainer`）不一致。
- **修复**：required 改为 `viewerContainer`，并更新 `dom-element-manager.test.js`（commit：`f650e69`）。

## 2026-01-09：协作规则升级（调度者职责边界）
- **新增硬规则**：调度者不得在 `main` 直接修业务 bug；必须打回责任 worktree 处理，并在合并后要求用户手工点检确认无误后才能关闭/归档任务。
- **流程文档**：`.kilocode/rules/memory-bank/workflow-parallel-worktrees.md` 已更新对应条款。

## 2026-01-09：第5轮（ABCE）验收与归档
- **合入**：A=`f0c6974`（pdf-viewer 全局监听门禁 + 统一入口）；B=`77630a7`（`StateManager.setMany`）；C=`c8bcc71`（导航 post-ready delay 可配置）；E=`233081d`（url-loader 依赖解析拆分）。
- **门禁**：`pnpm -s run lint` ✅；Jest（按路径）✅。
- **手工点检**：用户确认“没问题”后已归档对应 doing（`todo-and-doing/4 archive/20260109214822-doing-archive/`）。

## 2026-01-09：A~F 第三轮任务（已验收并合入 main）
- **协作约定（本轮）**：各 worktree 不要改 `memory-bank`；只改任务范围 + 任务目录 `working-log.md`；main 侧验收合入时统一更新 `memory-bank`，避免冲突。
- **任务目录**：见 `todo-and-doing/1 doing/`（D 仅修复上述 P0 bug，其余为互不干扰的小步重构/回归测试）。
- **流程文档**：并行调度/验收合入的固定流程已沉淀到 `.kilocode/rules/memory-bank/workflow-parallel-worktrees.md`。
- **main 合入**：A=`6a6b239`；B=`9060bef`；C=`e9db7a0`；D=`9dad715`（修复 goto 递归爆栈）；E=`c006fa2`；F=`b326e8c`。
- **验收进度**：A/B/C/D 已合入 main（含门禁通过）；E/F 仍有未提交改动，待其提交后再验收合入。

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
