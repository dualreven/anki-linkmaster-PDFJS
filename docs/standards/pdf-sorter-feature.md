# PDF Sorter Feature（pdf-home）

相关源码：
- `src/frontend/pdf-home/features/pdf-sorter/index.js`：Feature 入口（装配/委托），保持单文件 ≤ 500 行。
- `src/frontend/pdf-home/features/pdf-sorter/pdf-sorter-ui.js`：UI 组件装配与渲染。
- `src/frontend/pdf-home/features/pdf-sorter/pdf-sorter-event-wiring.js`：事件订阅/解绑与 DOM fallback。
- `src/frontend/pdf-home/features/pdf-sorter/pdf-sorter-event-handlers.js`：处理 “apply sort” 请求 + 构造后端 sort 规则（含纯函数可测）。
- `src/frontend/pdf-home/features/pdf-sorter/pdf-sorter-public-api.js`：公开方法（set/add/apply/clear/save/load）逻辑，入口只保留薄封装。

## 事件

入口只使用事件常量（禁止字面量）：
- `SEARCH_EVENTS`：监听 `RESULTS.UPDATED`；发射 `QUERY.REQUESTED`（同步后端 SQL 排序）。
- `HEADER_EVENTS`：监听 `SORT.REQUESTED`（切换面板）。
- `SORTER_EVENTS`：Feature 内部三段式事件（mode/sort changed/saved/loaded 等）。

## 运行行为（概览）

- install：
  - 创建 `SortManager`；
  - 创建并 render UI（`SorterPanel/ModeSelector/MultiSortBuilder/WeightedSortEditor`）；
  - 绑定排序按钮（优先 EventBus；无 global bus 时 DOM fallback 绑定 `#sort-btn`）；
  - 注册 scoped 事件监听（mode change / apply / clear）；
  - 订阅搜索结果更新（缓存到 `SortManager`，并尝试应用当前排序）；
  - 初始化默认排序并启用。

- apply sort：
  - `multi`：把 configs 转成后端规则 `{field,direction}` 并发射 `SEARCH_EVENTS.QUERY.REQUESTED`；
  - `weighted`：发射 `SEARCH_EVENTS.QUERY.REQUESTED` 的 `{ field:"weighted", direction:"desc", formula }`；
  - 同时保持本地 `SortManager` 状态一致。

## 测试

- 纯函数回归：`src/frontend/pdf-home/features/pdf-sorter/__tests__/pdf-sorter-event-handlers.sort-rules.test.js`

