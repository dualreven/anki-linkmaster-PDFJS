# pdf-home：SearchResultsFeature（面条治理拆分说明）

## 目标
- 将 `src/frontend/pdf-home/features/search-results/index.js` 收敛为“装配/生命周期/委托”，单文件 ≤500 行。
- 保持对外导出与行为不变：`export class SearchResultsFeature` + `export default SearchResultsFeature`。

## 拆分后的文件（职责）
- `src/frontend/pdf-home/features/search-results/index.js`
  - Feature 装配：创建 DOM 容器、初始化 renderer、安装 subscriptions、安装 event bridge。
- `src/frontend/pdf-home/features/search-results/search-results-layout.js`
  - 布局（single/double/triple）切换与 `localStorage` 持久化（key：`pdf-home/search-results/layout`）。
- `src/frontend/pdf-home/features/search-results/search-results-header-actions.js`
  - Header 批量操作按钮装配（阅读/编辑等）与布局按钮挂载。
- `src/frontend/pdf-home/features/search-results/search-results-subscriptions.js`
  - 全局事件订阅：`SEARCH_EVENTS.QUERY.REQUESTED`、`SEARCH_EVENTS.RESULTS.UPDATED`、`FILTER_EVENTS.RESULTS.UPDATED`、`SEARCH_RESULTS_EVENTS.FOCUS.REQUESTED`。
- `src/frontend/pdf-home/features/search-results/search-results-event-bridge.js`
  - scoped 内部事件桥：`RESULTS_EVENTS.ITEM.SELECTED/OPEN` → 全局事件/WS 打开 viewer；可选 WS detail 查询（受 `PDF_HOME_FETCH_DETAIL_IF_MISSING` 控制）。
- `src/frontend/pdf-home/features/search-results/search-results-page-limit.js`
  - 纯逻辑：从 `page.limit` 与 `lastRequestedPageLimit` 计算有效 limit，并对结果做前端截断。
- `src/frontend/pdf-home/features/search-results/search-results-results-update.js`
  - 结果更新：截断/渲染/header 统计/待定聚焦应用（scrollIntoView 在测试环境缺失时自动跳过）。

## 测试
- 新增：`src/frontend/pdf-home/features/search-results/__tests__/search-results-page-limit.test.js`
- 既有回归：
  - `src/frontend/pdf-home/features/search-results/__tests__/layout-toggle.test.js`
  - `src/frontend/pdf-home/features/search-results/__tests__/open-viewer.integration.test.js`
  - `src/frontend/pdf-home/features/search-results/__tests__/reopen-after-close.test.js`
  - `src/frontend/pdf-home/features/search-results/__tests__/search-results.limit.test.js`

