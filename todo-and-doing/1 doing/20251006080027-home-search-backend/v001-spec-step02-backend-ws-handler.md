# 步骤02：后端 WS 路由与 API 打通

状态: 待执行
耗时预估: 30-45 分钟（含最小集成测试）
产出: 可通过 WS 进行搜索的后端闭环

## 目标
- 在 `msgCenter_server/standard_server.py` 中处理 `type: 'pdf/search'` 消息，调用 `PDFLibraryAPI.search_records`，返回统一格式。
- 与前端 SearchManager 的请求/响应格式保持一致。

## 关键文件
- `src/backend/msgCenter_server/standard_server.py:1`
- `src/backend/api/pdf_library_api.py:1`

## 实施要点
1) 在 `standard_server.py` 增加/校验路由
   - 路由判断：`elif message_type == "pdf/search": return self.handle_pdf_search_v2(request_id, data)`
   - 参考实现：`handle_pdf_search_v2`（应存在；如缺失，按下述签名新增）。

2) `handle_pdf_search_v2` 处理逻辑
   - 解析 data：`search_text`（str）、`search_fields`（list[str], 可选）、`include_hidden`（bool, 默认 True）、`limit`、`offset`。
   - 转换 limit/offset 为 int 或 None。
   - 调用：
     ```python
     search_result = self.pdf_library_api.search_records(
         search_text=search_text,
         search_fields=search_fields,
         include_hidden=include_hidden,
         limit=limit,
         offset=offset,
     )
     ```
   - 成功响应：
     ```json
     {
       "type": "pdf/search",
       "status": "success",
       "timestamp": 1690000000,
       "data": { "records": [...], "count": 10, "search_text": "..." },
       "request_id": "..."
     }
     ```
   - 异常时返回 `StandardMessageHandler.build_error_response(...)`，`code=500`，错误码 `SEARCH_ERROR`，信息包含异常字符串。

3) API 层约束
   - `PDFLibraryAPI.search_records(search_text, search_fields=None, include_hidden=True, limit=None, offset=None)`
   - 内部：按空格分词 tokens → 调用 `PDFInfoTablePlugin.search_records(tokens, search_fields, limit, offset)` → `_map_to_frontend`。
   - 注意：空 `search_text` 需要返回全部（limit/offset 生效）。

## 测试建议（最小可执行）
- Python 单测（不启 WS）：
  - 构造 `StandardWebSocketServer` 的最小实例或将 `handle_pdf_search_v2` 抽出为可注入 `pdf_library_api` 的函数。
  - 预置三条记录（不同 title/author/tags），调用 `handle_pdf_search_v2(None, {"search_text": "ai ml"})`，断言 `status == 'success'`、`count` 与 `records` 符合预期。

## 注意事项
- 统一 UTF-8 编码输出日志；换行符 `\n`。
- 所有 SQL 走参数绑定；LIKE 需要转义 `%` 与 `_`（由插件层处理）。
- 与旧路径 `pdf-home:search:pdf-files` 并存，无需修改旧实现。
