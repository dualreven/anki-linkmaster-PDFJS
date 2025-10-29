# 标准服务器拆分工程（Phase-1/2）规格说明

**功能ID**: 20251027103500-standard-server-split  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2025-10-27 10:35:00  
**状态**: 进行中

## 目标
- 将 `src/backend/msgCenter_server/standard_server.py` 按职责拆分为：核心（启停/收发）、路由（msg_router）、校验（schema_validation）、领域处理器（handlers/*），确保对外契约与行为不变。
- 移除 legacy 类型兼容映射：收到 legacy 类型直接 400 错误（不兜底）。

## 范围（当前阶段）
- Phase-1：去除 legacy 映射；抽离 schema 校验；抽离 storage-kv / storage-fs 处理器；新增最小路由。
- Phase-2：引入路由注册表；后续逐域迁移 pdf-library / annotation / anchor / viewer / capability。

## 约束
- 不改变消息契约与数据结构；严格 UTF-8 文件 I/O；禁止运行时兜底策略。

## 验收
- legacy 类型 → 400 `LEGACY_MESSAGE_TYPE_NOT_SUPPORTED`。
- storage-kv/fs 行为与返回结构与拆分前一致。
- `standard_server.py` 行数持续下降；代码圈复杂度下降；新增模块可单测。

---

## 阶段进展（2025-10-27 更新）

### Phase-3（入口精简/路由直连）
- 入口 `standard_server.py` 当前约 395 行（由 ~2370→566→395）；
- 路由：`core/msg_router.py` 以闭包直连各领域处理器（storage-kv/fs、pdf-library、annotation、anchor、viewer、bookmark、pdf-page、capability、console_log、debug-info）；
- 特例：`pdf-library:search:requested` 需要原始消息 `raw_message`，入口在路由前注入后调用处理器；
- 依赖注入：`pdf-page:*` 必须在构造 `StandardWebSocketServer(data_dir, db_path, page_transfer=...)` 时显式注入 `page_transfer`，缺失时直接错误（禁止兜底）；
- 公共 API 下沉：新增 `core/server_api.py::ServerAPIMixin`（发送/广播/统计/错误处理），入口继承以瘦身；
- 严格 Schema 校验：所有 `*:requested` 入站消息需包含 `timestamp` 与 `metadata: { version: '1.0.0' }`，否则返回 `SCHEMA_VALIDATION_FAILED`（code=400）。

### 测试与契约（已落实）
- 单测覆盖：storage-kv/fs、capability discover/describe、pdf-library（list/info/remove/add）、bookmark（list/save/错误入参）、annotation（save/list/delete 与负路径）、anchor（负路径校验）、pdf-page（缺少/存在 page_transfer 的失败/成功路径）、router 未知类型（400）。
- 运行命令：`PYTHONPATH=. pytest -q src/backend/msgCenter_server/__tests__`；本地环境（Windows+Python 3.13+PyQt6）已全量通过。
- 断言规范：错误路径断言顶层 `code==400` 或 `error.type=='SCHEMA_VALIDATION_FAILED'`，避免依赖早期文案。

### 结构快照
- core：`server_core.py`（Qt WS 启停与文本转发）、`msg_router.py`（路由）、`schema_validation.py`（契约校验）、`server_api.py`（Mixin）
- handlers：`pdf_viewer/{annotation,anchor,bookmark,viewer,pdf_pages}.py`、`pdf_library.py`、`storage_kv.py`、`storage_fs.py`、`infra/{debug,notifications}.py`、`misc.py`
- 协议：`standard_protocol.py`（599 行，待拆分评估）

---

## 后续工作（下一阶段建议）
- 长文件继续拆分（按优先级）：
  - `standard_protocol.py`（≈599 行）：拆分 MessageType/Builder 与基础 Handler，沉淀公共响应构造到独立模块；
  - `crypto.py`（≈572 行）：按算法/用途拆出子模块；
  - `handlers/pdf_library.py`（≈500 行）：按子领域（list/detail/add/remove/search/config/record-update）拆分为多文件。
- 扩展单测：覆盖 anchor/update/delete 的更多负/正路径；bookmark reset；pdf-library 失败分支。
- 运行集成：GUI/Embed 启动点显式注入 `page_transfer`；未注入时禁用相关 UI 入口，避免误调用。

## 验收补充（阶段收敛）
- 入口无业务逻辑：除 `search` 特例外，其余均由路由 → 处理器直达；入口无兜底分支；
- 契约一致：所有 `*:requested` 输入包含 `timestamp/metadata.version`；不满足时统一 `SCHEMA_VALIDATION_FAILED`（400）；
- 文档同步：已更新 `.kilocode/rules/memory-bank/{context,architecture,tech}.md` 对应内容；统计清单另见 `msgCenter-file-line-counts-*.md`。
