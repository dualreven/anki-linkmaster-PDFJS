# PDF-Home 搜索（v001）— 后端打通规格大纲

功能ID: 20251006080027-home-search-backend
优先级: 高
版本: v001
创建时间: 2025-10-06 08:00:27
预计完成: 2025-10-07
状态: 设计完成（待实施）

## 背景与目标
- 目标：在 pdf-home 上实现“基础版搜索”的前后端打通，只做 search，不含 filter/sort。
- 流程：用户输入关键词 → 以空格分词（tokens）→ 在 SQLite 中对多字段进行模糊匹配（LIKE）→ 返回结果给前端展示。
- 可配置：默认搜索字段包含标题、作者、文件名、标签、备注、主题、关键词；后续应可配置。

## 当前状况与差距
- 前端：已具备 SearchBar、SearchFeature、SearchManager、SearchResultsFeature；SearchManager 通过 EventBus 发送 WebSocket 消息并接收响应，使用事件 `websocket:message:received` 分发。
- 协议：前端使用消息类型 `type: "pdf/search"`，后端 msgCenter 标准服务器已实现对应处理逻辑，并调用 `PDFLibraryAPI.search_records(...)`。
- 数据库：`PDFInfoTablePlugin.search_records(keywords, search_fields, ...)` 已实现多关键词、多字段模糊搜索（AND 连接关键词，字段内 OR）。
- 差距：需要形成一致的“最小闭环实施步骤+测试方案”，并补上必要的校验、配置与诊断文档，以减少集成风险。

## 设计原则
- 单一入口：通过 `msgCenter_server/standard_server.py` 的 `type: "pdf/search"` 路由访问数据库搜索。
- 防回归：保留旧的 `pdfTable_server` 兼容路径（`pdf-home:search:pdf-files`），但本次不改动旧路径。
- 安全稳健：SQL 统一使用参数绑定；LIKE 特殊字符（`%`、`_`）转义；前后端所有文件 I/O 均显式 UTF-8，且换行 `\n` 正确。

## 协议与数据结构（v001）
- WebSocket 请求
  - `type: "pdf/search"`
  - `request_id: string`
  - `data`: `{ search_text: string, search_fields?: string[], include_hidden?: boolean, limit?: number, offset?: number }`
- WebSocket 响应（成功）
  - `type: "pdf/search"`
  - `status: "success"`
  - `data`: `{ records: PDFRecord[], count: number, search_text: string }`
- 记录结构（前端使用）示例字段：`id, title, author, tags, notes, rating, is_visible, file_path, created_at, updated_at, last_accessed_at ...`

参考文件：
- 前端事件常量：`src/frontend/common/event/event-constants.js:1`
- 前端 WS 客户端：`src/frontend/common/ws/ws-client.js:1`
- 前端搜索管理器：`src/frontend/pdf-home/features/search/services/search-manager.js:1`
- 搜索结果渲染：`src/frontend/pdf-home/features/search-results/index.js:1`
- 后端 WS 服务器：`src/backend/msgCenter_server/standard_server.py:1`
- 数据库搜索插件：`src/backend/database/plugins/pdf_info_plugin.py:1`
- 统一 API 门面：`src/backend/api/pdf_library_api.py:1`

## 端到端流程（v001）
1) SearchBar 将输入变更 → `search:query:requested`（空格=且，A B 表示同时包含 A 与 B）
2) SearchFeature 桥接到全局 EventBus → `search:query:requested`
3) SearchManager 生成 `request_id` 并通过 `WEBSOCKET_EVENTS.MESSAGE.SEND` 发送 `{ type: 'pdf/search', data: {...} }`
4) msgCenter 标准服务器匹配 `pdf/search` → 调用 `PDFLibraryAPI.search_records(search_text, ...)` → 由 `PDFInfoTablePlugin.search_records(...)` 在 SQLite 进行多字段模糊搜索（多关键词 AND，字段内 OR）
5) 服务器返回 `type: 'pdf/search'` 成功响应
6) WSClient 发出 `websocket:message:received`，SearchManager 捕获并发布 `search:results:updated`
7) SearchResultsFeature 渲染结果列表

## 实施步骤总览（点击查看细节）
- 步骤01：架构梳理与协议校验 → 见 ./v001-spec-step01-arch-and-contracts.md
- 步骤02：后端 WS 路由与 API 打通 → 见 ./v001-spec-step02-backend-ws-handler.md
- 步骤03：数据库搜索插件校验与用例 → 见 ./v001-spec-step03-db-plugin-search.md
- 步骤04：前端集成与事件流验证 → 见 ./v001-spec-step04-frontend-integration.md
- 步骤05：E2E 场景与验收测试 → 见 ./v001-spec-step05-e2e-test-plan.md
- 步骤06：日志与诊断（问题定位） → 见 ./v001-spec-step06-logging-and-diagnostics.md

## 验收标准（v001）
- 功能正确：
  - 支持单/多关键词（空格分词）搜索；关键词之间 AND；字段内 OR；空搜索返回全部。
  - 默认字段：title/author/filename/tags/notes/subject/keywords；字段可配但 v001 用默认值。
  - 前端能收到结果并在列表中渲染，数量徽标显示正确。
- 接口契约：
  - 请求与响应均按本文协议；消息类型固定 `pdf/search`；所有 JSON 字段 snake_case。
- 稳定性与日志：
  - 前后端日志均为 UTF-8 输出，换行 `\n`；错误路径有明确日志与用户可见提示。
- 测试：
  - 覆盖后端 `PDFInfoTablePlugin.search_records` 的关键词组合、转义、tags 数组匹配等用例。
  - 联调用例：通过 WS 发送请求，验证响应结构与 SearchManager 事件派发。

## 风险与回滚
- 风险：消息类型不一致、字段大小写/命名不一致导致前端不识别；LIKE 特殊字符未转义导致误命中；tags 数组匹配策略导致性能问题。
- 回滚：保持现有 `pdfTable_server` 的 `pdf-home:search:pdf-files` 老路径不变；若新路径异常，可短期退回旧逻辑（但前端 v001 默认走 `pdf/search`）。

## 规范依赖
- 必须先阅读 `src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json:1` 引用的规范；遵循事件命名与模块注册规则。
- 所有文件读写显式 UTF-8 编码；严格检查输出换行符 `\n`。
