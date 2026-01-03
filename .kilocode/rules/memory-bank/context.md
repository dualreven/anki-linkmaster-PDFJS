# Memory Bank - Context（精简版）

最后更新：2026-01-04（memory-bank lint：超限自动归档）

## 2026-01-01 修复：gui_launcher 启动 pdf-viewer 后标注不自动加载（补齐 pdfId）
- 根因：`bootstrap/app-bootstrap-feature.js` 在 `?file=...` 启动路径下发射 `FILE.LOAD.REQUESTED` 时未携带 `pdfId`，在“标注严格契约（必须显式提供 pdfId）”下导致标注自动加载 fail-fast；修复：`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 自动加载时从 filename 提取 12hex 并携带 `pdfId`。
- 回归测试：`src/frontend/pdf-viewer/__tests__/app-bootstrap.autoload-pdfid.test.js`

## 2026-01-01 继续：前端面条代码分析 v3
- 新增报告：`AItemp/reports/20260101164125-frontend-noodle-analysis-v3.md`；量化现状：`src/frontend/**`（git tracked、排除 dist/tests/smoke）仍有 37 个 >500 行大文件，Top 仍集中在 screenshot/text-highlight/ws-client/event-bus/ui-manager-core 等。

## 2026-01-01 P1：ScreenshotTool 拆分（阶段A：对外接口不变，内部降面条度）
- 目标文件：`src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/index.js`
- 已抽离子模块：见 `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/*.js`（rect-utils/preview-dialog/marker-renderer/card-renderer/selection-controller/capture-flow/subscriptions/queue 等）
- 防回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/rect-utils.test.js`、`card-renderer.test.js`（既有 `screenshot-tool*.test.js` 继续通过）
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿

## 2026-01-01 完成：TextHighlightTool 面条治理（index.js ≤ 500）
- 结果：`src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/index.js` 行数降到 **499**（≤500），主文件收敛为“装配/委托 + 对外接口”。
- 拆分模块：
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/highlight-overlay-controller.js`（渲染/记录/队列）
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/event-subscriptions.js`（订阅/卸载集合）
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/interaction-flow.js`（激活/选字/创建标注流程）
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/clipboard-utils.js`（复制）
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/confirm-dialog.js`（确认弹窗，Fail-Closed：异常/无DOM返回 false）
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/tool-button-renderer.js`、`src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/card-renderer.js`（UI渲染）
- 防回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/confirm-dialog.test.js`
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260101195214-AI-Working-log.md`、`AItemp/20260101203210-AI-Working-log.md`

## 2026-01-01 完成：pdf-viewer-constants.js 注释外移（≤500）
- 结果：`src/frontend/common/event/pdf-viewer-constants.js` 行数降到 **341**（≤500），对外 `PDF_VIEWER_EVENTS` 常量结构与字符串值保持不变。
- 详细说明外移：`docs/standards/pdf-viewer-event-constants.md`（常量文件顶部提供路径链接给 AI/开发者）
- 防回归测试：`src/frontend/common/event/__tests__/pdf-viewer-constants.test.js`
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260101224715-AI-Working-log.md`

## 2026-01-01 完成：WSClient 面条治理（ws-client.js ≤ 500）
- 结果：`src/frontend/common/ws/ws-client.js` 行数 **1037 → 427**（≤500），主文件收敛为“装配/连接管理”，对外接口保持不变（`WSClient` + default）。
- 逻辑拆分：
  - identity：`src/frontend/common/ws/ws-client-identity.js`
  - inbound 路由：`src/frontend/common/ws/ws-client-inbound-router.js`
  - request/pending：`src/frontend/common/ws/ws-client-requests.js`
  - unregister：`src/frontend/common/ws/ws-client-unregister.js`
  - contract：`src/frontend/common/ws/ws-client-contract.js`
- 详细说明：`docs/standards/ws-client.md`
- 防回归测试：`src/frontend/common/ws/__tests__/ws-client-identity.test.js`、`src/frontend/common/ws/__tests__/ws-client-contract.test.js`（另有既有 timeout 用例继续锁行为）
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260101232844-AI-Working-log.md`

## 2026-01-02 完成：EventBus 面条治理（event-bus.js ≤ 500）
- 结果：`src/frontend/common/event/event-bus.js` 行数 **996 → 442**（≤500），对外 API 保持不变（`EventBus/getEventBus/getAllEventBuses/...`）。
- 拆分模块：
  - emit：`src/frontend/common/event/event-bus-emitter.js`
  - on/off：`src/frontend/common/event/event-bus-subscriptions.js`
  - validator：`src/frontend/common/event/event-name-validator.js`（仍通过 `event-bus.js` 导出）
  - logging：`src/frontend/common/event/event-bus-logging.js`（使用常量避免字面量事件名 lint）
- 详细说明：`docs/standards/event-bus.md`
- 防回归测试：`src/frontend/common/event/__tests__/event-bus.extracted-modules.test.js`（既有 core/tracing/scoped 用例继续锁行为）
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102002520-AI-Working-log.md`

## 2026-01-02 完成：UIManagerCore 面条治理（ui-manager-core.js ≤ 500）
- 结果：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js` 行数 **965 → 484**（≤500），对外 API 保持不变。
- 拆分模块：
  - 事件订阅：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-event-listeners.js`
  - UI 控件装配：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-ui-controls.js`
  - DOM 交互监听：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-interactions.js`（修复 destroy 时 wheel/resize 无法解绑风险）
  - 复制按钮：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-copy-pdf-id.js`
  - 标题更新：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-header-title.js`
- 详细说明：`docs/standards/ui-manager-core.md`
- 防回归测试：`src/frontend/pdf-viewer/features/infra-ui/__tests__/ui-manager-core-destroy-detaches-dom-listeners.test.js`（既有复制按钮用例继续通过）
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102012653-AI-Working-log.md`

## 2026-01-02 完成：CommentTool 面条治理（comment/index.js ≤ 500）
- 结果：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js` 行数 **928 → 487**（≤500），对外导出与调用方式保持不变（`CommentTool` + default）。
- 拆分模块：
  - 页面渲染监听：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-page-rendering.js`
  - 标注事件订阅：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-subscriptions.js`
  - 标记恢复/渲染：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-marker-restoration.js`
  - 交互流：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-interactions.js`
  - UI：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-button.js`、`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-annotation-card.js`
  - 确认弹窗：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-confirm-dialog.js`（Fail-Closed：异常返回 false）
- 详细说明：`docs/standards/comment-tool.md`
- 防回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool-destroy-unsubscribe.test.js`、`comment-tool-fail-closed-confirm.test.js`（并保持 `annotation-unify-behavior` 静态一致性测试继续通过）
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102022413-AI-Working-log.md`

## 2026-01-02 完成：WebSocketAdapter 面条治理（websocket-adapter.js ≤ 500）
- 结果：`src/frontend/pdf-viewer/adapters/websocket-adapter.js` 行数 **895 → 435**（≤500），对外导出与行为保持不变（`WebSocketAdapter` + `createWebSocketAdapter`）。
- 拆分模块：出站订阅/发送（`src/frontend/pdf-viewer/adapters/websocket-adapter-outgoing-handlers.js`）；`load_pdf_file` 入站解析（`src/frontend/pdf-viewer/adapters/websocket-adapter-load-pdf-file.js`）；viewer navigate 入站处理（`src/frontend/pdf-viewer/adapters/websocket-adapter-viewer-navigate.js`）
- 详细说明：`docs/standards/websocket-adapter.md`
- 门禁：`pnpm run lint`、adapter suite Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102191817-AI-Working-log.md`、`AItemp/20260102193206-AI-Working-log.md`
## 2026-01-02 完成：FilterBuilder v2 面条治理（filter-builder-v2.js ≤ 500）
- 结果：`src/frontend/pdf-home/features/filter/components/filter-builder-v2.js` 行数 **854 → 499**（≤500），对外导出与行为保持不变（`FilterBuilder`）。
- 拆分模块：模板/常量/渲染/DOM 事件绑定/tree→config（详见 `docs/standards/filter-builder-v2.md`）
- 防回归测试：`src/frontend/pdf-home/features/filter/__tests__/filter-builder-v2-serialization.test.js`；门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102194140-AI-Working-log.md`

## 2026-01-02 完成：PDFEditFeature 面条治理（pdf-edit/index.js ≤ 500）
- 结果：`src/frontend/pdf-home/features/pdf-edit/index.js` 行数 **848 → 500**（≤500），对外导出与行为保持不变（`PDFEditFeature` + default）。
- 拆分模块：表单模板/组件初始化/全局提示/重置按钮/提交流程（详见 `docs/standards/pdf-edit-feature.md`）
- 防回归测试：`src/frontend/pdf-home/features/pdf-edit/__tests__/pdf-edit-form-template.test.js`
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿
- 工作日志：`AItemp/20260102201330-AI-Working-log.md`

## 2026-01-01 文档：pdf-viewer 关键事件先后关系
- 新增：`docs/standards/pdf-viewer-event-flow.md`（加载/渲染/断点续读/标注自动加载/外部跳转的先后关系与门控点）

## 2026-01-01 修复：WindowControlsFeature 重复安装导致 DOM 重复挂载
- 修复：`src/frontend/common/features/window-controls/index.js` 增加幂等守卫（已安装则跳过），避免 `.window-controls` 重复插入。

## 2025-12-31 新增：memory-bank lint（超限自动归档过时内容）
- 目的：防止 `.kilocode/rules/memory-bank/context.md` 体积失控；超限时自动把 >7 天内容归档到 `docs/context-archive/` 并更新索引。
- 接入点：`pnpm run lint` 现在会先执行 `pnpm run lint:memory-bank`（会在需要时修改归档文件）。
- 脚本：`scripts/ci/memory-bank-limit.js`
  - `pnpm run lint:memory-bank`：`--fix` 自动归档
  - `pnpm run ci:memory-bank-limit`：仅检查（不修改）
- 回归测试：`scripts/ci/__tests__/memory-bank-limit.test.js`

## 2025-12-31 修复：全仓库 ESLint 历史报错收敛（lint 全绿）
- 目标：让 `pnpm run lint` 0 error（注意该命令已前置 `lint:memory-bank`）。
- 关键变更：
  - ESLint 忽略构建产物：`src/frontend/dist/**`（历史原因位于 src 下，否则会把打包 JS 当源码报大量规则错误）
  - ESLint 忽略另一位 AI 的未跟踪工作区：`src/frontend/new-card-scheduler/planner/**`、`src/backend/msgCenter_server/handlers/anki/**`（避免误触发冲突）
  - 修复少量残留规则：`custom/no-silent-catch`、`no-empty`、`no-unused-vars`、`custom/no-event-literal`

## 2025-12-30 前端事件体系参考文档（防竞态）
- 文档：`docs/standards/event-system-reference.md`
- 目的：给后续 AI 一个“选事件前先看这里”的地图，避免误用事件造成竞态/时序冲突。
- 关键结论（高风险）：`PDF_VIEWER_EVENTS.RENDER.READY` 是状态型且默认只发一次；Resume 与 MsgCenter gate 导航若复用该事件，极易在 `NavigationService` 的互斥点发生竞态（表现为偶现跳转失败/跳错位置）。
- gate 注意：`gate.once` 是否能命中历史，取决于目标事件是否被写入 gate store（参见 `src/frontend/common/ws/ws-gate-runner.js` 与 `src/frontend/pdf-viewer/adapters/websocket-adapter.js`）。

## 2025-12-30 P0：前端单文件行数门禁（基线+增量）
- 目标：先止血，阻止前端单文件继续面条化；历史大文件允许逐步拆分，不要求一次性全部重构。
- 落地：脚本 `scripts/ci/frontend-line-limit.js`；基线 `scripts/ci/baselines/frontend-line-limit.json`；运行 `pnpm run ci:frontend-line-limit`
- 规则：
  - `src/frontend/**` 新增文件禁止 `>500` 行；
  - 对基线中已 `>500` 行的历史文件：禁止行数继续增长（允许减少）。
- 排除：`src/frontend/dist/**`、`**/__tests__/**`、`**/__smoke__/**`
- 备注：仓库全量 `pnpm run lint` 当前仍存在大量历史报错；本轮只保证新增脚本目录定向 lint 与最小 Jest 用例通过。

## 2025-12-30 P1：AnnotationSidebarUI 拆分（降低面条风险）
- 结果：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js` 约 1760 行 → 993 行 → **485 行**（≤500），对外行为不变；既有 Jest 与行数门禁通过。

## 2025-12-30 修复：标注自动加载改为严格契约（禁止兜底）
- 问题：标注自动加载若依赖从 `{filename,url}` 推断 pdfId，会在“非 12hex 文件名/非 uuid 场景”失效，导致打开 PDF 后标注为空。
- 结论：禁止兜底推断；**pdfId 必须由加载链路显式提供**。
- 落地：
  - `PDFUrlLoaderFeature` 发出 `FILE.LOAD.REQUESTED` 时携带 `pdfId`；
  - `PDFManager` 发出 `FILE.LOAD.SUCCESS/FAILED` 时透传 `pdfId`；
  - `AnnotationFeature` 自动加载标注时只认 `FILE.LOAD.SUCCESS.data.pdfId`，缺失则 fail-fast 并触发 `ANNOTATION.DATA.LOAD_FAILED`。
- 回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-autoload-on-file-load.test.js`（新增缺失 pdfId 必须失败的用例）。

## 2025-12-30 修复：gui_launcher 打开 viewer 后不加载标注（load_pdf_file 链路补齐 pdfId）
- 现象：从 `gui_launcher` 启动空白 pdf-viewer 后，通过旧协议 `load_pdf_file` 加载 PDF 时，标注不自动加载；但从 `pdf-home` 打开正常。
- 根因：`load_pdf_file` → `FILE.LOAD.REQUESTED` 链路未携带 `pdfId`，导致 `FILE.LOAD.SUCCESS.pdfId == null`，在严格契约下标注自动加载 fail-fast。
- 修复：`src/frontend/pdf-viewer/adapters/websocket-adapter.js` 在处理 `load_pdf_file` 时补齐 `pdfId`（来源只允许消息内字段 `pdfId/pdf_id/fileId` 或 filename 中的 12hex；禁止从 `window.location` 推断）。
- 回归测试：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.test.js` 新增用例覆盖 `fileId` 与 `filename-12hex` 两种来源。

## 2025-12-30 修复：标注自动加载延后到 resume 完成（支持“命中历史”避免竞态）
- 落地：统一 gate store `src/frontend/common/ws/ws-gate-status-store.js`；resume 发射 `PDF_VIEWER_EVENTS.RESUME.FLOW.DONE` 前写入状态；annotation 自动加载改为等待该事件且支持命中历史；adapter gate.once 复用同 store。
- 涉及：`src/frontend/pdf-viewer/features/pdf-resume/index.js`、`src/frontend/pdf-viewer/features/pdf-annotation/index.js`、`src/frontend/pdf-viewer/adapters/websocket-adapter.js`
- 回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-autoload-on-file-load.test.js`
## 2026-01-02 完成：AnnotationFeature / SavedFiltersFeature 面条治理
- `src/frontend/pdf-viewer/features/pdf-annotation/index.js` ≤500（473 行），拆分自动加载/跳转/按钮/pdfId 解析（见 `docs/standards/pdf-annotation-feature.md`）。
- `src/frontend/pdf-home/features/sidebar/saved-filters/index.js` ≤500（496 行），拆分对话框/纯逻辑/工具函数（见 `docs/standards/pdf-home-saved-filters.md`）。
## 2026-01-02 完成：OutlineManager 面条治理
- `src/frontend/pdf-viewer/features/pdf-outline/index.js` ≤500（499 行），拆分初始加载/导航/CRUD/bulk-save 等模块（见 `docs/standards/pdf-outline-feature.md`）。
## 2026-01-03 完成：Logger 面条治理
- `src/frontend/common/utils/logger.js` 759 → **465**（≤500），运行时配置迁移到 `src/frontend/common/utils/logger-runtime-config.js`；Jest 全局 mock 补齐导出：`jest.setup.js`；文档：`docs/standards/logger.md`；回归测试：`src/frontend/common/utils/__tests__/logger-runtime-config.test.js`
## 2026-01-03 完成：PDFSorterFeature 面条治理
- `src/frontend/pdf-home/features/pdf-sorter/index.js` 737 → **455**（≤500），拆分 UI 装配/事件 wiring/handler/public API（见 `docs/standards/pdf-sorter-feature.md`）；并拆分 `weighted-sort-editor.js` 716 → **401**（见 `docs/standards/pdf-sorter-weighted-sort-editor.md`）；回归测试：`src/frontend/pdf-home/features/pdf-sorter/__tests__/pdf-sorter-event-handlers.sort-rules.test.js`
## 2026-01-03 完成：FeatureRegistry 面条治理
- `src/frontend/common/micro-service/feature-registry.js` 733 → **494**（≤500），拆分 record/validators/deps/context（见 `docs/standards/feature-registry.md`）；回归测试：`src/frontend/common/micro-service/__tests__/feature-registry-deps.install-order.test.js`
## 2026-01-03 完成：TranslatorSidebarUI 面条治理
- `src/frontend/pdf-viewer/features/pdf-translator/components/TranslatorSidebarUI.js` 约 730 → **190**（≤500），拆分 renderer/actions/dom-bindings/history（见 `docs/standards/pdf-translator-sidebar.md`）；回归测试：`src/frontend/pdf-viewer/features/pdf-translator/__tests__/translator-history.test.js`
## 2026-01-03 完成：AnchorSidebarUI 面条治理
- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js` 718 → **481**（≤500），拆分 toolbar/dialog/table，并修复 toolbar 的 document click listener 泄漏（见 `docs/standards/pdf-anchor-sidebar-ui.md`）；回归测试：`src/frontend/pdf-viewer/features/pdf-anchor/components/__tests__/anchor-sidebar-ui.toolbar-cleanup.test.js`
## 2026-01-03 完成：SearchResultsFeature 面条治理
- `src/frontend/pdf-home/features/search-results/index.js` 681 → **217**（≤500），拆分 layout/subscriptions/event-bridge/results-update 等模块（见 `docs/standards/pdf-home-search-results.md`）；回归测试：`src/frontend/pdf-home/features/search-results/__tests__/search-results-page-limit.test.js`
## 2026-01-03 完成：PDFAnchorFeature 面条治理
- `src/frontend/pdf-viewer/features/pdf-anchor/index.js` 651 → **165**（≤500），拆分 event-listeners/navigation/position-tracker/utils（见 `docs/standards/pdf-anchor-feature.md`）；回归测试：`src/frontend/pdf-viewer/features/pdf-anchor/__tests__/anchor-utils.test.js`
## 2026-01-03 完成：StateManager / IndexedDBCacheManager 面条治理（StateManager：`state-manager.js` 554 → 168；IndexedDBCacheManager：`indexeddb-cache-manager.js` 521 → 475 + `indexeddb-cache-record.js`；回归测试：`state-manager.test.js` + `indexeddb-cache-record.test.js`）
## 2026-01-03 完成：AnnotationManager 面条治理（`annotation-manager.js` 505 → 490（≤500），抽出 `annotation-position-utils.js`；文档：`docs/standards/annotation-manager.md`；回归测试：`annotation-position-utils.test.js`）
## 2026-01-03 修复：全量测试门禁（format/pre-commit/ws-contract-diff）
- 修复 `test:format` 与 ESLint 引号规则冲突（更新 `.prettierrc.json`），补齐 `dependency-cruiser` 并修复配置（`.dependency-cruiser.cjs`），同步前后端 WS 三段式契约（`event-constants.js` / `message_types.py` / `ws-contract-diff.mjs`），全量 Jest 复跑通过。

## 2026-01-04 复核：JS≤500 + 全量门禁复跑（完成）
- 结论：`pnpm run ci:frontend-line-limit` OK；`pnpm run lint/test:format/check:deps/test/ci:ws-types-diff` 全绿。
- 工作日志：`AItemp/20260104000330-AI-Working-log.md`
- Git：已提交 `b2712a4`（不含 `AItemp`，见 `AItemp/20260104011252-AI-Working-log.md`）
