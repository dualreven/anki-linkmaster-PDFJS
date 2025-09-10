# manager 模块 — 细节层

接口与函数：
- handleAddRequest(request)
  - 参考：kilocode/system-prompt-agent-master.yaml:10
  - 作用：接收添加请求，验证 request_id，调用 persistence.saveItems(items)，并在完成后发布 pdf:list:updated。
- handleDeleteRequest(request)
  - 参考：data/pdf_files.json:1
  - 作用：执行删除操作，返回失败项与成功摘要。

消息格式示例：
- 请求：{request_id, caller, items: [{id, name, size}], metadata}
- 响应：{request_id, status: 'ok'|'error', summary, failed_items}

重要实现点：
- 所有对外消息均要带 request_id 与 caller 标识以便可追溯。
- 对可能重复的请求，应检查 request_id 并实现幂等逻辑。

测试建议：
- 使用模拟请求调用 handleAddRequest 并验证 data/pdf_files.json 被正确更新（或 mock persistence）。