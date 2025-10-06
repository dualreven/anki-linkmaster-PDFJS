# 步骤01：架构梳理与协议校验（search v001）

状态: 待执行
耗时预估: 20-30 分钟
产出: 校验记录与必要的微调建议

## 目标
- 明确本次搜索闭环涉及的模块/文件与事件流。
- 校验消息契约是否一致（类型、字段命名、大小写、字段含义）。
- 确认已有实现能支撑 v001 的“仅搜索”范围。

## 涉及模块
- 前端
  - 事件常量：`src/frontend/common/event/event-constants.js:1`
  - WS 客户端：`src/frontend/common/ws/ws-client.js:1`
  - 搜索：
    - SearchFeature：`src/frontend/pdf-home/features/search/index.js:1`
    - SearchManager：`src/frontend/pdf-home/features/search/services/search-manager.js:1`
    - SearchResultsFeature：`src/frontend/pdf-home/features/search-results/index.js:1`
- 后端
  - 标准 WS 服务器：`src/backend/msgCenter_server/standard_server.py:1`
  - API 门面：`src/backend/api/pdf_library_api.py:1`
  - DB 插件：`src/backend/database/plugins/pdf_info_plugin.py:1`

## 需要确认的契约
1) WebSocket 消息类型统一使用 `pdf-library:search:records`
   - 前端发送：SearchManager 通过 `WEBSOCKET_EVENTS.MESSAGE.SEND` 发送 `{ type: 'pdf-library:search:records', data, request_id }`
   - 后端响应：`{ type: 'pdf-library:search:records', status: 'success'|'error', data, request_id }`
   - WSClient 支持 `pdf-library:search:records` 类型（在 `WSClient.VALID_MESSAGE_TYPES` 列表中）。

2) 请求数据（v001）
   - data.search_text: string（空字符串表示“全部”）
   - data.search_fields?: string[]（默认 ['title','author','filename','tags','notes','subject','keywords']）
   - data.include_hidden?: boolean（默认 true）
   - data.limit?: number（默认 500）
   - data.offset?: number（默认 0）

3) 响应数据（成功）
   - data.records: PDFRecord[]（由 `PDFLibraryAPI._map_to_frontend` 统一映射）
   - data.count: number
   - data.search_text: string

4) 数据库搜索语义
   - 关键词空格分词（SearchManager 直接传原始字符串；后端分词）。
   - 关键词之间 AND；字段内 OR；LIKE 匹配，转义 `%` 与 `_`。
   - tags 为 JSON 数组，采用 JSON 文本匹配策略（v001）。

## 验证清单（按顺序执行）
1. 阅读规范头文件：`src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json:1`
2. 打开并确认前端：
   - `src/frontend/common/ws/ws-client.js:1` 中 `VALID_MESSAGE_TYPES` 包含 `pdf-library:search:records`。
   - `src/frontend/pdf-home/features/search/services/search-manager.js:1` 发送与接收逻辑符合契约。
   - `src/frontend/pdf-home/features/search-results/index.js:1` 监听 `search:results:updated` 并渲染。
3. 打开并确认后端：
   - `src/backend/msgCenter_server/standard_server.py:341` 存在 `elif message_type == "pdf-library:search:records":` 路由；`handle_pdf_search_v2` 实现调用 `PDFLibraryAPI.search_records`。
   - `src/backend/api/pdf_library_api.py:269` 存在 `search_records` 并调用 `PDFInfoTablePlugin.search_records`。
   - `src/backend/database/plugins/pdf_info_plugin.py:480` 存在 `search_records`，包含 LIKE 转义与多字段拼接。

## 输出
- 将校验结果记录到本步骤文档底部（问题/建议/无需变更）。
- 若发现不一致，提交到步骤02或步骤03执行修复。

---

校验记录：
- [ ] 前端 WS 类型已包含 `pdf-library:search:records`
- [ ] SearchManager 请求/响应契约与 v001 对齐
- [ ] SearchResultsFeature 正常订阅并渲染
- [ ] 后端 WS 路由存在并正确调用 API
- [ ] API 与 DB 插件实现符合搜索语义
