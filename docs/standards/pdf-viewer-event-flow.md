# pdf-viewer 事件流（先后关系总表）

本文目标：把 **pdf-viewer 内部关键事件** 的“先后关系/依赖关系/门控点”写清楚，避免因为“晚订阅错过事件”“把状态型事件当完成事件”“导航互斥”导致偶发回归。

适用范围：`src/frontend/pdf-viewer/**`（含 `WebSocketAdapter`、`PDFManager`、`pdf-resume`、`pdf-annotation`、`NavigationService`）。

> 说明：本文只覆盖“关键主链路”（加载/渲染/断点续读/标注自动加载/外部跳转）。其它事件（截图/评论/outline/anchor 等）请参考 `docs/standards/event-system-reference.md` 与常量文件。

---

## 0. 核心约束（先记住再看流程）

1) **导航互斥**：`NavigationService.navigateTo(...)` 同一时间只能跑一个；并发导航会失败（不是队列）。
2) **`pdf-viewer:render:ready` 是状态型、默认只发一次**：它代表“首屏至少渲染过一次”，不代表“所有业务流程完成”。
3) **标注自动加载门控点**：当前实现要求在 `resume:flow:done` 之后才允许触发 `annotation-data:load:requested`（避免竞态/错位）。
4) **“命中历史”机制**：部分关键事件会写入 gate status store（单窗口内存），用于解决“Feature 晚安装错过事件”的竞态。
   - store：`src/frontend/common/ws/ws-gate-status-store.js`

---

## 1. PDF 加载主链路（FILE.LOAD.*）

### 1.1 发起加载（入口可能有多种）

**入口 A：gui_launcher / `?file=...` 启动（Bootstrap 自动触发）**

1) `bootstrap/app-bootstrap-feature.js` 解析 `?file=` 或 `window.PDF_PATH`
2) 发射：`PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED`（`pdf-viewer:file:load-requested`）
   - payload 关键字段：`{ filename, file_path, pdfId }`
   - 约束：`pdfId` 推荐由 filename 提取 12hex（否则标注系统会 fail-fast）

**入口 B：WebSocket 旧协议 `load_pdf_file`**

1) `WebSocketAdapter` 收到 WS message：`type="load_pdf_file"`
2) 发射：`PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED`
   - payload 关键字段：`{ filename, url, file_path?, fileId?, pdfId }`

**入口 C：URL Loader（基于 `pdf-id`/url 参数）**

1) `PDFUrlLoaderFeature` 解析 URL 参数
2) 发射：`PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED`

### 1.2 执行加载（PDFManager）

3) `PDFManager` 监听 `PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED`
4) 加载过程发射：`PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS`（可多次）
5) 加载成功发射：`PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`
   - payload：`{ pdfDocument, pdfId, filename, url }`
6) 加载失败发射：`PDF_VIEWER_EVENTS.FILE.LOAD.FAILED`
   - payload：`{ filename, pdfId, code, type, userMessage, retryable, ... }`

---

## 2. 渲染就绪链路（RENDER.READY）

1) UI/Viewer 层（PDF.js bridge）在首屏页渲染完成后发射：
   - `PDF_VIEWER_EVENTS.RENDER.READY`（`pdf-viewer:render:ready`，通常只发一次）

> 注意：`FILE.LOAD.SUCCESS` 早于 `RENDER.READY`；但 `RENDER.READY` 并不等价于“文本层/标注层/断点续读已完成”。

---

## 3. 断点续读链路（RESUME.* → RESUME.FLOW.DONE）

### 3.1 触发点

1) `PDFResumeFeature` 同时监听：
   - `PDF_VIEWER_EVENTS.RENDER.READY`（主触发）
   - `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`（fallback，避免极端情况下 `RENDER.READY` 缺失）

### 3.2 流程事件顺序（同一次 PDF 生命周期内）

2) 发射：`PDF_VIEWER_EVENTS.RESUME.LOAD.REQUESTED`（`resume:load:requested`）
3) 成功：`PDF_VIEWER_EVENTS.RESUME.LOAD.LOADED`（`resume:load:success`）或失败：`resume:load:failed`
4) 若需要应用（导航）：
   - 发射：`PDF_VIEWER_EVENTS.RESUME.APPLY.REQUESTED`（`resume:apply:requested`）
   - 成功：`resume:apply:success` 或失败：`resume:apply:failed`
5) **无论是否找到/是否成功应用**，最终必须发射一次：
   - `PDF_VIEWER_EVENTS.RESUME.FLOW.DONE`（`resume:flow:done`）
   - payload：`{ pdfId, hasResume, status, error? }`
6) `RESUME.FLOW.DONE` 在发射前会写入 gate status store（用于“命中历史”）。

---

## 4. 标注自动加载链路（ANNOTATION.DATA.*）

### 4.1 门控规则（当前实现）

- 标注数据加载事件：`PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD`（`annotation-data:load:requested`）
- **触发时机**：必须满足“当前 pdfId 已知 + `resume:flow:done` 已完成（同一 pdfId）”
- 竞态规避：如果 `AnnotationFeature` 安装较晚，允许通过 gate status store “命中历史”的 `resume:flow:done` 来补触发一次加载。

### 4.2 事件顺序（一次自动加载）

1) `FILE.LOAD.SUCCESS` 到达后，`AnnotationFeature` 记录 `currentPdfId`（并把 pdfId 透传到 AnnotationManager）
2) `RESUME.FLOW.DONE` 到达后，`AnnotationFeature` 发射：
   - `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD`
3) 数据加载成功后发射：
   - `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED`（`annotation-data:load:success`）
4) 数据加载失败发射：
   - `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED`（`annotation-data:load:failed`）

> 注：目前“从外部打开 viewer 后第一次标注为空、刷新后才出现”的典型根因就是：`pdfId` 缺失或 `resume:flow:done` 被错过（晚订阅）。当前门控/状态存储就是为了解这类竞态。

---

## 5. 外部跳转（打开/激活窗口 → 导航 → 高亮标注）

> 本节描述的是 viewer 内部的“接收方事件流”；外部（pdf-home/msgcenter）只需要遵守“先确保窗口对准同一 pdfId，再发送跳转请求”。

### 5.1 建议的先后关系（外部调用侧）

1) 先“打开或激活 viewer 窗口”（窗口 ID 建议：`window:pdf-viewer:{pdfId}`）
2) 再发送“跳转请求”（携带同一 `pdfId` + 目标信息，如 `annotationId` / `pageNumber`）
3) 跳转请求建议 gate 在 `resume:flow:done`（而不是 `render:ready`）

### 5.2 viewer 内部事件顺序（接收跳转）

1) `WebSocketAdapter` 收到导航消息（推荐使用 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED`）
2) 若携带 gate：执行 `runWithGate(...)` 等待 gate 满足后再继续
3) 进入 `NavigationService.navigateTo(...)`（互斥点）
4) 导航成功/失败会回传：
   - `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_COMPLETED` 或 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED`
5) 若目标是标注：
   - 发射 `PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED`（`annotation-navigation:jump:requested`）
   - 可选发射 `PDF_VIEWER_EVENTS.ANNOTATION.HIGHLIGHT`（`annotation:highlight:requested`）

---

## 6. 常见踩坑清单（按症状对照）

1) **首次标注空、刷新后才有**
   - 检查：`FILE.LOAD.SUCCESS.pdfId` 是否为 null
   - 检查：`resume:flow:done` 是否发射/是否写入 gate store
2) **外部跳转只高亮侧边栏卡片，但页面不滚动**
   - 检查：是否出现并发导航（resume 与外部导航同时触发）
   - 建议：外部导航 gate 到 `resume:flow:done`
3) **“重复订阅检测”报错**
   - 检查：同一组件是否重复 `eventBus.on(..., { subscriberId })` 且未 `unsubscribe()`

