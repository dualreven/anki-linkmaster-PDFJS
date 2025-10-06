# 系统架构（清理版）

本文件记录当前权威的分层架构与模块职责，过时内容已移除。

## 分层与边界
- 前端（pdf-home、pdf-viewer）：纯 UI，使用共享基础设施（EventBus/Logger/WSClient），可用 QWebChannel 进行必要桥接。
- 后端：
  - WebSocket 转发器（headless）：仅负责消息收发与路由；不包含 UI。
  - HTTP 文件服务器：仅负责 PDF 文件/静态内容传输，支持 Range、UTF-8 日志。
  - PDF 业务服务器：独立模块（待实现），接收 WS 指令执行业务逻辑并应答。
- 日志：前端经 DevTools 捕获到 UTF-8 日志文件；后端统一 Python logging。
- 启动：AI Launcher 模块化，服务皆可独立运行与测试。

## 命名与 IO 规范
- 目录用 kebab-case（如 `pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 所有文件读写必须显式 UTF-8，且确保换行 `\n` 正确。

## 前端关键实现
- pdf-home：`src/frontend/pdf-home/*`（容器、QWebChannel 管理、前端日志捕获到 `logs/pdf-home-js.log`）。
- pdf-viewer：`src/frontend/pdf-viewer/*`（`ui-manager-core.js` 以 `#elements/#state` 为中心；按 `pdf_id` 输出 `logs/pdf-viewer-<pdf-id>-js.log`）。

## 后端关键实现
- WebSocket 转发器：`src/backend/websocket/standard_server.py`。
- HTTP 文件服务器：`src/backend/http_server.py`。
- PDF 业务服务器：`src/backend/services/pdf_business_server.py`（预留路径，待实现）。

## AI Launcher（模块化）
- 位置：`ai-scripts/ai_launcher/*`
- 组成：ServiceManager / ProcessManager / CLI / 示例服务（ws-forwarder、pdf-file-server、npm-dev-server）。

## 下一步
1) 实现 PDF 业务服务器最小可用版本并接入 WS 转发。
2) 校验 pdf-viewer 完整对齐共享 EventBus/WSClient 的模式。
3) 为 AI Launcher 增加健康检查与 E2E 脚本。

### 2025-10-05 更新
- pdf-viewer 新增 eatures/pdf-card 模块：提供 PDFCardFeature、CardSidebarUI，通过依赖容器延迟获取 UI 并在 SidebarManager 注册卡片侧栏
- 在 pp-bootstrap-feature.js 中注册顺序更新：PDFCardFeature 在 SidebarManagerFeature 之前装载，以确保卡片侧栏依赖被解析
### 2025-10-05 数据库系统
- Stage1（抽象层）：src/backend/database/{config,connection,transaction,executor,exceptions}.py 提供连接池、事务、SQL 执行与统一异常封装。
- Stage2（插件架构）：src/backend/database/plugin/* 定义 TablePlugin 抽象类、EventBus、PluginRegistry，实现表级插件隔离与事件驱动。
- Stage3（表插件包）：src/backend/database/plugins/* 存放具体数据表插件；首个 pdf_info_plugin.py 已落地，配套测试在 plugins/__tests__，后续表插件需复用同目录结构与事件命名（table:pdf-info:*:*）。
- Stage3 插件实例：pdf_annotation_plugin.py（标注表），与 PDFInfo 插件共享 SQLExecutor/EventBus，事件命名 	able:pdf-annotation:*:*，监听 pdf_info 删除事件执行级联清理。

- Stage3 插件实例补充：`pdf_bookmark_plugin.py`（层级书签表），与 PDFInfo 插件共享 SQLExecutor/EventBus，事件命名 `table:pdf-bookmark:*:*`，订阅 `table:pdf-info:delete:completed` 执行级联删除与树形维护。

- SearchCondition 插件：`search_condition_plugin.py` 保存筛选/排序条件，事件命名 `table:search-condition:*:*`，与其它表无直接外键但复用 TablePlugin 架构。
- 2025-10-05：新增 `PDFLibraryAPI`（backend/api/pdf_library_api.py）作为数据库插件统一出入口，并在 `StandardWebSocketServer` 中接入，提供 `pdf/list` 新消息以及文件增删同步数据库。
- 前端 pdf-bookmark 功能域：BookmarkManager 可注入 WSClient，默认通过 RemoteBookmarkStorage 先写后端再同步 LocalStorage，确保书签在刷新后持久存在。


### 2025-10-06 更新（API 插件隔离规划）
- 将 `src/backend/api/pdf_library_api.py` 内的特性按功能域拆分为子模块：
  - `src/backend/api/pdf-home/search`（搜索服务）
  - `src/backend/api/pdf-home/add`（添加/入库）
  - `src/backend/api/pdf-viewer/bookmark`（书签服务）
  - `src/backend/api/utils`（时间戳/映射/tags 等通用工具）
- `PDFLibraryAPI` 保留为向下兼容门面，方法内部委派子模块实现；不改变对外协议。

- 需求文档位置：todo-and-doing/2 todo/20251006140530-pdf-library-api-plugin-isolation/v001-spec.md