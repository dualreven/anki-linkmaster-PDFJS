# PDF-Home 搜索消息路由规格说明

**功能ID**: 20251005195100-pdf-search-ws-routing
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-05 19:51:00
**预计完成**: 2025-10-11
**状态**: 设计中

## 现状说明
- StandardWebSocketServer 与 pdfTable_server 均接收 pdf-home:search:pdf-files，但仍调用旧的 StandardPDFManager.search_files，结果结构不统一。
- WebSocket 响应类型缺少分页与匹配分数字段，无法驱动新前端分页组件。

## 存在问题
- 消息处理逻辑重复且与数据库层解耦，维护困难。
- 缺乏错误处理、请求透传（request_id）与性能日志；无法并行返回 	otal 与 ecords。

## 提出需求
- 将搜索消息统一委派给 PDFLibraryAPI.search_records，标准化请求/响应结构。
- 对接前端分页参数，确保 request/response 使用约定常量；失败时返回 	ype: error、code 与 message。

## 解决方案
- 在 StandardWebSocketServer.handle_message 中新增分支：
  - 解析 data 获取 query/tokens/filters/sort/pagination；调用 API；封装响应。
  - 响应类型统一为 pdf-home:response:search-results，携带 equest_id、	imestamp。
  - 日志记录 query、耗时、结果数。
- pdfTable_server 的 handle_search_pdf 改为轻量代理：
  - 可直接复用 StandardWebSocketServer 的工具函数或引入共享模块，避免重复 SQL。
  - 保留向后兼容字段 original_type（前端过渡使用），约定3个版本周期后移除。
- 公用响应格式：
  `json
  {
    "type": "pdf-home:response:search-results",
    "request_id": "...",
    "timestamp": 1696512345,
    "data": {
      "records": [...],
      "total": 123,
      "page": { "limit": 20, "offset": 40 },
      "meta": { "query": "...", tokens": ["..."] }
    }
  }
  `
- 错误路径：统一调用 StandardMessageHandler.build_error_response，code=422（参数问题）或500（内部错误）。

## 约束条件
### 仅修改本模块代码
仅修改 src/backend/msgCenter_server/standard_server.py、src/backend/pdfTable_server/application_subcode/websocket_handlers.py、可能的共享工具；不得修改数据库与前端模块。

### 严格遵循代码规范和标准
遵循 SPEC-HEAD-communication.json 与 JSON-MESSAGE-FORMAT-001.md；所有响应字段必须 snake_case；日志使用 UTF-8。

## 可行验收标准
### 单元测试
- 为 StandardWebSocketServer 新增 handler 测试：mock PDFLibraryAPI.search_records，验证成功/失败路径及返回结构。
- pdfTable_server 集成测试：模拟消息，校验透传 request_id。

### 端到端测试
- 通过 WebSocket 客户端发送搜索请求，验证分页、匹配分数随响应返回；多客户端可正常收到广播。

### 接口实现
#### 接口1:
函数: StandardWebSocketServer.handle_search_request(request_id, data)（内部辅助）
描述: 提取参数、调用 API、返回响应。
参数: equest_id: str | None, data: Dict[str, Any]
返回值: Dict[str, Any]

### 类实现
#### 类1
类: SearchMessageTranslator
描述: 可选抽象，负责在不同服务器之间共享 payload → 响应的转换逻辑。
属性: pi: PDFLibraryAPI
方法: 	ranslate_request(data), uild_success(request_id, result), uild_error(request_id, exc)

### 事件规范
#### 事件1
描述: 搜索成功后向前端返回 pdf-home:response:search-results；若 
eed_broadcast 标记为真（可暂不实现）时广播给所有客户端。
参数: data.records, data.total, data.page
返回值: 无
