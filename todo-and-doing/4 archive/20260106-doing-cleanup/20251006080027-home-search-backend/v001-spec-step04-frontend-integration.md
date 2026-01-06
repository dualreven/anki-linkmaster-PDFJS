# 步骤04：前端集成与事件流验证

状态: 待执行
耗时预估: 30-45 分钟
产出: 可交互的搜索 UI → WS → 结果渲染闭环

## 目标
- 确认 SearchBar → SearchFeature → SearchManager → WSClient 发消息链路正常。
- 确认 WS 响应回流 → SearchManager → `search:results:updated` → SearchResultsFeature 渲染。

## 关键文件
- 事件常量：`src/frontend/common/event/event-constants.js:1`
- WS 客户端：`src/frontend/common/ws/ws-client.js:1`
- SearchFeature：`src/frontend/pdf-home/features/search/index.js:1`
- SearchManager：`src/frontend/pdf-home/features/search/services/search-manager.js:1`
- SearchResultsFeature：`src/frontend/pdf-home/features/search-results/index.js:1`

## 行为要点
1) 发送请求
   - 事件：`search:query:requested`（由 SearchBar 触发，SearchFeature 转发到全局）。
   - SearchManager 构造：
     ```js
     { type: 'pdf/search', request_id, data: { search_text, search_fields, include_hidden, limit } }
     ```
   - 通过 `WEBSOCKET_EVENTS.MESSAGE.SEND` 发给 WSClient。

2) 接收响应
   - WSClient 将所有消息广播为 `websocket:message:received`。
   - SearchManager 识别 `type === 'pdf/search'` 且 `request_id` 匹配，发布：
     ```js
     eventBus.emit('search:results:updated', { records, count, searchText });
     ```

3) 渲染结果
   - SearchResultsFeature 订阅 `search:results:updated`，更新数量徽标与表格渲染。
   - 空结果显示空态；清除搜索走 `search:clear:requested`（内部转为空搜索）。

## 前端测试建议
- JSDOM 级别（可选）：
  - Mock EventBus 与 WSClient，触发 `search:query:requested`，断言 `WEBSOCKET_EVENTS.MESSAGE.SEND` 被发出。
  - 注入一个 `websocket:message:received` 的 `pdf/search` 成功消息，断言 `search:results:updated` 派发与渲染调用。

## 注意事项
- 不新增全局变量；所有依赖通过 Feature 容器注册获取。
- 统一日志前缀，确保 `logs/pdf-home-js.log` 捕获关键路径（UTF-8、`\n`）。
