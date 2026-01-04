# Memory Bank - Context（精简版）

最后更新：2026-01-05（memory-bank lint：超限自动归档）

## 2026-01-02 完成：FilterBuilder v2 / PDFEditFeature 面条治理（≤500）
- FilterBuilder v2：`src/frontend/pdf-home/features/filter/components/filter-builder-v2.js` 854 → 499，拆分模板/常量/渲染等（`docs/standards/filter-builder-v2.md`）。
- PDFEditFeature：`src/frontend/pdf-home/features/pdf-edit/index.js` 848 → 500，拆分表单模板/全局提示/提交流程等（`docs/standards/pdf-edit-feature.md`）。
- 门禁：`pnpm run lint`、定向 Jest、`pnpm run ci:frontend-line-limit` 全绿。

## 2026-01-03 完成：Logger / PDFSorterFeature / FeatureRegistry 面条治理（≤500）
- Logger：`logger.js` 759 → 465，配置迁移至 `logger-runtime-config.js`。
- PDFSorterFeature：`pdf-sorter/index.js` 737 → 455，拆分 UI 装配/EventWiring；`weighted-sort-editor.js` 716 → 401。
- FeatureRegistry：`feature-registry.js` 733 → 494，拆分 record/validators/deps/context。

## 2026-01-03 完成：UI 组件与 SearchResults 面条治理（≤500）
- TranslatorSidebarUI：`TranslatorSidebarUI.js` 730 → 190，拆分 renderer/actions/dom-bindings/history。
- AnchorSidebarUI：`anchor-sidebar-ui.js` 718 → 481，拆分 toolbar/dialog/table，修复 listener leak。
- SearchResultsFeature：`search-results/index.js` 681 → 217，拆分 layout/subscriptions/bridge/update。
- PDFAnchorFeature：`pdf-anchor/index.js` 651 → 165，拆分 listeners/navigation/position/utils。

## 2026-01-03 完成：Core Managers 面条治理（≤500）
- StateManager：`state-manager.js` 554 → 168。
- IndexedDBCacheManager：`indexeddb-cache-manager.js` 521 → 475，抽出 `indexeddb-cache-record.js`。
- AnnotationManager：`annotation-manager.js` 505 → 490，抽出 `annotation-position-utils.js`。

## 2026-01-04 修复：viewer 未启动时导航自动启动并待转发
- 行为：MsgCenter 收到 `pdf-viewer:navigate:requested` 若路由不到 viewer，则触发 `app-window:open:requested` 并缓存消息，待 viewer 注册后自动转发。
- 修复：`src/backend/msgCenter_server/standard_server.py` 支持 `client_socket=None` 时触发 auto-launch 分支。
- 回归测试：`test_standard_server_auto_launch_viewer_on_navigate.py`。

## 2026-01-04 完成：前端 JS 单文件行数基线清零（全量 ≤500）
- 结果：`src/frontend/**/*.js`（排除 dist）所有单文件行数均降至 ≤500；`scripts/ci/baselines/frontend-line-limit.json` 已清空。
- SearchBox：`search-box.js` 574 → 364，拆分 DOM/Binding/Subs。
- 补充文档：`docs/standards/pdf-home-app-v2.md` 等 6 份。

## 2026-01-05 前端架构重构：Observable Pattern 设计与规划
- 目标：解决 EventBus 造成的“逻辑面条化”问题，引入 `Manager + Store` 模式（Lightweight Observable Pattern）。
- 产出：
  - 工具库：`src/frontend/common/utils/observable.js`（Zero-Dependency, Fail-Fast, Selector Support）。
  - 测试：`src/frontend/common/utils/__tests__/observable.test.js`（覆盖 Init/Set/Replace/Subscribe/Selector/Error）。
  - 迁移指南：`docs/MIGRATION-EVENTBUS-TO-OBSERVABLE.md`（定义 Pilot/Interop/Strangler 阶段）。
  - 规范：新功能强制使用 `Manager+Store`，EventBus 收敛为边界/集成事件。
- 门禁：`pnpm run lint` & `jest observable.test.js` 已通过。
