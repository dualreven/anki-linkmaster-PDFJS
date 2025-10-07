# Memory Bank（精简版 / 权威）

## 当前任务（20251007190618）
- 名称：实现 pdf-home 侧边栏“最近阅读”（visited_at 降序）
- 问题背景：
  - 侧边栏 recent-opened 子功能为空实现，无法展示最近阅读列表；
  - 需求：按 visited_at 字段降序获取前 N 条记录显示书名；点击任一项，等同于“搜索全部内容，并按 visited_at 降序排列”。
- 相关模块与函数：
  - 前端：
    - `src/frontend/pdf-home/features/sidebar/recent-opened/index.js`（本次实现：请求、渲染、交互）
    - `src/frontend/pdf-home/features/sidebar/components/sidebar-container.js`（容器 DOM）
    - `src/frontend/pdf-home/features/search/services/search-manager.js`（需扩展：透传 sort/pagination）
    - `src/frontend/common/event/event-constants.js`（消息常量）
  - 后端：
    - `src/backend/msgCenter_server/standard_server.py::handle_pdf_search_request`（标准搜索）
    - `src/backend/api/pdf_library_api.py::search_records`（支持 payload.sort / pagination.limit=0）
- 执行步骤（原子化）：
  1) 设计测试：
     - 安装 RecentOpened 时，发送 `pdf-library:search:requested`，data.sort 包含 `{field:'visited_at',direction:'desc'}`，pagination.limit=显示条数
     - 收到 `search:completed` 响应后渲染列表（显示 title）
     - 点击任一项，发出 `search:query:requested`，携带 sort 与 pagination.limit=0（全量）
  2) 实现 RecentOpened：容器绑定、限数下拉、请求与渲染、点击触发
  3) 扩展 SearchManager：透传 `sort` 与 `pagination` 到 WS 消息
  4) 运行并修复测试
  5) 回写本文件与 AI-Working-log，并通知完成

## 当前任务（20251007045101）
- 名称：修复 pdf-home 的 PDF 编辑保存链路（前后端联通 + Toast 提示）
- 问题背景：
  - 前端 pdf-edit 功能域存在表单与提交逻辑，但保存后“跑不起来”：
    1) WEBSOCKET_MESSAGE_TYPES 缺失 `pdf-library:record-update:requested`，WSClient 拒绝发送（未注册的请求类型）。
    2) 保存流程未接入 Toast，用户缺少“更新中/完成/失败”状态反馈。
  - 后端 msgCenter 标准协议与 standard_server 已实现 `pdf-library:record-update:*`，可直接对接。
- 相关模块与函数：
  - 前端：
    - `src/frontend/pdf-home/features/pdf-edit/index.js`（保存逻辑、WS 提交、现有全局错误容器）
    - `src/frontend/common/event/event-constants.js`（消息常量定义）
    - `src/frontend/common/ws/ws-client.js`（请求白名单 ALLOWED_OUTBOUND_TYPES 收集）
    - `src/frontend/common/utils/thirdparty-toast.js`（标准 toast 适配器）
  - 后端：
    - `src/backend/msgCenter_server/standard_server.py::handle_pdf_update_request`
    - `src/backend/msgCenter_server/standard_protocol.py::MessageType.PDF_LIBRARY_RECORD_UPDATE_*`
- 执行步骤（原子化）：
  1) 补充前端常量：在 `WEBSOCKET_MESSAGE_TYPES` 中加入 `PDF_LIBRARY_RECORD_UPDATE_REQUESTED/COMPLETED/FAILED`
  2) 在 pdf-edit 保存流程中接入第三方 toast：提交前 `pending('更新中')`，成功 `success('更新完成')`，失败 `error('更新失败-原因')`
  3) 设计最小化测试：断言 WSClient.ALLOWED_OUTBOUND_TYPES 含 `record-update:requested`
  4) 本地联调验证：点击编辑-保存，观察后端日志与前端 toast
  5) 回写本文件与 AI-Working-log，并通知完成

## 总体目标
- 前端（pdf-home、pdf-viewer）为纯 UI 模块，复用共享基础设施（EventBus / Logger / WSClient），仅在必要时通过 QWebChannel 与 Python 通信。
- 后端分三类：WebSocket 转发器（仅收发转发）、HTTP 文件服务器（仅文件传输）、PDF 业务服务器（独立、接收指令执行业务）。
- 日志分层：前端控制台经 DevTools 捕获写入 UTF-8 文件；后端统一用 Python logging（文件覆盖写，UTF-8）。
- AI Launcher 模块化：服务短小、可 start/stop/status，模块可独立运行与测试。

## 统一规范
- 目录命名：统一 kebab-case（示例：`pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 文件 I/O：所有读写显式 UTF-8；确保换行 `\n` 正确。
- 前端依赖：统一使用 `src/frontend/common/*`（EventBus / Logger / WSClient）。

---

## ⚠️ 前端开发核心规范（必读）

### 1️⃣ Logger 日志系统（强制使用）

**❌ 严禁使用**: `console.log` / `console.info` / `console.warn` / `console.error`  
**✅ 必须使用**: 项目的 Logger 系统

**位置**: `src/frontend/common/utils/logger.js`

**基本用法**:
```javascript
import { getLogger, LogLevel } from '../common/utils/logger.js';

// 获取模块专属 logger（推荐使用 getLogger，会自动缓存实例）
const logger = getLogger('ModuleName');

// 使用日志
logger.debug('调试信息', extraData);      // 调试级别
logger.info('一般信息', extraData);       // 信息级别
logger.warn('警告信息', extraData);       // 警告级别
logger.error('错误信息', errorObject);   // 错误级别
logger.event('event:name', 'action', data); // 事件日志
```

**为什么必须使用 Logger**:
1. 统一日志格式，便于调试和追踪问题
2. 支持日志级别控制，生产环境可关闭 debug 日志
3. 日志会被保存到文件，便于事后分析
4. 防止敏感信息泄露（Logger 会过滤私有属性）
5. 与 PyQt 集成，前后端日志统一管理

**日志治理能力**:
- 全局/模块级级别覆盖：`setGlobalLogLevel(level)`、`setModuleLogLevel(module, level)`
- 限流：按"模块+级别"固定窗口限流（默认 120 条/秒）
- 重复折叠：相同消息在 500ms 内仅首条输出
- 事件采样与裁剪：`logger.event()` 支持采样（默认 100%/生产20%）

**运行时配置**（localStorage）:
- `LOG_LEVEL`: `debug|info|warn|error`
- `LOG_EVENT_SAMPLE_RATE`: `0~1` 浮点数

---

### 2️⃣ 项目启动方法（必须遵守）

**⚠️ 严禁直接运行**: `npm run dev` 或 `python app.py` 等命令！  
**✅ 必须使用**: `ai_launcher.py` 脚本管理项目启动和停止

**正确启动方式**:
```bash
# 启动 PDF-Home 模块（文件管理界面）
python ai_launcher.py start --module pdf-home

# 启动 PDF-Viewer 模块（查看器）
python ai_launcher.py start --module pdf-viewer --pdf-id sample

# 检查服务状态
python ai_launcher.py status

# 停止所有服务
python ai_launcher.py stop
```

---

### 3️⃣ EventBus 事件命名规范（严格遵守）

**格式**: `{module}:{action}:{status}` （必须正好3段，用冒号分隔）

**✅ 正确示例**:
```javascript
'pdf:load:completed'          // PDF加载完成
'bookmark:create:requested'   // 请求创建书签
'sidebar:open:success'        // 侧边栏打开成功
```

**❌ 错误示例**:
```javascript
'loadData'                    // ❌ 缺少冒号
'pdf:list:data:loaded'        // ❌ 超过3段
'pdf_list_updated'            // ❌ 使用下划线
```

**⚠️ 不符合格式会导致 EventBus 验证失败，代码无法运行！**

---

### 4️⃣ 局部事件 vs 全局事件（严格区分）

#### 🔹 局部事件（Feature内部通信）
**使用方法**: `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`
- 仅在同一Feature内传递

```javascript
// 发布局部事件
scopedEventBus.emit('data:load:completed', data);
// 实际事件名: @my-feature/data:load:completed
```

#### 🌐 全局事件（Feature间跨模块通信）
**使用方法**: `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀
- 所有Feature都可以监听

```javascript
// 发布全局事件（其他Feature可监听）
scopedEventBus.emitGlobal('pdf:bookmark:created', bookmark);

// 监听全局事件（来自其他Feature）
scopedEventBus.onGlobal('pdf:file:loaded', (data) => {
  this.#loadBookmarks(data);
});
```

---

### 5️⃣ Feature 开发标准流程

**📖 完整文档**: `src/frontend/HOW-TO-ADD-FEATURE.md`

**Feature类必须实现**:
- `name` getter: 功能名称（kebab-case）
- `version` getter: 版本号
- `dependencies` getter: 依赖的其他Feature
- `install(context)`: 安装功能
- `uninstall(context)`: 卸载功能

**在Bootstrap中注册**:
```javascript
// 文件: bootstrap/app-bootstrap-feature.js
import { MyFeature } from '../features/my-feature/index.js';
registry.register(new MyFeature());
```

---

### 6️⃣ 依赖注入规范

**✅ 正确方式：通过Container获取依赖**
```javascript
const { container } = context;
const pdfManager = container.get('pdfManager');
```

**❌ 错误方式：硬编码依赖**
```javascript
// ❌ 禁止：直接import其他Feature
import { PDFManager } from '../pdf-manager/pdf-manager.js';
```

---

### 7️⃣ 功能域模块化架构

**📖 深度解析**: `src/frontend/ARCHITECTURE-EXPLAINED.md`

**核心原则**:
1. **功能域隔离**: 每个Feature独立目录 (`features/功能名/`)
2. **事件驱动通信**: Feature间仅通过EventBus通信
3. **依赖注入**: 通过DependencyContainer注入依赖

**严格禁止**:
- ❌ Feature之间直接调用函数
- ❌ 硬编码依赖其他Feature的路径
- ❌ 绕过EventBus直接操作DOM

---

### 8️⃣ 契约编程实践

契约编程强调在编码前先定义清晰的接口契约，并通过文档、测试等方式固化。

**核心原则**:
1. **契约优先**: 编码前先定义接口契约
2. **契约验证**: 通过测试用例验证
3. **契约文档**: 以文档形式固化
4. **契约隔离**: 模块间只通过契约通信

---

## 模块职责

### 前端（pdf-home / pdf-viewer）
- 纯 UI 模块，负责渲染和用户交互
- 通过 WebSocket 与后端通信
- 使用共享基础设施（EventBus / Logger / WSClient）

### 后端
1. **WebSocket 转发器**: 仅收发转发消息
2. **HTTP 文件服务器**: 仅负责文件传输
3. **PDF 业务服务器**: 独立运行，执行 PDF 相关业务逻辑

---

## 最近完成的功能（2025-10）

1. **Toast 通知系统**: 集成 iziToast 第三方库，统一右上角堆叠提示
2. **日志治理**: 实现限流、折叠、采样等高级日志管理功能
3. **搜索功能**: PDF-Home 搜索端到端方案，支持多条件搜索
4. **PyQt 桥接**: 完善 QWebChannel 桥接，支持前后端通信
5. **书签持久化**: WebSocket 书签持久化功能完成
6. **数据库 Phase3**: 四大插件（PDFInfo、PDFBookmark、PDFAnnotation、SearchCondition）完成

---

## Worktree 状态

- **Worktree A** (`feature-bookmark-fix`): 书签修复相关
- **Worktree B** (`feature/pdf-home-add-delete-improvements`): 已合并到 main
- **Worktree C** (`feature-pdf-processing`): 已合并到 main
- **Worktree D** (`d-main-20250927`): 主线开发分支

---

## 关键技术决策

### Toast 方案（2025-10-07）
- 采用 iziToast 作为统一 Toast 方案
- 废弃原有 DOM 元素方式
- 位置：右上角堆叠提示

### 日志策略（2025-10-07）
- 统一关闭发布/订阅日志
- 高频事件采样输出（10%）
- 生产环境默认 WARN 级别

### 并行开发（2025-10-07）
- 采用 Schema-first 策略
- 前后端基于契约并行开发
- 所有消息符合 JSON Schema

---

## 参考文档

- **架构文档**: `src/frontend/ARCHITECTURE-EXPLAINED.md`
- **Feature 开发**: `src/frontend/HOW-TO-ADD-FEATURE.md`
- **EventBus 使用**: `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md`
- **技术变更**: `.kilocode/rules/memory-bank/tech.md`
- **架构变更**: `.kilocode/rules/memory-bank/architecture.md`
