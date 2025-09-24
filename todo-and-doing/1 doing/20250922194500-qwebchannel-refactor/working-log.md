# 工作日志 - 20250922194500-qwebchannel-refactor

日期: 2025-09-22

内容摘要:
- 后端：为 pdf-home 模块集成 QWebChannel
  - 新增 `src/backend/app/pdf_home_bridge.py`，提供 `selectPdfFiles`, `getPdfList`, `removePdf`, `openPdfViewer`，并通过 `pdfListUpdated` 信号通知前端
  - 在 `AnkiLinkMasterApp._run_pdf_home_client` 中创建 `PDFManager`，初始化 `QWebChannel`，注册 `pdfHomeBridge`
  - 兼容导入：在 `src/backend/qt/compat.py` 中增加 `QWebChannel` 导出
  - 为 `PDFHomeDialogClient` 增加 `send_json()` 以便桥接层复用其 WebSocket 发送打开查看器请求

- 前端：切换 pdf-home 页面到 QWebChannel 调用
  - 在 `src/frontend/pdf-home/index.html` 引入 `../common/qwebchannel.js`
  - 新增 `src/frontend/pdf-home/qwebchannel-bridge.js`，封装 QWebChannel 初始化
  - 在 `src/frontend/pdf-home/index.js`：
    - 引入并初始化 QWebChannel
    - 拦截 `PDF_MANAGEMENT_EVENTS.ADD/REMOVE/OPEN.REQUESTED`，通过桥接调用后端
    - 通过桥接信号 `pdfListUpdated` 和 `getPdfList()` 驱动表格列表更新
    - 保留 WebSocket 连接用于日志与打开 viewer 的链路（桥接内部发送 open 请求）

验收自检:
- 打开 pdf-home 页面后，初始列表通过 `getPdfList()` 正常加载
- 点击“添加PDF文件”弹出本地选择对话框，选择后列表更新
- 列表项“删除”操作生效并触发列表刷新
- 双击行或“打开”按钮可通过 WebSocket 请求打开 viewer（日志可见请求已发送）

后续建议:
- 如需前端彻底移除与列表相关的 WebSocket 依赖，可按需裁剪 `PDFManager` 的初始化路径（当前已不调用其 initialize）。

---

2025-09-23 01:30 变更巩固与纯化

- 启动方式与边界
  - 新增 `pdf-home.py`，执行 `python pdf-home.py` 可独立启动 pdf-home 窗口。
  - Vite 被视为外部基础服务，不在模块内管理；应用内部自动解析 Vite 端口。
  - WebSocket 标准服务器作为外部服务，负责数据面对外交互（列表、增删、viewer 打开等）。

- 数据通信切换（保持模块“纯度”）
  - 列表获取/更新回归 WebSocket：前端使用 `PDFManager.initialize()` 通过 WS 获取与订阅列表更新；不再经 QWebChannel 获取列表。
  - QWebChannel 保留用于 PyQt 与页面的本地交互（可用于触发本地文件对话框），但不承载列表/增删的数据流。

- 代码要点
  - `src/backend/app/application.py`：pdf-home 模式自动解析 Vite 端口；初始化 `QWebChannel` 并注册 `pdfHomeBridge`。
  - `src/backend/app/pdf_home_bridge.py`：
    - 保留 `selectPdfFiles()`（PyQt 文件对话框，便于本地交互）、
      增加 `addPdfFromBase64()` 与 `addPdfBatchFromBase64()`（备用的前端直传能力）。
    - 实际数据面仍建议走 WS：前端发送 `file_selection_request`，后端通过 `PDFHomeDialogClient` 代理文件选择与入库，并广播列表更新。
  - `src/frontend/pdf-home/index.js`：
    - 列表使用 WS 管理（`PDFManager.initialize()`）。
    - 保留 QWebChannel 初始化钩子（当前不承载列表流）。
  - `src/frontend/pdf-home/index.html`：继续引入本地 `../common/qwebchannel.js`；Tabulator CSS 仍用 CDN。

- 运行说明（开发态）
  1) 启动 Vite（外部）：`npm run dev`
  2) 启动 WS 标准服务器（外部）：`python src/backend/websocket/server_main.py --port 8765`
  3) 启动 pdf-home：`python pdf-home.py`

- 当前符合规格的要点对照
  - 可独立启动的 pdf-home 窗口，QWebChannel 与页面互通；
  - 列表获取/更新走 WS，数据面统一；
  - 文件选择可通过桌面代理（WS）实现 PyQt 对话框选择；
  - 与外界仅通过 HTTP/WS 交互；
  - 保持 `PDFManager` 接口与事件流；UI 表格刷新按 WS 推送进行。
