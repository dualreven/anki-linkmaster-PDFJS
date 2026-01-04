# PDF Search — SearchBox（UI 组件）拆分说明

目标：将 `src/frontend/pdf-viewer/features/pdf-search/components/search-box.js` 从“面条式 DOM + 订阅 + 业务混杂”收敛为“装配/对外 API”，并保证：
- 对外导出不变：`export class SearchBox`
- 行数门禁：主文件 ≤500
- 事件订阅与 DOM 监听可清理（避免泄漏）

## 文件结构（现行）

- `src/frontend/pdf-viewer/features/pdf-search/components/search-box.js`
  - 负责：对外 API（`initialize/show/hide/toggle/updateResultCounter/destroy`）+ 业务 emit（QUERY/NEXT/PREV/CLEAR/OPTION.CHANGED）
  - 不直接包含：长 HTML 模板、DOM 绑定细节、EventBus 订阅细节

- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom.js`
  - 负责：创建 DOM（模板 + 取元素引用）
  - 策略：缺失关键元素直接 `throw`（Fail-Fast）

- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-bindings.js`
  - 负责：DOM 事件绑定（input/keydown/click/change + header 的 `#search-toggle-btn`）
  - 产物：返回 `cleanup()`，由 `SearchBox.destroy()` 调用以移除监听器

- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-event-subscriptions.js`
  - 负责：EventBus 订阅（RESULT.* / UI.OPEN|CLOSE|TOGGLE）
  - 产物：返回 `cleanup()`，由 `SearchBox.destroy()` 调用以取消订阅

## 事件契约（只用常量）
SearchBox 只通过 `PDF_VIEWER_EVENTS.*` 与外界交互，禁止硬编码字符串事件名：
- 输入搜索：`PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY`
- 清空搜索：`PDF_VIEWER_EVENTS.SEARCH.EXECUTE.CLEAR`
- 导航：`PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.NEXT` / `PREV`
- 选项变化：`PDF_VIEWER_EVENTS.SEARCH.OPTION.CHANGED`
- UI 控制（被动监听）：`PDF_VIEWER_EVENTS.SEARCH.UI.OPEN` / `CLOSE` / `TOGGLE`
- 结果更新（被动监听）：`PDF_VIEWER_EVENTS.SEARCH.RESULT.*`

## 回归测试
- `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box.behavior.test.js`
  - 锁定行为：输入触发防抖（300ms）后会 emit `execute:query`，并携带 options。

## 维护约束（避免再次面条化）
- DOM 事件必须可解绑：禁止在 SearchBox 内部散落匿名 `addEventListener`（统一放入 `search-box-dom-bindings.js`）。
- EventBus 订阅必须可清理：统一放入 `search-box-event-subscriptions.js`，并返回取消函数。
- 复杂说明写到本文档，源码顶部只保留本文路径链接。

