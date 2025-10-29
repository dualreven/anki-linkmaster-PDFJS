# 20251027103500-standard-server-split 工作日志

## 2025-10-27 19:33:01 — 阶段3：入口精简与测试补充
- 移除 `standard_server.py` 冗余包装函数：pdf-library（list/detail/add/remove/open/record-update/config）、storage-kv/fs、bookmark、annotation、anchor、viewer、pdf-page、console_log、heartbeat；
- 移除未使用助手：`_iso_to_ms/_ms_to_iso/_resolve_pdf_uuid`；
- 路由层：维持 `core/msg_router.py` 闭包直连；在入口对 `pdf-library:search:requested` 做特例（注入原始消息）；
- 测试补充：
  - `test_standard_server_pdf_pages_and_debug.py`：验证缺失 `page_transfer` 时 `pdf-page:load:failed`；bookmark 非法负载 400；debug-info 缺文件返回 `{ flags:{} }`；
  - 现有测试夹具改为显式传入 `data_dir/db_path`，满足“禁止兜底”。
- 文档更新：
  - `memory-bank/context.md`：新增阶段3任务记录与执行步骤；
  - `memory-bank/architecture.md`：记录“入口包装移除→路由直连”的架构变化与 `page_transfer` 注入约束；
  - `memory-bank/tech.md`：补充使用方法变动与构造参数约束。
