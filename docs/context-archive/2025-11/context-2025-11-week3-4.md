# Memory Bank Context 归档 - 2025年11月第3-4周 (11-15 ~ 11-27)

归档日期：2025-11-27
归档范围：2025-11-15 至 2025-11-27 的详细变更记录

---

## 2025-11-27

### PDF 页码跳转偏差 Bug 修复
- **问题**：用户移动到第 42 页，关闭再打开 PDF，页码指示器显示 42 页，但实际位置在 40 页
- **根因**：存在四重滚动冲突（currentPageNumber + ensurePageVisible×2 + scrollToPosition）
- **修复**：
  - 删除 `PDFViewerManager.ensurePageVisible()` 方法
  - 删除 `ui-manager-core.js` 中的 `ensurePageVisible` 调用
  - 删除 `pdf-dest-utils.js` 中的 `positionPercentToY()` 函数
  - 重构 `test.navigateToPercent()` 通过 EventBus 触发导航
- **架构改进**：`NavigationService` 成为唯一的滚动执行者

### pdf-resume 插件模块化重构
- 主文件从 548 行压缩到 318 行（-42%）
- 4 个 P0 级 Fail-Fast 违规已修复
- 新增 10 个模块文件（utils/services/shared）
- 新增公共模块：
  - `pdf-viewer/shared/position-tracker.js`：位置追踪器
  - `common/utils/pdf-page-detection-utils.js`：页码检测纯函数
  - `common/utils/dom-utils.js`：新增 `addManagedEventListener()` 方法

---

## 2025-11-26

### pdf-viewer 断点续读状态保存链路修复
- **问题**：前端 pdf-resume 发送 json_data.resume，但重新打开时 resume 始终为 null
- **根因**：pdf_info.validate 校验时丢弃 resume 等扩展字段；map_to_frontend 未透传 json_data
- **修复**：
  - pdf_info.validate._validate_json_data 保留未校验的扩展字段
  - pdf_library.utils.map_to_frontend 增加 json_data 字段透传

---

## 2025-11-25

### gui_launcher 跳转测试（大纲导航）在 Hosted 模式下无效的修复
- **问题**：MsgCenter 成功转发，但 viewer 前端无 toast 也无跳转
- **根因**：重构后 `WebSocketAdapter.onInitialized()` 未被调用，导致消息滞留在队列
- **修复**：在 `AppCoreFeature` 安装适配器后，对所有带 `onInitialized` 方法的适配器调用初始化

### 前端应用启动 / DI / FeatureRegistry 引导流程抽象统一
- 新增 `src/frontend/common/micro-service/app-bootstrap.js`：
  - `createAppContainer({ name, eventBus, logger })`
  - `createFeatureRegistry({ container, eventBus, logger, aliases })`
- pdf-home 和 pdf-viewer 统一使用公共启动工具

### WebSocket 适配器安装逻辑统一抽象
- 新增 `src/frontend/common/features/ws-infra/index.js`：
  - `setupWsInfra({ container, eventBus, logger, adapterFactories })`
- pdf-home 和 pdf-viewer 统一使用公共 helper

### 前端错误提示统一策略
- 公共设施：
  - `notification.js`：底层 toast 封装
  - `websocket-error-handler.js`：统一 WS 错误监听
  - `domain-error-notifier.js`：领域错误提示入口
  - `dom-utils.js`：回退到 DOM 错误区域

### pdf-viewer 端 anchor 导航现状记录
- WebSocketAdapter 收到 anchor 导航请求时转成内部事件
- PDFAnchorFeature 按锚点ID查找本地缓存，记录跳转计划
- 等待锚点数据和 PDF 渲染都就绪后统一跳转

---

## 2025-11-24

### MsgCenter app-window:open:requested UNKNOWN_MESSAGE_TYPE 问题修复
- **问题**：GUI Hosted 模式下启动 PDF-Home 报 `未知消息类型`
- **根因**：`msg_router.py` 只为 close 注册了 Handler，遗漏 open
- **修复**：为 `app-window:open:requested` 注册协议层 Handler

### 前端 DI 容器统一（DependencyContainer 兼容 SimpleDependencyContainer API）
- **问题**：pdf-viewer 启动报错 `container.registerGlobal is not a function`
- **修复**：在 `DependencyContainer` 新增 `resolve()` 和 `registerGlobal()` 方法

### pdf-home / pdf-viewer 结构差异与防重复约束
- 容器与 WS 身份：禁止各自引入新的容器基类
- WebSocket 适配与领域桥接：注册协议只能在 adapter-base 中
- 窗口控制：只能通过 common/components/window-controls 提供
- 错误提示：统一往 common 目录迁移

---

## 2025-11-23

### 修复 MsgCenter 验证失败后仍执行业务逻辑的设计缺陷
- **问题1**：`gui_launcher.py` 发送消息时缺少 `to` 字段
- **问题2**：`to` 字段验证失败后，所有业务逻辑仍然执行
- **修复**：
  - 为消息添加 `"to": "backend"` 字段
  - 在发射 `message_received` 信号前检查返回值，错误响应不发射

---

## 2025-11-21

### WindowControlsComponent DOM 操作修复
- **问题**：`mount()` 使用 `innerHTML` 覆盖容器导致其他元素被删除
- **修复**：
  - Line 106: 改用 `insertAdjacentHTML('beforeend', html)` 追加
  - Line 294: 改用 `querySelector('.window-controls').remove()` 选择性删除

---

## 2025-11-20

### DRY 原则固化到 Memory Bank
- 开发前搜索：添加功能前必须搜索是否已有实现
- 禁止重复：禁止跨模块重复、禁止同模块内重复
- 发现重复：必须询问用户是否抽象为共享模块

### Feature间通信规范文档固化
- P0级核心固化：HOW-TO-ADD-FEATURE.md、EVENTBUS-USAGE-GUIDE.md、CLAUDE.md
- P1级入口补充：pdf-home/features/README.md、pdf-viewer/features/README.md
- P2级索引链接：ARCHITECTURE-EXPLAINED.md、PLUGIN-ARCHITECTURE.md、architecture.md

### AI Plan 模式协作规范固化
- 所有会产生副作用的操作必须先输出 Plan，用户确认后再执行

### 窗口生命周期管理类引入
- 新增 `WindowLifecycleManager` 统一管理窗口对象与 WebSocket 客户端

---

## 2025-11-19

### PDF-Home HTML 标题栏与搜索面板布局修复
- **问题**：SearchFeature 的 `.search-panel` 遮挡标题栏
- **修复**：
  - 搜索面板插入 `.main-content` 内部作为第一个子节点
  - 样式从 `position: fixed` 调整为 `position: sticky`

### 移除 PDF-Home 启动横幅 app-boot-banner
- 删除 `#app-boot-banner` 提示条，启动状态改为通过日志观测

### 为 E2E 测试引入独立数据库文件
- `db_path` 改为 `data/anki_linkmaster_e2e.db`，隔离测试数据

### 侧边栏折叠后的主内容宽度修复
- 移除 `.main-content` 硬编码的 `margin-left: 300px`

### PDF-Home 窗口控制与 client 注册修复
- 关闭按钮显式调用 `wsClient.disconnect('user_close')` 发送 unregister 消息

---

## 2025-11-17

### 客户端注册 E2E 测试完成
- PDF-Home：4个测试文件（F1/B2/F3/CT）
- GUI-Launcher：4个测试文件（F1/B2/F3/CT）
- 客户端注册协议统一：
  - pdf-viewer：动态 `client_id = "pdf-viewer-{pdf-id}"`
  - pdf-home：固定 `client_id = "pdf-home"`
  - gui-launcher：固定 `client_id = "gui-launcher:ui"`

---

## 2025-11-16

### MsgCenter 导航 Bug 修复与集成测试完善
- **Bug 1**（Line 438）：参数提取错误 `data.get("to")` → `message.get("to")`
- **Bug 2**（Line 543）：Handler 调用缺少路由信息
- **测试盲区分析**：现有测试直接调用 Handler，绕过了 `handle_message()` 的关键逻辑
- **集成测试创建**：5 个测试场景，从 `handle_message()` 入口开始测试

### GUI Launcher "跳转测试"在 Hosted 模式下失败的原因分析
- 导航消息使用新协议 client_id，而 Hosted viewer 按旧协议注册
- RouteRegistry 找不到目标，返回 `NO_TARGET_FOUND`

---

## 2025-11-15

### MsgCenter 路由系统重构（Batch 1）
- 新增 `RouteRegistry` 类：三层索引（精确/类型/资源）
- 路由协议升级：旧字段（viewer_id/pdf_uuid）→ 新字段（client_id/target_type/routing_key）
- 向后兼容：双轨制运行

### MsgCenter 路由系统重构（Batch 2）
- 前端 WebSocketAdapter 适配新路由协议
- 路由验证三层架构：旧协议检测、新协议验证、业务逻辑执行

### EventBus 重复订阅问题修复
- URLNavigationFeature：删除重复订阅代码
- PDFResumeFeature：区分诊断订阅和动态订阅的 subscriberId

### gui_launcher WebSocket 客户端注册修复
- 实现两阶段消息发送：先注册，再发送业务消息

### GUI Launcher 开发/生产模式修复
- 添加复选框状态检查逻辑，正确处理 Vite 服务器启动

---

## 快速检索关键词

- 路由/Router/RouteRegistry：2025-11-15、2025-11-16
- WebSocket/WS：2025-11-15、2025-11-17、2025-11-23、2025-11-25
- 导航/Navigate：2025-11-16、2025-11-25、2025-11-27
- 断点续读/Resume：2025-11-26、2025-11-27
- DI/Container/依赖注入：2025-11-24、2025-11-25
- 窗口/Window：2025-11-20、2025-11-21、2025-11-23、2025-11-24
- 测试/Test：2025-11-16、2025-11-17
