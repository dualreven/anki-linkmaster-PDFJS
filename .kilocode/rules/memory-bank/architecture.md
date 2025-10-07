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

### 2025-10-07 UI 顶栏调整
- 移除 pdf-home 的 `HeaderFeature`（功能域与渲染）以避免与搜索栏工具区重复；
- 顶部操作统一由 `SearchFeature` 提供，“🔃 排序”通过 `search:sort:requested` 触发 `PDFSorterFeature` 面板切换；
- 后续如需标题，仅以无交互的轻量标题组件替代。
- Stage2（插件架构）：src/backend/database/plugin/* 定义 TablePlugin 抽象类、EventBus、PluginRegistry，实现表级插件隔离与事件驱动。
- Stage3（表插件包）：src/backend/database/plugins/* 存放具体数据表插件；首个 pdf_info_plugin.py 已落地，配套测试在 plugins/__tests__，后续表插件需复用同目录结构与事件命名（table:pdf-info:*:*）。
- Stage3 插件实例：pdf_annotation_plugin.py（标注表），与 PDFInfo 插件共享 SQLExecutor/EventBus，事件命名 	able:pdf-annotation:*:*，监听 pdf_info 删除事件执行级联清理。

- Stage3 插件实例补充：`pdf_bookmark_plugin.py`（层级书签表），与 PDFInfo 插件共享 SQLExecutor/EventBus，事件命名 `table:pdf-bookmark:*:*`，订阅 `table:pdf-info:delete:completed` 执行级联删除与树形维护。

- SearchCondition 插件：`search_condition_plugin.py` 保存筛选/排序条件，事件命名 `table:search-condition:*:*`，与其它表无直接外键但复用 TablePlugin 架构。
- 2025-10-05：新增 `PDFLibraryAPI`（backend/api/pdf_library_api.py）作为数据库插件统一出入口，并在 `StandardWebSocketServer` 中接入，提供 `pdf-library:list:records` 新消息以及文件增删同步数据库。
- 前端 pdf-bookmark 功能域：BookmarkManager 可注入 WSClient，默认通过 RemoteBookmarkStorage 先写后端再同步 LocalStorage，确保书签在刷新后持久存在。


### 2025-10-06 更新（API 插件隔离规划）
- 将 `src/backend/api/pdf_library_api.py` 内的特性按功能域拆分为子模块：
  - `src/backend/api/pdf-home/search`（搜索服务）
  - `src/backend/api/pdf-home/add`（添加/入库）
  - `src/backend/api/pdf-viewer/bookmark`（书签服务）
  - `src/backend/api/utils`（时间戳/映射/tags 等通用工具）
- `PDFLibraryAPI` 保留为向下兼容门面，方法内部委派子模块实现；不改变对外协议。

- 需求文档位置：todo-and-doing/2 todo/20251006140530-pdf-library-api-plugin-isolation/v001-spec.md

### 2025-10-06 契约编程架构（三层契约体系）

#### 核心架构理念
项目采用**基于契约的通信协议**，确保前后端、模块间的强类型通信。契约体系分为三层：

```
┌──────────────────────────────────────┐
│   Layer 1: 前端内部契约                │
│   EventBus 三段式命名规范              │
│   {module}:{action}:{status}         │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│   Layer 2: 前后端通信契约              │
│   StandardMessageHandler 消息协议     │
│   Request/Response + MessageType     │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│   Layer 3: 能力注册契约                │
│   Capability Registry + Schema        │
│   JSON Schema + Hash + 版本控制       │
└──────────────────────────────────────┘
```

#### Layer 1: 前端内部契约（EventBus 三段式）

**契约定义：** `{module}:{action}:{status}`
- module: 模块名称（小写+连字符，如 `pdf-list`）
- action: 动作名称（小写+连字符，如 `load`）
- status: 状态（`requested`/`completed`/`failed`/`success`）

**运行时强制：**
- 位置：`src/frontend/common/event/event-bus.js` (EventNameValidator)
- 机制：违反契约的事件会被阻止发布，控制台显示详细错误提示
- 自动检测：下划线命名/驼峰命名/段数错误

**局部 vs 全局事件：**
- 局部事件（Feature内部）：使用 `scopedEventBus.emit()`，自动添加 `@feature-name/` 命名空间
- 全局事件（跨Feature）：使用 `scopedEventBus.emitGlobal()`，无命名空间，所有Feature可监听

#### Layer 2: 前后端通信契约（标准消息协议）

**请求消息契约：**
```javascript
{
  "type": "模块:动作:对象",        // 必需，三段式命名
  "request_id": "uuid-v4",       // 必需，唯一标识
  "timestamp": 1696300800000,    // 必需，毫秒时间戳
  "data": { /* 业务数据 */ }     // 可选
}
```

**响应消息契约：**
```javascript
{
  "type": "response",            // 固定值
  "request_id": "对应请求ID",     // 必需，关联原始请求
  "timestamp": 1696300800.123,   // 必需，秒级时间戳
  "status": "success|error",     // 必需
  "code": 200,                   // 必需，HTTP状态码
  "message": "操作结果描述",      // 必需
  "data": { /* 返回数据 */ }    // 可选（成功时）
}
```

**消息类型枚举：**
- 位置：`src/backend/msgCenter_server/standard_protocol.py` (MessageType)
- 包含：100+ 枚举值，涵盖 pdf-library/bookmark/storage-kv/storage-fs/system 等
- 命名规范：`模块:动作:对象` (如 `pdf-library:list:requested`)

**验证检查点：**
1. 前端发送前：构建消息时确保包含所有必需字段
2. 消息中心接收后：验证消息结构是否符合标准
3. 后端处理前：检查业务数据的完整性和有效性
4. 后端响应前：构建标准响应格式
5. 前端接收后：验证响应类型和数据完整性

#### Layer 3: 能力注册契约（Capability Registry）

**能力发现协议：**
```javascript
// 请求
{
  "type": "capability:discover:requested",
  "request_id": "uuid",
  "data": { "pattern": "pdf-library.*" }  // 可选
}

// 响应
{
  "status": "success",
  "data": {
    "capabilities": [
      {
        "name": "pdf-library:list:records",
        "version": "1.0.0",
        "schema_path": "schemas/pdf-library/list-v1.json",
        "schema_hash": "sha256:abc123..."
      }
    ]
  }
}
```

**Schema 版本控制：**
- 格式：JSON Schema (Draft-07)
- 版本：语义化版本号（major.minor.patch）
- 校验：SHA256 哈希防篡改
- 兼容：major 版本变更需迁移期

**存储抽象接口：**
- `storage-kv:get/set/delete:requested/completed/failed` - 键值存储
- `storage-fs:read/write:requested/completed/failed` - 文件系统存储
- 业务插件通过 API 门面访问，前端不直连 DB

#### 关键文件索引

**📋 契约定义文档：**
- `src/frontend/CLAUDE.md` - 前端开发规范（EventBus 三段式、Feature 开发流程）
- `src/frontend/pdf-home/docs/Communication-Protocol-Guide.md` - 完整通信协议指南（消息格式、类型定义、错误处理）
- `src/backend/msgCenter_server/standard_protocol.py` - MessageType 枚举定义（100+ 消息类型）
- `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/v001-spec.md` - 能力注册中心规范
- `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/USAGE.md` - 能力注册使用文档
- `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/*` - JSON Schema 契约定义
  - `schemas/capability/discover-v1.json` - 能力发现协议
  - `schemas/capability/describe-v1.json` - 能力描述协议
  - `schemas/pdf-library/list-v1.json` - PDF 列表协议
  - `schemas/pdf-library/add-v1.json` - PDF 添加协议
  - `schemas/pdf-library/remove-v1.json` - PDF 删除协议
  - `schemas/bookmark/list-v1.json` - 书签列表协议
  - `schemas/bookmark/save-v1.json` - 书签保存协议
  - `schemas/storage-kv/get-v1.json` - KV 存储读取协议
  - `schemas/storage-kv/set-v1.json` - KV 存储写入协议
  - `schemas/storage-fs/read-v1.json` - FS 文件读取协议
  - `schemas/storage-fs/write-v1.json` - FS 文件写入协议

**⚙️ 契约执行代码：**

*前端（EventBus 层）：*
- `src/frontend/common/event/event-bus.js` - EventNameValidator 运行时验证、EventBus 核心实现
- `src/frontend/common/event/scoped-event-bus.js` - ScopedEventBus（局部/全局事件区分）
- `src/frontend/common/event/event-constants.js` - 前端事件常量定义
- `src/frontend/common/event/global-event-registry.js` - 全局事件白名单注册
- `src/frontend/common/event/message-tracer.js` - 消息调用链追踪

*前端（WebSocket 层）：*
- `src/frontend/common/ws/ws-client.js` - WebSocket 客户端（消息发送/接收、request_id 管理）
- `src/frontend/pdf-home/features/pdf-manager/index.js` - PDF 管理器（消息组装与分发）

*后端（消息中心层）：*
- `src/backend/msgCenter_server/standard_protocol.py` - 标准消息协议（MessageType 枚举、验证器、响应构建器）
- `src/backend/msgCenter_server/standard_server.py` - StandardWebSocketServer（消息路由、能力注册、处理器分发）

*后端（API 层）：*
- `src/backend/api/service_registry.py` - ServiceRegistry 能力注册中心
- `src/backend/api/pdf_library_api.py` - PDFLibraryAPI 门面（委派到子服务）
- `src/backend/api/pdf-home/search/service.py` - 搜索服务实现
- `src/backend/api/pdf-home/add/service.py` - 添加服务实现
- `src/backend/api/pdf-viewer/bookmark/service.py` - 书签服务实现
- `src/backend/api/utils/datetime.py` - 时间戳转换工具
- `src/backend/api/utils/mapping.py` - 数据映射工具
- `src/backend/api/utils/tags.py` - 标签归一化工具

*后端（数据库插件层）：*
- `src/backend/database/plugins/pdf_info_plugin.py` - PDF 信息表插件
- `src/backend/database/plugins/pdf_annotation_plugin.py` - PDF 标注表插件
- `src/backend/database/plugins/pdf_bookmark_plugin.py` - PDF 书签表插件
- `src/backend/database/plugins/search_condition_plugin.py` - 搜索条件表插件

**🧪 测试验证代码：**

*前端测试：*
- `src/frontend/common/event/__tests__/event-bus.test.js` - EventBus 核心功能测试
- `src/frontend/common/event/__tests__/event-name-validation.test.js` - 事件名称验证测试
- `src/frontend/common/event/__tests__/scoped-event-bus.test.js` - ScopedEventBus 测试
- `src/frontend/common/ws/__tests__/ws-client.test.js` - WebSocket 客户端测试

*后端测试：*
- `src/backend/msgCenter_server/__tests__/test_standard_server_messages.py` - 标准消息处理测试
- `src/backend/msgCenter_server/__tests__/test_standard_server_bookmarks.py` - 书签消息测试
- `src/backend/msgCenter_server/__tests__/test_capability_registry.py` - 能力注册中心测试
- `src/backend/msgCenter_server/__tests__/test_storage_kv_and_fs.py` - 存储服务测试
- `src/backend/api/__tests__/test_pdf_library_api.py` - PDFLibraryAPI 测试（119+ 用例）
- `src/backend/api/__tests__/test_api_service_registry.py` - ServiceRegistry 测试
- `src/backend/api/__tests__/test_bookmark_persistence.py` - 书签持久化闭环测试

*数据库插件测试：*
- `src/backend/database/plugins/__tests__/test_pdf_info_plugin.py` - PDF 信息插件测试
- `src/backend/database/plugins/__tests__/test_pdf_info_plugin_search_records.py` - 搜索功能测试
- `src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py` - 标注插件测试
- `src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py` - 书签插件测试
- `src/backend/database/plugins/__tests__/test_search_condition_plugin.py` - 搜索条件插件测试

**📖 架构与使用指南：**
- `src/frontend/HOW-TO-ADD-FEATURE.md` - 添加新 Feature 的标准流程
- `src/frontend/ARCHITECTURE-EXPLAINED.md` - 插件架构深度解析
- `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md` - EventBus 完整使用指南
- `src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md` - 事件追踪调试指南
- `.kilocode/rules/memory-bank/architecture.md` - 本文档（契约编程架构）
- `.kilocode/rules/memory-bank/context.md` - 开发上下文与实践指导

#### 契约执行流程示例

```
用户操作
  ↓
Feature 触发事件 (EventBus 验证三段式)
  ✅ 'pdf:load:requested' 通过
  ❌ 'loadData' 被阻止
  ↓
PDFManager 构建消息 (MessageType 枚举验证)
  ✅ "pdf-library:list:requested" 在枚举中
  ❌ "get_pdf_list" 被拒绝
  ↓
WSClient 发送消息 (格式验证)
  ✅ 包含 type/request_id/timestamp
  ❌ 缺少 request_id 被拦截
  ↓
StandardWebSocketServer 接收 (能力注册验证)
  ✅ 消息类型已注册 + Schema 验证通过
  ❌ 未知消息类型返回错误
  ↓
后端处理并返回 (响应格式验证)
  ✅ 包含 status/code/message/data
  ❌ 缺少必需字段被拒绝
  ↓
前端接收并更新 UI (数据完整性验证)
```

#### 向后兼容策略

```python
# 保留旧版消息类型用于迁移期
LEGACY_PDF_LIBRARY_LIST = "pdf-library:list:records"  # 旧格式
PDF_LIBRARY_LIST_REQUESTED = "pdf-library:list:requested"  # 新格式
```

#### 契约优势

1. **编译期/运行时双重保障**：EventNameValidator + MessageType 枚举 + Schema 验证
2. **自文档化**：枚举即文档，JSON Schema 提供精确数据结构
3. **可追溯性**：request_id 全链路追踪，Logger 记录所有违规
4. **强类型通信**：三层契约确保消息格式错误在开发阶段发现

#### 全域能力覆盖（2025-10-06）

- ✅ pdf-library（list/add/remove/info/config）
- ✅ bookmark（list/save）
- ✅ pdf-page（load/preload/cache-clear）
- ✅ storage-kv（get/set/delete）
- ✅ storage-fs（read/write）
- ✅ capability（discover/describe）
- ✅ system（heartbeat/status/config）

所有能力均有对应 Schema 定义，位于 `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/`。
