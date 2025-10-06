# Memory Bank（精简版 / 权威）

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
## 2025-10-07 Git 同步 - 合并 origin/main 到当前分支
- 仓库: C:\Users\napretep\PycharmProjects\anki-linkmaster-B
- 背景: 保持当前开发分支与远程 main 同步，避免后续提交产生大跨度差异，降低冲突风险。
- 相关工具: git（fetch/merge/stash）、本地验证命令。

### 执行步骤（原子化）
1. 获取远程与当前分支信息：`git remote -v`、`git rev-parse --abbrev-ref HEAD`。
2. 拉取远程：`git fetch origin --prune`，确认 `origin/main` 存在。
3. 若工作区存在未提交改动，先 `git stash push -u -m "auto-stash: merge origin/main"`。
4. 合并远程主线：`git merge --no-edit origin/main`。
5. 若曾 stash，执行 `git stash pop` 并按需处理冲突。
6. 验证结果：`git merge-base --is-ancestor origin/main HEAD` 返回 0 视为成功。

### 预期结果
- 当前分支包含 `origin/main` 的最新提交；若存在冲突，已在工作区标记等待人工处理。

### 实际结果（2025-10-07 01:58）
- 合并方式为 Fast-forward，已成功将 `origin/main` 合并至 `feature/pdf-home-add-delete-improvements`。
- 存在本地改动（context.md），已自动 stash 并在合并后 pop 恢复。
- 验证通过：`git merge-base --is-ancestor origin/main HEAD` => 0（OK）。
- 未产生冲突，当前工作区保留对 context.md 的修改，待按需提交。

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

#### 🔧 日志治理（新增能力）
- 全局/模块级级别覆盖：`setGlobalLogLevel(level)`、`setModuleLogLevel(module, level)`；优先级：模块级 > 全局级 > 实例级
- 限流：按“模块+级别”固定窗口限流（默认 120 条/秒），超额将被抑制并在窗口滚动时输出一次汇总
- 重复折叠：相同消息在 `dedupWindowMs`（默认 500ms）内仅首条输出，其余折叠；遇到不同消息时输出一次折叠汇总
- 事件采样与裁剪：`logger.event()` 支持采样（默认 100%/生产20%）与 JSON 文本长度上限（默认 800 字符）
- 生产默认：`WARN` 级别、关闭 JSON pretty、事件采样 20%

高频日志候选关闭（依据 20251007 分析）
- 订阅日志：`Event [xxx]: 订阅 { ... }`（event-bus.js:487）→ 默认关闭，仅排障时打开（DEBUG）
- 发布日志：`Event [xxx]: 发布 { ... }`（event-bus.js:637）→ 默认关闭或仅输出事件名
- 无订阅者提示：`... - 无订阅者`（event-bus.js:705）→ 默认关闭/降级 DEBUG
- WebSocket 杂项：`websocket:message:unknown` 等 → 加入 SUPPRESSED_EVENT_LOGS 白名单
- 高频状态变更：`pdf-viewer:page:changing`、`...:bookmark-select:changed` → 降级 DEBUG 或采样
- 未注册全局事件错误：`search:query:requested` → 保留但限频 + 尽快修复调用点

用户确认后的最终策略（已实施）
- 统一关闭发布/订阅日志：不再输出 `Event [xxx]: 订阅/发布 {...}`
- 保留 `websocket:message:unknown` 发布日志（用于诊断未知WS消息）
- `pdf-viewer:page:changing` 与 `pdf-viewer:bookmark-select:changed` 的发布日志做 10% 采样
- Feature.annotation 与 PDFViewerManager 初始化细节降为 DEBUG，仅保留关键结论为 INFO
- `'search:query:requested'` 未注册全局事件错误：维持现有策略（保留错误，提示修复）

运行时配置（localStorage，可热更新）
- `LOG_LEVEL`: `debug|info|warn|error`
- `LOG_EVENT_SAMPLE_RATE`: `0~1` 浮点数，例如 `0.2`
- `LOG_RATE_LIMIT`: 形如 `100,1000`（每窗口允许条数, 窗口毫秒）
- `LOG_DEDUP_WINDOW_MS`: 重复折叠窗口，毫秒（整数）
- `LOG_EVENT_MAX_JSON`: 事件 JSON 最大长度，字符数
- `LOG_EVENT_PRETTY`: `true|false` 是否美化缩进

编程配置（API）
```js
import { configureLogger, setGlobalLogLevel, setModuleLogLevel, LogLevel } from '../common/utils/logger.js';

configureLogger({
  globalLevel: LogLevel.INFO,
  rateLimit: { messages: 60, intervalMs: 1000 },
  dedupWindowMs: 300,
  event: { sampleRate: 0.5, maxJsonLength: 600, pretty: false },
});

setModuleLogLevel('Feature.annotation', LogLevel.WARN);
```

最小验证脚本
- `node AItemp/tests/logger-govern.mjs`（Node ESM）
- 断言限流/折叠/采样生效并通过

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

# 查看运行日志
python ai_launcher.py logs

# 停止所有服务
python ai_launcher.py stop
```

**为什么必须使用 ai_launcher.py**:
1. 自动管理多个服务的启动顺序（Vite、WebSocket、HTTP服务器）
2. 自动检测端口冲突，避免启动失败
3. 后台运行，不阻塞终端，支持 AI 自动化开发
4. 统一日志管理，所有服务日志集中输出
5. 一键停止所有服务，避免遗留进程

---

### 3️⃣ EventBus 事件命名规范（严格遵守）

**格式**: `{module}:{action}:{status}` （必须正好3段，用冒号分隔）

**✅ 正确示例**:
```javascript
'pdf:load:completed'          // PDF加载完成
'bookmark:create:requested'   // 请求创建书签
'sidebar:open:success'        // 侧边栏打开成功
'annotation:delete:failed'    // 删除批注失败
```

**❌ 错误示例（绝对禁止）**:
```javascript
'loadData'                    // ❌ 缺少冒号
'pdf:list:data:loaded'        // ❌ 超过3段
'pdf_list_updated'            // ❌ 使用下划线
'onButtonClick'               // ❌ 驼峰命名
'pdf:loaded'                  // ❌ 只有2段
```

**规则**:
- module: 模块名称（小写，用连字符，如 `pdf-list`, `pdf-viewer`）
- action: 动作名称（小写，用连字符，如 `load`, `toggle`, `refresh`）
- status: 状态（`requested`/`completed`/`failed`/`success`/`error` 等）

**⚠️ 不符合格式会导致 EventBus 验证失败，代码无法运行！**

---

### 4️⃣ 局部事件 vs 全局事件（严格区分）

#### 🔹 局部事件（Feature内部通信）
**使用方法**: `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`
- 仅在同一Feature内传递
- 其他Feature **无法**监听

```javascript
// ✅ 正确：Feature内部事件
class MyFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 发布局部事件
    scopedEventBus.emit('data:load:completed', data);
    // 实际事件名: @my-feature/data:load:completed

    // 监听局部事件
    scopedEventBus.on('ui:refresh:requested', (data) => {
      this.#refreshUI(data);
    });
  }
}
```

#### 🌐 全局事件（Feature间跨模块通信）
**使用方法**: `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀
- 所有Feature都可以监听
- 用于跨模块通信

```javascript
// ✅ 正确：跨Feature通信
class BookmarkFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 发布全局事件（其他Feature可监听）
    scopedEventBus.emitGlobal('pdf:bookmark:created', bookmark);

    // 监听全局事件（来自其他Feature）
    scopedEventBus.onGlobal('pdf:file:loaded', (data) => {
      this.#loadBookmarks(data);
    });
  }
}
```

**❌ 常见错误**:
```javascript
// ❌ 错误：混用局部和全局
scopedEventBus.emit('pdf:file:loaded', data);  // 应该用 emitGlobal
scopedEventBus.on('pdf:file:loaded', handler);  // 应该用 onGlobal

// ❌ 错误：监听全局事件时使用了带命名空间的名称
scopedEventBus.onGlobal('@my-feature/data:loaded', handler);  // 不需要命名空间
```

---

### 5️⃣ Feature 开发标准流程（严格遵守）

**📖 完整文档**: `src/frontend/HOW-TO-ADD-FEATURE.md`

**第一步：创建Feature类结构**
```javascript
export class MyFeature {
  // 私有字段（使用 # 前缀）
  #eventBus;
  #container;
  #logger;

  /** 功能名称 - 必须实现 */
  get name() {
    return 'my-feature';  // kebab-case，小写+连字符
  }

  /** 版本号 - 必须实现 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的功能 - 必须实现 */
  get dependencies() {
    return ['app-core'];  // 声明依赖的其他Feature
  }

  /** 安装功能 - 必须实现 */
  async install(context) {
    const { globalEventBus, scopedEventBus, logger, container } = context;

    this.#eventBus = scopedEventBus;  // 优先使用 scopedEventBus
    this.#container = container;
    this.#logger = logger;

    // 初始化逻辑...
    logger.info(`${this.name} installed successfully`);
  }

  /** 卸载功能 - 必须实现 */
  async uninstall(context) {
    // 清理资源...
    this.#logger.info(`${this.name} uninstalled`);
  }
}

---

## 当前任务（20251007013000）

- 名称：执行 Git 提交（必要时推送）
- 背景：工作区存在多项改动（含新增脚本、配置与前端修复），需要一次性提交固化。
- 原子步骤：
  1) 获取最近 8 条 AI 工作日志，理解历史（已完成）
  2) 记录本次任务工作日志 `AItemp/20251007013000-AI-Working-log.md`
  3) 检查/读取本文件（context.md）并补充当前任务段落（即本段）
  4) 执行 `git add -A` 与 `git commit -m "chore(repo): sync changes, logs, memory-bank"`
  5) 识别远程与上游，若存在则 `git push`（可选，若失败不阻塞）
  6) 将执行结果回写至本任务工作日志与 memory-bank
  7) 调用 `notify-tts` 播报完成

### 期望结果
- 提交完成且工作区干净；若可推送则已推送至上游。

### 执行结果（20251007013000）
- 已提交：6970ba1d7c2355d52b5dae8b8e121b3820351f15（main）
- 推送：origin/main 成功
- 状态：工作区干净

```

**第二步：在Bootstrap中注册**
```javascript
// 文件: bootstrap/app-bootstrap-feature.js
import { MyFeature } from '../features/my-feature/index.js';

// 注册Feature
registry.register(new MyFeature());
```

**第三步：声明依赖关系**
```javascript
// ✅ 正确：在dependencies中声明
get dependencies() {
  return ['pdf-manager', 'annotation'];  // 依赖这两个Feature
}

// ❌ 错误：直接import其他Feature
import { PDFManagerFeature } from '../pdf-manager/index.js';  // 禁止！
```

---

### 6️⃣ 依赖注入规范（禁止硬编码）

**✅ 正确方式：通过Container获取依赖**
```javascript
class MyFeature {
  async install(context) {
    const { container } = context;

    // 从容器获取依赖
    const pdfManager = container.get('pdfManager');
    const navigationService = container.get('navigationService');

    if (!pdfManager) {
      this.#logger.warn('PDFManager not found');
      return;
    }
  }
}
```

**❌ 错误方式：硬编码依赖**
```javascript
// ❌ 禁止：直接import其他Feature
import { PDFManager } from '../pdf-manager/pdf-manager.js';

// ❌ 禁止：访问全局变量
const manager = window.pdfManager;

// ❌ 禁止：直接new实例
const service = new NavigationService();
```

---

### 7️⃣ 功能域模块化架构

**架构定义**: pdf-home和pdf-viewer采用统一的功能域模块化架构，每个功能作为独立可插拔模块。

**📖 深度解析**: `src/frontend/ARCHITECTURE-EXPLAINED.md`

**核心开发原则**:
1. **功能域隔离**
   - 每个Feature必须是独立目录 (`features/功能名/`)
   - Feature内部结构: `index.js`(入口) + `components/` + `services/` + `events.js`

2. **事件驱动通信**
   - Feature之间只能通过EventBus通信，禁止直接引用
   - 所有事件定义集中在 `common/event/constants.js`

3. **依赖注入**
   - Feature依赖必须通过DependencyContainer注入
   - 在`feature.config.js`声明依赖
   - 禁止直接import其他Feature的代码

**严格禁止**:
- ❌ Feature之间直接调用函数或访问属性
- ❌ 在Feature内部创建全局变量
- ❌ 硬编码依赖其他Feature的路径
- ❌ 绕过EventBus直接操作DOM或状态
- ❌ 复制粘贴代码，应提取到common/或创建新Feature

---

### 8️⃣ 契约编程实践指导（必读）

#### 什么是契约编程？

项目采用**三层契约体系**确保前后端、模块间的强类型通信：

```
Layer 1: 前端内部契约 (EventBus 三段式)
    ↓
Layer 2: 前后端通信契约 (StandardMessageHandler)
    ↓
Layer 3: 能力注册契约 (Capability Registry + JSON Schema)
```

#### Layer 1: 前端事件契约

**强制规则：**
- 所有事件名称必须符合 `{module}:{action}:{status}` 格式
- 违反契约的事件会被 **运行时阻止发布**
- EventBus 会显示详细错误提示和修复建议

**正确示例：**
```javascript
✅ 'pdf:load:completed'
✅ 'bookmark:create:requested'
✅ 'sidebar:open:success'
```

**错误示例（会被拦截）：**
```javascript
❌ 'loadData'                    // 缺少冒号
❌ 'pdf:list:data:loaded'        // 超过3段
❌ 'pdf_list_updated'            // 使用下划线
❌ 'onButtonClick'               // 驼峰命名
```

#### Layer 2: 前后端消息契约

**请求消息必须包含：**
```javascript
{
  "type": "pdf-library:list:requested",  // 三段式
  "request_id": "uuid-v4",               // 唯一标识
  "timestamp": 1696300800000,            // 毫秒时间戳
  "data": { /* 业务数据 */ }
}
```

**响应消息必须包含：**
```javascript
{
  "type": "response",
  "request_id": "对应的请求ID",
  "status": "success|error",
  "code": 200,
  "message": "操作结果描述",
  "data": { /* 返回数据 */ }
}
```

**消息类型定义：**
- 位置：`src/backend/msgCenter_server/standard_protocol.py`
- 所有消息类型必须在 `MessageType` 枚举中定义
- 未定义的消息类型会被服务器拒绝

#### Layer 3: 能力注册契约

**能力发现流程：**
```javascript
// 1. 前端请求能力列表
{
  "type": "capability:discover:requested",
  "data": { "pattern": "pdf-library.*" }
}

// 2. 后端返回能力清单
{
  "capabilities": [
    {
      "name": "pdf-library:list:records",
      "version": "1.0.0",
      "schema_path": "schemas/pdf-library/list-v1.json",
      "schema_hash": "sha256:abc123..."
    }
  ]
}
```

**Schema 验证：**
- 所有消息必须符合对应的 JSON Schema
- Schema 使用 SHA256 哈希防篡改
- 版本变更遵循语义化版本号（major.minor.patch）

#### 契约验证检查点

开发时每条消息会经过 **5 个验证检查点**：

1. **前端发送前**：EventBus 验证事件名格式（三段式）
2. **消息中心接收后**：验证 type/request_id/timestamp 必需字段
3. **后端处理前**：检查 MessageType 枚举、业务数据完整性
4. **后端响应前**：构建标准响应格式（status/code/message）
5. **前端接收后**：验证响应类型和数据完整性

任何一个检查点失败，消息都会被拒绝并记录错误日志。

#### 开发新功能时的契约清单

**前端开发：**
```javascript
// ✅ 1. 使用三段式事件名
scopedEventBus.emit('data:load:requested', payload);

// ✅ 2. 监听全局事件时使用正确方法
scopedEventBus.onGlobal('pdf:file:loaded', handler);

// ✅ 3. 发送 WebSocket 消息时包含必需字段
wsClient.send({
  type: 'pdf-library:list:requested',
  request_id: generateId(),
  timestamp: Date.now(),
  data: {}
});
```

**后端开发：**
```python
# ✅ 1. 在 MessageType 枚举中定义新消息类型
class MessageType(Enum):
    MY_NEW_FEATURE_REQUESTED = "my-feature:action:requested"
    MY_NEW_FEATURE_COMPLETED = "my-feature:action:completed"

# ✅ 2. 使用标准响应构建器
return StandardMessageHandler.build_response(
    "response",
    request_id,
    status="success",
    code=200,
    message="操作成功",
    data={"result": "数据"}
)

# ✅ 3. 错误时返回标准错误响应
return StandardMessageHandler.build_error_response(
    request_id,
    "ERROR_TYPE",
    "详细错误描述",
    code=400
)
```

#### 契约违规示例与修复

**❌ 违规示例 1：事件名不符合三段式**
```javascript
// 错误
eventBus.emit('loadData', data);

// 修复
eventBus.emit('data:load:completed', data);
```

**❌ 违规示例 2：缺少必需字段**
```javascript
// 错误
wsClient.send({ type: 'pdf-library:list:requested' });

// 修复
wsClient.send({
  type: 'pdf-library:list:requested',
  request_id: generateId(),
  timestamp: Date.now(),
  data: {}
});
```

**❌ 违规示例 3：使用未定义的消息类型**
```javascript
// 错误
wsClient.send({ type: 'get_pdf_list', ... });

// 修复：先在 standard_protocol.py 中定义枚举
// MessageType.PDF_LIBRARY_LIST_REQUESTED = "pdf-library:list:requested"
wsClient.send({ type: 'pdf-library:list:requested', ... });
```

#### 契约调试技巧

**前端调试：**
```javascript
// 查看 EventBus 验证错误
// 控制台会显示详细的错误提示和修复建议

// 查看 WebSocket 消息
wsClient.getDebugInfo();  // 获取连接信息
wsClient.getConnectionHistory();  // 查看连接历史
```

**后端调试：**
```python
# 查看日志文件
# logs/ws-server.log

# 使用 request_id 追踪完整流程
[前端] req_abc123 发送消息: pdf-library:list:requested
    ↓
[后端] req_abc123 接收到消息
    ↓
[后端] req_abc123 处理完成，返回响应
    ↓
[前端] req_abc123 收到响应
```

#### 契约文档索引

**📋 核心规范：**
- `src/frontend/CLAUDE.md:62-310` - 前端开发核心规范（EventBus 三段式、Feature 架构、依赖注入）
- `src/frontend/pdf-home/docs/Communication-Protocol-Guide.md` - 完整通信协议（600+ 行详细说明）
- `src/backend/msgCenter_server/standard_protocol.py:14-136` - MessageType 枚举（100+ 消息类型定义）
- `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/v001-spec.md` - 能力注册中心完整规范

**🔧 契约执行核心文件：**

*前端验证器：*
- `src/frontend/common/event/event-bus.js:13-131` - EventNameValidator（三段式验证、错误提示生成）
- `src/frontend/common/event/scoped-event-bus.js:1-200` - ScopedEventBus（命名空间管理、局部/全局事件）
- `src/frontend/common/ws/ws-client.js:1-500` - WSClient（消息发送验证、request_id 管理）

*后端验证器：*
- `src/backend/msgCenter_server/standard_protocol.py:146-180` - validate_message_structure（消息结构验证）
- `src/backend/msgCenter_server/standard_server.py:100-150` - handle_message（消息类型路由与验证）
- `src/backend/api/service_registry.py:1-100` - ServiceRegistry（能力注册与查询）

**📦 JSON Schema 契约定义：**
```
todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/
├── capability/
│   ├── discover-v1.json          # 能力发现协议
│   └── describe-v1.json          # 能力描述协议
├── pdf-library/
│   ├── list-v1.json              # PDF 列表查询
│   ├── add-v1.json               # PDF 文件添加
│   ├── remove-v1.json            # PDF 文件删除
│   ├── info-v1.json              # PDF 详情获取
│   └── config-v1.json            # PDF 配置管理
├── bookmark/
│   ├── list-v1.json              # 书签列表查询
│   └── save-v1.json              # 书签保存
├── storage-kv/
│   ├── get-v1.json               # KV 读取
│   ├── set-v1.json               # KV 写入
│   └── delete-v1.json            # KV 删除
└── storage-fs/
    ├── read-v1.json              # 文件读取
    └── write-v1.json             # 文件写入
```

**🧪 测试示例：**

*前端契约测试：*
- `src/frontend/common/event/__tests__/event-bus.test.js` - EventBus 核心功能（50+ 用例）
- `src/frontend/common/event/__tests__/event-name-validation.test.js` - 事件名称验证（错误提示、修复建议）
- `src/frontend/common/event/__tests__/scoped-event-bus.test.js` - 作用域事件总线（命名空间隔离）

*后端契约测试：*
- `src/backend/msgCenter_server/__tests__/test_standard_server_messages.py` - 标准消息处理（文件入库、删除、查询）
- `src/backend/msgCenter_server/__tests__/test_standard_server_bookmarks.py` - 书签消息处理（三段式命名验证）
- `src/backend/msgCenter_server/__tests__/test_capability_registry.py` - 能力注册中心（discover/describe）
- `src/backend/msgCenter_server/__tests__/test_storage_kv_and_fs.py` - 存储服务（KV/FS 完整链路）

*集成测试：*
- `src/backend/api/__tests__/test_bookmark_persistence.py` - 书签持久化闭环（前端→WS→API→DB→响应）
- `src/backend/database/plugins/__tests__/test_pdf_info_plugin_search_records.py` - 搜索功能端到端

**📊 契约统计数据：**
- 前端事件验证器：1 个核心类（EventNameValidator）
- 后端消息类型：100+ 枚举值（MessageType）
- JSON Schema：11 个协议文件（v1 版本）
- 测试覆盖：300+ 用例（前端 + 后端 + 集成）
- 验证检查点：5 个（发送前、接收后、处理前、响应前、接收后）

### 9️⃣ 重要参考文档

1. **添加新Feature** → `src/frontend/HOW-TO-ADD-FEATURE.md`
2. **EventBus完整指南** → `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md`
3. **架构深度解析** → `src/frontend/ARCHITECTURE-EXPLAINED.md`
4. **事件追踪调试** → `src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md`
5. **通信协议指南** → `src/frontend/pdf-home/docs/Communication-Protocol-Guide.md`
6. **契约架构详解** → `.kilocode/rules/memory-bank/architecture.md` (契约编程三层体系)

## 模块职责
- pdf-home：列表/选择/动作的 UI；QWebChannel 前端侧管理；前端日志 → `logs/pdf-home-js.log`。
- pdf-viewer：渲染与控件 UI；按 pdf_id 输出日志 → `logs/pdf-viewer-<pdf-id>-js.log`；✅ **已完成重构 (2025-09-26)**。
- WebSocket 转发器：`src/backend/websocket/standard_server.py`（headless，仅路由）。
- HTTP 文件服务器：`src/backend/http_server.py`（仅文件传输，支持 Range，UTF-8 日志）。
- PDF 业务服务器（待实现）：`src/backend/services/pdf_business_server.py`（建议路径）。
- AI Launcher：`ai-scripts/ai_launcher/*`（ServiceManager / ProcessManager / CLI / 示例服务）。

## 现状快照（最近更新）
### 已完成（近期）
- ✅ **PDF中文渲染修复** (2025-09-30): 使用Vite别名@pdfjs简化CMap和标准字体路径。
- ✅ **PDF-Home添加/删除功能** (2025-10-01): 完整文件管理流程。参考提交: bf8b64d。
- ✅ **PDF-Viewer搜索按钮修复** (2025-10-03): 修复Feature架构缺陷，实现依赖注入。
- ✅ **侧边栏统一管理** (2025-10-04): SidebarManagerFeature + 流动布局 + 宽度拖拽。
- ✅ **插件隔离架构改进** (2025-10-04): EventBus规范、依赖注入完善。文档: EVENTBUS-USAGE-GUIDE.md。
- ✅ **数据库 Phase3** (2025-10-05): 四大插件完成（PDFInfo/Annotation/Bookmark/SearchCondition）。144个测试通过。
- ✅ **高亮标注交互增强** (2025-10-05): 悬停工具栏（删除/复制/换色/跳转/翻译）。
- ✅ **文本选择快捷操作** (2025-10-05): 非标注模式下四按钮（复制/标注/翻译/AI）。

### 待办（优先级）
- [ ] 实现最小版 PDF 业务服务器并接入 WS 转发。
- [ ] 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
- [ ] 为 Launcher 增加健康检查与 E2E 脚本。
- [ ] **PDF-Home 搜索端到端实施** (进行中，见下方)。

## 已知问题
### PDF列表双重更新 (2025-09-28)
- **描述**: `pdf:list:updated` 事件被触发两次。
- **根因**: PDFManager 的 `handleResponseMessage` 在处理响应时，如果包含 files 数组但没有 batch_id，会再次请求列表。
- **修复**: 在 `websocket-handler.js:215` 排除 `get_pdf_list` 类型响应。
- **验证**: 日志分析脚本 `AItemp/tests/analyze-get-pdf-list.ps1`。

---

## 2025-10-05 数据库 Phase3 - 四大插件 ✅ 完成
### 已完成插件
1. **PDFInfoTablePlugin** - PDF基础信息（标题/作者/标签/评分/统计）
2. **PDFAnnotationTablePlugin** - 标注管理（截图/高亮/批注/评论）
3. **PDFBookmarkTablePlugin** - 书签管理（层级/排序/递归/级联删除）
4. **SearchConditionTablePlugin** - 搜索条件（fuzzy/field/composite/排序配置）

### 测试覆盖
- 144 个单元测试全部通过
- 核心文件: `src/backend/database/plugins/`、`src/backend/database/plugins/__tests__/`
- 需求文档: `todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-*.md`

---

## 2025-10-05 PDF-Home 搜索端到端方案（进行中）
### 任务目标
前后端协同实现完整的搜索→筛选→排序→分页流程，替代现有浏览器内前端筛选。

### 现状评估
- ✅ PDFLibraryAPI 已有基础 CRUD
- ✅ 数据库插件层完成（pdf_info/search_condition）
- ❌ 缺少 `search_records` 接口（LIKE + 权重 + 筛选 + 排序 + 分页）
- ❌ WebSocket 路由未接入新搜索API
- ❌ 前端搜索未统一到 SearchService

### 拆分任务（6个并行规格）
1. **后端 LIKE SQL 搜索** (20251005195000) - PDFLibraryAPI.search_records + CTE查询 + 权重排序
2. **WebSocket 搜索路由** (20251005195100) - StandardWebSocketServer 接入新API
3. **前端 SearchService 重构** (20251005195200) - 统一请求入口 + payload 组装
4. **搜索结果分页 UI** (20251005195300) - 分页控件 + 页码/总数显示
5. **筛选条件序列化** (20251005195400) - Filter → SQL WHERE 子句
6. **测试与 QA 覆盖** (20251005195500) - 数据库/WebSocket/前端三层测试

### 技术决策
- 首版采用 **LIKE + 多 token + CASE 权重方案**（预留 FTS5 升级路径）
- 字段权重: title(10) > author(5) > keywords(3) > notes(2) > subject(1)
- 分页参数: `page`、`page_size`（默认 50）
- 返回结构: `{ records, total, page: { current, size, total_pages }, meta }`

### 进展
- ✅ 2025-10-05 21:00: 开始实施第一层 LIKE 搜索任务
- ✅ 排序面板修复: 改用全局事件 `search:sort:clicked` 触发，避免 DOM 绑定失败

### 关键文件
- 后端: `src/backend/api/pdf_library_api.py`、`src/backend/msgCenter_server/standard_server.py`
- 前端: `src/frontend/pdf-home/features/search/`、`src/frontend/pdf-home/features/filter/`
- 规格: `todo-and-doing/2 todo/20251005195xxx-*/`

---

## 2025-10-05 标注系统优化
### 高亮标注悬停工具栏 ✅ 完成
- **功能**: hover 高亮显示工具栏（删除/复制/换色/跳转/翻译）
- **实现**: HighlightActionMenu + HighlightRenderer 包围盒 + 颜色更新接口
- **测试**: highlight-action-menu.test.js + text-highlight-tool.test.js

### 文本选择快捷操作 ✅ 完成
- **功能**: 非标注模式下监听文本选择，弹出四按钮（复制/标注/翻译/AI）
- **实现**: TextSelectionQuickActionsFeature + selection-utils + quick-actions-toolbar
- **修复**: 复制后清空选择，避免工具栏重复定位

### Annotation 事件治理 ✅ 完成
- **问题**: 事件命名不规范、数据契约不一致、缺少常量定义
- **改进**:
  1. ScopedEventBus 替代 globalEventBus，区分局部/全局事件
  2. PDF_VIEWER_EVENTS 补充导航/侧边栏/通知常量
  3. 所有工具统一使用事件常量（删除 `id` 参数、跳转使用导航常量）
  4. 测试同步更新

### 标注UI表情优化（进行中）
- **需求**: 侧边栏工具按钮、卡片按钮使用 Unicode 表情
- **范围**: annotation-sidebar-ui、tools/、text-selection-quick-actions
- **注意**: 保留 tooltip 文字说明

---

## Worktree 状态（2025-10-06）
### Worktree A (feature-bookmark-fix) - 📚 书签API
- **功能**: `list_bookmarks()` + `save_bookmarks()` 完整实现
- **测试**: roundtrip + 树形结构 + region 完整性 ✅
- **状态**: 90% 完成，待提交

### Worktree B (feature/pdf-home-add-delete-improvements) - 🔍 搜索API
- **功能**: `search_records(payload)` 高级搜索（LIKE + 筛选 + 排序 + 分页）
- **测试**: 完整测试套件 9ac3385 ✅
- **状态**: 95% 完成，已合并到 main

### Worktree D (d-main-20250927) - ⚡ 数据库优化
- **功能**: 5个 LOWER() 索引（title/author/notes/keywords/subject）
- **性能**: 搜索提升 50-200%
- **状态**: 100% 完成，已合并到 main

---

## 历史任务归档
2025-09-27 到 2025-10-04 的已完成任务已移至 `context-archive-20251006.md`，包括：
- AI重复开发问题分析
- PDF.js 性能优化研究
- PDF-Viewer 模块拆分方案
- 日志系统清理
- QWebChannel 初始化分析
- pdf-viewer 架构重构 v002
- PDF 记录编辑功能
- 标注功能模块化（Phase 0-1）
- CommentTool Bug 修复系列

查看历史详情请参考归档文件。

---

## 2025-10-06 PDF书签WebSocket持久化 ✅ 完成

### 功能概述
实现PDF书签的远程持久化存储，前端书签通过WebSocket同步到后端数据库。

### 后端实现
- **PDFLibraryAPI 新增接口**:
  - `list_bookmarks(pdf_uuid)` - 查询书签并构建树形结构
  - `save_bookmarks(pdf_uuid, bookmarks, root_ids)` - 保存书签（支持覆盖）
  - 支持递归校验、排序、region 数据

- **WebSocket 服务器路由**:
  - `bookmark/list` - 列出书签
  - `bookmark/save` - 保存书签
  - 返回 `{bookmarks, root_ids}` / `{saved}` 数据结构

### 前端实现
- **BookmarkStorage 重构**:
  - 新增 `RemoteBookmarkStorage` 通过 WebSocket 持久化
  - `LocalStorageBookmarkStorage` 降级为缓存层
  - BookmarkManager 支持注入 `wsClient`

- **WSClient 增强**:
  - 新增 `request()` 方法统一请求/响应链路
  - `_settlePendingRequest` 处理异步响应

### 测试覆盖
- ✅ 119 个后端 API 测试
- ✅ 81 个 WebSocket 服务器测试
- ✅ 80 个前端存储测试

### 技术亮点
- 树形结构扁平化算法
- region 百分比坐标支持
- 事件驱动的前后端同步
- 完整的错误处理和边界情况覆盖

### 修改文件
13 个文件 (+1017, -101)

### 相关文档
- 详细工作日志: `AItemp/20251003181547-AI-Working-log.md`
- 页面跳转修复: `AItemp/20251003180103-AI-Working-log.md`
- 数据结构修复: `AItemp/20251003174421-AI-Working-log.md`

---

## 2025-10-05 数据库 Phase3（PDFInfo 表插件）
- ⏳ 阶段目标：完成数据库Phase3的首个数据表插件（PDFInfoTablePlugin），确保插件测试通过后继续实现文档中剩余功能。
- 当前状态：插件代码和测试已由上一轮开发完成但尚未复核，需要重新运行 `pytest src/backend/database/plugins/__tests__/test_pdf_info_plugin.py` 确认绿色。
- 关键路径：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-info.md`（包含字段约束、扩展方法、测试用例清单）。
  - 代码位置：`src/backend/database/plugins/pdf_info_plugin.py`（主实现）、`src/backend/database/plugins/__tests__/test_pdf_info_plugin.py`（单测）、`src/backend/database/plugins/__tests__/fixtures/pdf_info_samples.py`（样例数据，如存在）。
- 执行步骤（原子任务）：
  1. 阅读需求规范与现有实现，确认接口、事件、扩展查询覆盖的契合度。
  2. 运行上述pytest命令验证插件行为，若失败收集日志与失败案例。
  3. 根据需求文档补足缺失的功能/测试（例如高级查询、标签管理、统计等）。
  4. 测试全部通过后更新工作日志与memory bank，并准备继续Phase3后续（annotation/bookmark/search_condition）。
- 注意事项：所有文件读写显式UTF-8；遵循TablePlugin接口规范；开发前先补齐测试；如拆分多模块需考虑subagent。
## 当前任务 (2025-10-05 15:55)
- 合并 worktree A(feature-bookmark-fix) 与 worktree D(d-main-20250927) 到 main 分支
- 目标：同步侧边栏与 d-main 分支最新改动，保持主线最新
- 预计步骤：检查 git 状态 → 拉取两个分支最新提交 → 合并并解决冲突 → 基本验证
- 相关路径：worktree A=C:/Users/napretep/PycharmProjects/anki-linkmaster-A，worktree D=C:/Users/napretep/PycharmProjects/anki-linkmaster-D
### 2025-10-05 16:05 更新
- main 分支已合并 feature-bookmark-fix（f378ef4）与 d-main-20250927（399d04a），获取了 UI 布局优化与 PDF 卡片侧栏骨架
- d-main-20250927 新增 PDFCardFeature（卡片侧栏UI、feature.config、Sidebar注册时从容器延迟获取实例）已同步到主线
- 合并后保留反向链接侧栏占位（real-sidebars.js）及既有文档改动，需要后续功能实现时替换
- pnpm run test 受 WebGL/IndexedDB 依赖缺失影响失败（fake-indexeddb、canvas 未安装），后续定位前需补齐测试依赖


## 2025-10-05 数据库 Phase3（PDFAnnotation 表插件）
- ✅ 阶段目标：PDFAnnotationTablePlugin 已完成，支持截图 / 文本高亮 / 批注三类标注的建表、数据校验、CRUD、扩展查询、评论管理与事件发布。
- 当前状态：代码与测试位于 `src/backend/database/plugins/`；与 PDFInfo 插件联动（外键/事件）已验证通过。
- 关键资料：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-annotation.md`
  - 代码：`src/backend/database/plugins/pdf_annotation_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_annotation_samples.py`
- 主要实现要点：
  1. 数据验证区分 screenshot/text-highlight/comment 三类 payload，并校验 comments 数组。
  2. CRUD 及扩展方法（按 PDF/页码/类型查询、计数、批量删除、评论增删）。
  3. 事件统一使用 `table:pdf-annotation:*:*`，启用时订阅 `table:pdf-info:delete:completed` 实现级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` 共 76 项全部通过（含 pdf_info + pdf_annotation）。
- 后续衔接：继续 Phase3 其他表插件（bookmark / search_condition），复用同目录结构与事件命名规范。

## 2025-10-05 数据库 Phase3（PDFBookmark 表插件）
- ✅ 阶段目标：PDFBookmarkTablePlugin 已实现，支持层级书签、排序、递归扁平化与级联删除。
- 当前状态：`pdf_bookmark_plugin.py` 与测试、样例均落地，已通过插件测试全集（115 项）。
- 核心文件：
  - 代码：`src/backend/database/plugins/pdf_bookmark_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_bookmark_samples.py`
- 主要功能：
  1. 验证 `bookmark_id`、`pageNumber`、`region`、`children` 等字段，支持递归校验。
  2. CRUD + 扩展方法（按 PDF/页 查询、统计、批量删除、子节点增删、重排、扁平化）。
  3. 事件遵循 `table:pdf-bookmark:*:*`，监听 `table:pdf-info:delete:completed` 执行级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 115 Passed（含 info / annotation / bookmark 插件）。
- 后续衔接：Phase3 剩余表（search_condition）沿用相同目录与约定，注意事件命名和外键依赖。

## 2025-10-05 数据库 Phase3（SearchCondition 表插件）
- ✅ 阶段目标：SearchConditionTablePlugin 完成，实现筛选/排序条件的持久化、统计与事件发布。
- 当前状态：`search_condition_plugin.py`、测试与样例均落地，插件套件合计 144 用例全部通过。
- 核心文件：
  - 代码：`src/backend/database/plugins/search_condition_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_search_condition_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/search_condition_samples.py`
- 主要功能：
  1. 支持 fuzzy / field / composite 三类条件递归校验，包含 sort_config 模式 0-3 验证。
  2. 扩展方法：`query_by_name`、`query_enabled`、`increment_use_count`、`set_last_used`、`activate_exclusive`、`query_by_tag`、`search_by_keyword`。
  3. 事件命名 `table:search-condition:*:*`，便于前端监听保存/更新/删除行为。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 144 Passed（info/annotation/bookmark/search_condition 全部插件）。
- 后续衔接：Phase3 已完成四个插件，可进入集成或 Stage4；若新增条件类型需在 `_validate_condition` 扩展。
## 当前任务 (2025-10-05 17:51)
- 目标：梳理并理解现有前后端通信链路，在保持统一消息协议的前提下设计与实现供前端调用的后端 API 层。
- 背景：数据库插件层（pdf_info/pdfs_annotation/pdf_bookmark/search_condition）已完成，需要通过统一通信架构向前端暴露受控接口。
- 相关模块：src/backend/pdfTable_server、src/backend/msgCenter_server、src/backend/database/plugins/*、src/backend/api/*、src/frontend/common/ws、src/frontend/pdf-home。
- 重要文档：docs/SPEC/SPEC-HEAD-communication.json、docs/SPEC/JSON-MESSAGE-FORMAT-001.md、todo-and-doing/2 todo/20250923184000-unified-communication-architecture/v001-spec.md。
### 拆解步骤
1. 阅读并整理现有通信架构代码/文档，明确消息流、事件命名及现有 API 空缺。
2. 根据数据库能力列出前端所需 API 场景，完成接口设计草案（消息类型、payload、响应结构）。
3. 为 API 层编写测试（优先覆盖查询/创建/更新/删除流程及错误分支）。
4. 实现 API 层代码，衔接数据库插件和通信层，确保事件发布/日志符合规范。
5. 运行测试并排查，确保新增逻辑与现有系统协同无回归。
6. 更新文档、memory bank 及工作日志，准备后续前端联调。

### 进展 2025-10-05 19:05
- 已实现 `PDFLibraryAPI`（数据库 → 前端）封装，提供 list/detail/update/delete/register_file 接口，并新增单元测试 `src/backend/api/__tests__/test_pdf_library_api.py`。
- WebSocket 服务器接入新 API：支持 `pdf-library:list:records` 消息、文件增删事件同步数据库并广播新版记录结构。
- 新逻辑保持原有 `pdf-home:get:pdf-list` 兼容，新增广播时同时发送旧版 `list` 与新版 `pdf-library:list:records`。
## 2025-10-05 PDF-Home 搜索端到端方案讨论
- 问题背景：前端 Search/Filter 组合目前在浏览器内对 @pdf-list/data:load:completed 缓存做模糊筛选，后端仅有 StandardPDFManager 基于文件列表的简易 search_files；数据库层尚未提供分词、筛选、排序一体化查询，无法满足一次 SQL 完成“搜索→筛选→排序”的要求。
- 相关模块：前端 src/frontend/pdf-home/features/search、src/frontend/pdf-home/features/filter、src/frontend/pdf-home/features/search-results；后端 src/backend/api/pdf_library_api.py、src/backend/msgCenter_server/standard_server.py、src/backend/pdfTable_server/application_subcode/websocket_handlers.py；数据库插件 pdf_info_plugin.py、search_condition_plugin.py。
- 现状评估：
  1. PDFLibraryAPI 已负责 pdf_info 记录映射但缺少搜索接口；pdf_info 表文本字段可通过 json_extract 访问，已有若干普通索引。
  2. FilterManager 能将 uzzy/field/composite 条件序列化；WS 常量已定义 pdf-home:search:pdf-files 但仍由旧 StandardPDFManager.search_files 处理。
  3. 搜索词拆分仅在前端按空格进行，无法满足“按非文本符号分割”的需求；也未对标签、笔记等字段做权重控制。
- 待解决要点：
  1. 设计多 token 匹配 + 权重排名 + 过滤约束的 SQL（可用 CTE + LOWER(... LIKE ?)/json_each 或引入 FTS5）并返回 match_score。
  2. 将 Filter 条件 JSON 翻译为 SQL where 子句（支持 AND/OR/NOT、标签包含、数值区间、布尔字段）。
  3. 统一消息流：Search/Filter 通过 WSClient 发出 pdf-home:search:pdf-files，StandardWebSocketServer 调用 PDFLibraryAPI.search_records，返回标准化结果事件供 SearchResults 渲染。
  4. 补齐测试：数据库层搜索单测、WebSocket handler 集成测，前端 SearchService/Jest 覆盖 payload 组装与结果派发。
- 下一步：编写详细方案文档，确认字段权重 & 排序策略，定义分页/排序 schema，并规划数据同步触发 FTS/索引更新。
- 用户确认前端搜索结果需要分页控件；方案需明确分页UI与请求参数。

### 2025-10-05 PDF-Home 排序面板修复
- 问题：排序按钮点击后无任何响应，原因是 pdf-sorter 功能域在安装阶段直接查找 DOM #sort-btn 并绑定 click，实际按钮由 SearchFeature 渲染且安装顺序靠后，导致绑定失败。
- 方案：改为监听全局事件 search:sort:clicked 与 header:sort:clicked 触发排序面板；仅当全局事件不可用时才启用 DOM 兜底，避免重复 toggle。
- 关键文件：src/frontend/pdf-home/features/pdf-sorter/index.js、src/frontend/pdf-home/features/pdf-sorter/__tests__/sorter-panel-events.test.js。
- 测试：pnpm test -- sorter-panel-events（覆盖 search/header 事件驱动排序面板展示）。
- 影响：排序面板与配置区可通过现有事件体系正常打开，未改变其他功能域事件命名，前端排序交互对齐架构规范。
### 2025-10-05 搜索任务拆分
- 已创建 6 个并行规格文档（todo-and-doing/2 todo/20251005195xxx-*），覆盖：
  1. 后端 LIKE SQL 搜索实现 20251005195000-pdf-search-like-sql
  2. WebSocket 搜索消息路由 20251005195100-pdf-search-ws-routing
  3. 前端 SearchService 重构 20251005195200-pdf-search-frontend-service
  4. 搜索结果分页 UI 20251005195300-pdf-search-pagination-ui
  5. 筛选条件序列化 20251005195400-pdf-search-filter-serialization
  6. 测试与 QA 覆盖 20251005195500-pdf-search-testing
- 关键决策：首版采用 LIKE + 多 token + CASE 权重方案，预留未来 FTS5 升级路径；前端必须通过 SearchService 统一发起请求并支持分页控件。
- 2025-10-05 21:00: 开始实施第一层 LIKE 搜索任务：目标是实现 PDFLibraryAPI.search_records、对应 SQL CTE、测试覆盖。

---

## 2025-10-06 加权排序公式构建器 (恢复)
- 背景: 用户回滚导致 WeightedSortEditor 回退为 textarea 版本，需重新交付按钮式构建器。
- 交付点:
  - 重写 `weighted-sort-editor.js`，提供字段/运算符/函数/数字面板按钮、令牌列表、函数参数提示、字段校验(`hasFieldReference`)；所有交互纯鼠标即可完成。
  - 恢复样式块（builder-chip、formula-token、number-pad 等），保证视觉反馈与布局。
  - 扩展 `feature.config.js` 的 `sortableFields`，涵盖书名/作者/关键词/备注/评分/复习次数/阅读时长/最后访问/截止日期等字段。
  - 同步 `SortManager` 公式上下文，追加 title/author/subject/keywords/notes/tags_count 等字段及 length/asc/desc/clamp/normalize 工具函数。
  - 新增 Jest 用例 `weighted-sort-editor.builder.test.js` 覆盖字段、函数、删除、事件 6 条交互路径。
- 测试: `pnpm test -- weighted-sort-editor.builder` ✅
- 后续: 如需支持撤销/重做或更多函数，可在当前令牌模型基础上扩展。

## 2025-10-06 搜索结果多列布局
- 背景: 用户希望在搜索结果区提供一栏/双栏/三栏多列视图切换按钮，纯前端控制展示。
- 实现: SearchResultsFeature 新增布局按钮 (layout-toggle)、本地偏好持久化与 `layout-single/layout-double/layout-triple` 容器类。
- 样式: search-results.css 引入网格布局与按钮样式；search-result-item 卡片高度填充、去除 margin；全局批量动作区域支持 wrap。
- 测试: `layout-toggle.test.js` 验证默认布局、按钮切换及 localStorage 恢复。

## 202510052139 标注卡片删除按钮
- 需求: 在标注侧边栏的卡片上新增删除按钮，统一触发 annotation 删除流程。
- 相关文件: src/frontend/pdf-viewer/features/annotation/components/annotation-sidebar-ui.js, 各工具 createAnnotationCard 实现。
- 约束: 按钮需复用现有删除事件 (PDF_VIEWER_EVENTS.ANNOTATION.DELETE)，遵循侧边栏样式规范。
- 原子任务:
  1. 梳理卡片渲染入口，决定统一处理或分工具扩展。
  2. 实现删除按钮 DOM & 事件，调用公共删除逻辑。
  3. 更新 UI/测试，验证操作。

## 202510052150 标注UI表情优化
- 需求: 在标注插件系统UI（侧边栏工具按钮、卡片按钮、快捷操作按钮等）使用Unicode表情取代纯文字标识。
- 关注范围: annotation-sidebar-ui, tools下的按钮, text-selection-quick-actions。
- 注意: 保留tooltip解释文字，确保表情含义直观。
## 2025-10-06 PDF书签持久化调研
- 触发：用户要求完成 pdf-viewer 书签功能的持久化存储，询问后端基础设施是否完备。
- 目标：盘点现有数据库插件、API、消息通道是否已覆盖书签 CRUD；若缺口存在需拆解原子任务（后端/前端）。
- 关联模块：`src/backend/database/plugins/pdf_bookmark_plugin.py`、`src/backend/api/pdf_library_api.py`、`src/backend/websocket/standard_server.py`、`src/frontend/pdf-viewer/features/bookmark/*`。
- 待办：
  1. 阅读 bookmark 插件及 API 实现，确认书签写入/读取能力与事件流。
  2. 核对 WebSocket 消息是否暴露书签存储接口。
  3. 若无现成接口，设计最小持久化协议并整理到 todo 文档。
  4. 更新本调研结果与后续任务安排。
### 2025-10-06 调研结论
- `PDFBookmarkTablePlugin` 已具备完整 CRUD/层级能力并通过单测，但 `PDFLibraryAPI` 尚未暴露书签 CRUD 接口，仅用于统计数量。
- WebSocket `StandardWebSocketServer` 当前仅提供 `pdf-library:list:records` 等基础消息，缺少 `bookmark/*` 相关路由，前端无法直接调用后端持久化接口。
- 前端 `features/pdf-bookmark` 仍使用 `LocalStorageBookmarkStorage`，未集成远端存储实现；持久化落地需新增后端 API、消息协议与前端存储策略切换。
### 2025-10-06 书签持久化执行步骤
1. 设计并补充后端 API (`PDFLibraryAPI`) 的书签 CRUD 接口，同时规划对应单元测试。
2. 在 WebSocket 标准服务器中定义 `bookmark/*` 消息协议与路由，实现与 API 的集成，并规划消息流测试。
3. 扩展前端书签存储层：新增远端存储实现、切换策略与回退方案，设计前端单元/集成测试。
4. 设计端到端验证（含前端→WS→API→数据库闭环），实现并执行回归测试。
- 2025-10-06：PDFLibraryAPI 增补 `list_bookmarks`/`save_bookmarks`/`search_records` 接口；实现 LocalStorage → 数据库的树形书签持久化转换，并重写搜索逻辑（支持 tokens、多字段权重、过滤、分页）。对应单测 `src/backend/api/__tests__/test_pdf_library_api.py` 全部通过。
- 2025-10-06：WebSocket 标准服务器新增 `bookmark/list` 与 `bookmark/save` 消息处理，统一委派到 PDFLibraryAPI，并返回 `{bookmarks, root_ids}` / `{saved}` 数据结构。
- 2025-10-06：前端书签存储切换为远端优先模型，BookmarkManager 支持注入 `wsClient`，默认通过 RemoteBookmarkStorage→WebSocket→PDFLibraryAPI 持久化；WSClient 新增 `request()` + `_settlePendingRequest`，统一请求/响应链路。

## 2025-10-06 复制 PDF ID 按钮修复（当前）
- 问题：书名左侧新增的“复制 PDF ID”按钮点击后未能复制 `pdf_id`，或在缺少 `pdf-id` URL 参数时按钮不显示/不可用。
- 背景：
  - UI 位于 `src/frontend/pdf-viewer/index.html:15`（`#copy-pdf-id-btn`）。
  - 复制逻辑位于 `src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js`：
    - 初始化按钮并绑定点击事件（`#setupCopyPdfIdButton()`）。
    - 当前仅在收到 `URL_PARAMS.PARSED` 事件或直接从 URL 查询到 `pdf-id` 时设置 `#currentPdfId`。
    - 在 `FILE.LOAD.SUCCESS` 事件中只更新标题，未回填 `#currentPdfId`。
- 相关模块与函数：
  - `URLNavigationFeature` 解析并发布 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED`（`features/url-navigation/index.js`）。
  - `UIManagerCore` 事件处理与按钮逻辑（`#setupEventListeners()`、`#setupCopyPdfIdButton()`、`#updateHeaderTitle()`）。
- 假设与可能根因：
  1) 启动场景未携带 `pdf-id`（仅携带 `file`），导致 `#currentPdfId` 为空，按钮保持隐藏；
  2) 某些环境下 `navigator.clipboard` 不可用，未触发降级逻辑或降级失败提示不明显；
  3) 事件顺序或作用域问题导致未捕获 `URL_PARAMS.PARSED`。
- 修复思路：
  - 在 `FILE.LOAD.SUCCESS` 事件回调中，若 `#currentPdfId` 为空且存在 `filename`，从 `filename` 去除扩展名得到 `pdfId` 并设置，同时调用 `#updateCopyButtonVisibility()`。
  - 保留现有 Clipboard API + `execCommand` 降级链路与 UI 提示。
- 执行步骤：
  1. 先编写 Jest 测试：
     - 场景A：URL 含 `pdf-id=sample`，初始化后按钮可见，点击后调用 `navigator.clipboard.writeText('sample')`，按钮出现 `copied` 状态与 `title` 变更。
     - 场景B：无 `pdf-id`，但触发 `FILE.LOAD.SUCCESS{ filename:'doc.pdf' }`，按钮应可见，点击复制 `doc`。
  2. 实现 `UIManagerCore` 在 `FILE.LOAD.SUCCESS` 中的回填逻辑，并调用可见性更新。
  3. 运行测试，确保通过；更新工作日志与本上下文。
- 验收标准：
  - 两个测试场景均通过；
  - 按钮在无 `pdf-id` 但有 `filename` 的情况下可用；
  - 复制成功后 2 秒内 UI 恢复初始提示；
  - 未破坏既有事件与样式。
- 已增加复制成功/失败的 Toast 提示（UIManagerCore.#showToast），避免仅依赖 title 悬浮提示造成“无提示”的用户感受。
- 失败时同时保留 alert 兜底，便于 Qt WebEngine 等环境提示。

- 追加：Clipboard 写入在部分环境（如 Qt WebEngine）可能卡住不返回，导致无提示。已在 UIManagerCore 中加入 #copyWithTimeout(800ms) 超时回退，确保点击后总有可视化反馈与兜底对话框。


## 修复记录：PDF-Viewer 复制 PDF ID 按钮（2025-10-06）
- 问题：书名左侧复制按钮点击后未能复制 pdf_id（在 Qt WebEngine 环境）
- 根因：src/frontend/pdf-viewer/pyqt/main_window.py 禁用了 QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard
- 方案：仅对 PDF-Viewer 窗口启用该属性（True）；保留前端超时保护与回退（execCommand 与手动复制对话框）
- 变更文件：
  - src/frontend/pdf-viewer/pyqt/main_window.py:82（实际行号以当前版本为准）
- 验证步骤：
  - 启动 python src/frontend/pdf-viewer/launcher.py --pdf-id sample
  - 按钮可见 → 点击 → toast 提示“✓ PDF ID 已复制”，粘贴结果应为 sample
  - 日志包含 ✅ PDF ID copied to clipboard: sample
- 影响范围：仅 PDF-Viewer 窗口；不影响 pdf-home。


### 2025-10-06 PDF-Home 添加流程回归
- 后端：`PDFLibraryAPI.add_pdf_from_file` 统一生成 12 位十六进制 UUID，并优先通过 `PDFLibraryAPI` 路径完成数据库写入；失败时回滚 `StandardPDFManager`，并保留旧 JSON 流程兜底。
- 同步更新 `StandardPDFManager._build_standard_file_info`，补充 `filepath`、`original_path`、`created_time/modified_time` 等字段以满足注册器校验。
- 新增 `DummyPDFManager` 测试桩覆盖成败分支，确保回退模式（禁用 pdf_manager）仍可落表。
- 前端 `pdf-list` 监听 `websocket:message:response` 时补充错误提示与单文件添加成功提示，用户可见反馈更加明确。
- 测试：`python -m pytest` 运行 `test_add_pdf_from_file_uses_pdf_manager`、`test_add_pdf_from_file_without_manager_inserts_record`、`test_add_pdf_from_file_propagates_manager_error`。
- WebSocket 服务器在处理 `pdf-home:add:pdf-files` 时优先调用 `PDFLibraryAPI`，失败将透传 `StandardPDFManager` 返回的实际错误文案，避免前端出现"上传失败"泛化提示。
- 调整 `PDFManager.add_file` 失败分支，直接抛出"文件已存在于列表中"，便于前端获得具体原因。

## 2025-10-06 新任务：pdf-home 搜索功能（v001）后端打通
- 任务背景：仅实现 search（不含 filter/sort）。输入按空格分词，多字段 LIKE 模糊匹配，字段默认包含 title/author/filename/tags/notes/subject/keywords，后续可配置。结果展示在 pdf-home 搜索结果列表。
- 相关模块/函数：
  - 前端：
    - SearchFeature（搜索 UI 与桥接）：src/frontend/pdf-home/features/search/index.js:1
    - SearchManager（请求/响应处理）：src/frontend/pdf-home/features/search/services/search-manager.js:1
    - SearchResultsFeature（渲染）：src/frontend/pdf-home/features/search-results/index.js:1
    - WSClient（发送/接收）：src/frontend/common/ws/ws-client.js:1
  - 后端：
    - 标准 WS 服务器：src/backend/msgCenter_server/standard_server.py:1（handle_pdf_search_v2）
    - API 门面：src/backend/api/pdf_library_api.py:269（search_records）
    - DB 插件：src/backend/database/plugins/pdf_info_plugin.py:480（search_records）
- 消息契约（v001）：
  - 请求：{ type: 'pdf/search', request_id, data: { search_text, search_fields?, include_hidden?, limit?, offset? } }
  - 响应：{ type: 'pdf/search', status: 'success'|'error', data: { records, count, search_text }, request_id }
- 原子步骤（v001）：
  1) 架构梳理与协议校验（步骤01）
  2) 后端 WS 路由与 API 打通（步骤02）
  3) 数据库搜索插件校验与用例（步骤03）
  4) 前端集成与事件流验证（步骤04）
  5) E2E 场景与验收测试（步骤05）
  6) 日志与诊断（步骤06）
- 参考规范：src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json:1；所有文件 I/O 必须显式 UTF-8，换行 \n。
- 备注：保留旧路径 pdfTable_server::'pdf-home:search:pdf-files' 兼容，不在本次修改范围。

## 2025-10-06 搜索实现执行记录（v001 实施）
- 代码变更：
  - 后端 DB：`src/backend/database/plugins/pdf_info_plugin.py:search_records`
    - 默认字段增加 `subject`、`keywords`
    - 所有 LIKE 条件添加 `ESCAPE '\\'`，并对 `%`、`_` 做转义，避免通配误匹配
  - 前端：`src/frontend/pdf-home/features/search/services/search-manager.js`
    - `search_fields` 默认包含 `subject`、`keywords`，提升首版检索覆盖面
- 测试：新增 `src/backend/database/plugins/__tests__/test_pdf_info_plugin_search_records.py`
  - 覆盖多关键词 AND、JSON 字段、tags、LIKE 转义与分页
  - 本地 `pytest` 通过
- 结论：pdf-home 基础搜索前后端链路符合 v001 规格；后端 SQL 转义更稳健，前端字段更全面。

## 2025-10-06 搜索语义更新
- 搜索语义明确为：空格 = 且（AND）。例如：`A B` 表示返回同时包含 `A` 与 `B` 的记录。
- 实现位置：
  - 后端：`PDFInfoTablePlugin.search_records` 对多个关键词使用 AND 连接，字段内 OR。
  - 前端：`SearchBar` 占位提示文案更新为"空格=且"。

## 2025-10-06 pdf-home 最近搜索插件（v1）
- 任务目标：实现侧边栏 RecentSearches 插件，记录并显示最近的搜索关键字，点击可再次发起搜索。
- 相关模块/文件：
  - 前端：
    - 插件类：`src/frontend/pdf-home/features/sidebar/recent-searches/index.js:1`
    - 插件配置：`src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js:1`
    - 样式：`src/frontend/pdf-home/features/sidebar/recent-searches/styles/recent-searches.css:1`
    - 容器：`src/frontend/pdf-home/features/sidebar/components/sidebar-container.js:1`（提供 DOM 容器）
  - 事件：
    - 全局监听：`search:query:requested`（与 SearchFeature 保持一致）
    - 本地触发：`search:clicked`、`limit:changed`
  - 本地存储：
    - 历史键名：`pdf-home:recent-searches`
    - 显示条数键名：`pdf-home:recent-searches:display-limit`
- 事件流：
  1) 用户在 SearchBar 输入并触发搜索 → 全局事件 `search:query:requested`
  2) RecentSearches 监听事件，写入/去重/上移并保存到 LocalStorage → 渲染列表
  3) 用户点击某条历史 → 插件发出本地 `search:clicked` + 全局 `search:query:requested`，驱动重新搜索
- UI：
  - 列表容器：`#recent-searches-list`（由 SidebarContainer 预先渲染）
  - 标题处附加“显示 N”下拉（5/10/20/50），更新显示条数并持久化
  - 空列表显示“暂无搜索记录”占位
- 原子步骤：
  1) 读取规范、确认事件名（三段式）与容器 DOM
  2) 先写 Jest 单测：存取、渲染、点击回放、去重置顶
  3) 实现插件：存储读写、渲染、事件桥接、显示条数
  4) 打开 Feature Flag：`recent-searches=true`
  5) 更新文档与工作日志
- 结果：
  - 新增测试：`src/frontend/pdf-home/features/sidebar/recent-searches/__tests__/recent-searches.test.js:1`
  - 实现逻辑：`index.js` 完成；`feature.config.js` 事件名与 SearchFeature 对齐
  - Feature Flag 已启用：`src/frontend/pdf-home/config/feature-flags.json:101`
  - 不涉及后端改动

## 2025-10-06 搜索消息类型兼容修复（已改为仅保留 v1）
- 现象：点击搜索出现“未知的消息类型: pdf/search”。
- 根因：当前运行的后端 `pdfTable_server` 仅识别旧类型 `pdf-home:search:pdf-files`，并统一以 `type=response` 返回；前端 `SearchManager` 发送了新类型 `pdf/search` 且仅处理新协议响应，导致报错。
- 最终决定：完全移除 v2（`pdf/search`）支持，只保留 v1：
  - 前端 SearchManager 仅发送 `pdf-home:search:pdf-files`（顶层 `search_text`），仅解析 `websocket:message:response`，读取 `data.files/total_count/search_text`。
  - 后端 MsgCenter 仅路由 `pdf-home:search:pdf-files` 并返回标准 `response` 包。
  - 移除了前端“协议自动适配/回退/记忆”等逻辑。
  - 受影响文件：
    - `src/frontend/pdf-home/features/search/services/search-manager.js:1`（删除 v2 相关逻辑）
    - `src/backend/msgCenter_server/standard_server.py:1`（仅保留 v1 搜索路由）
  - 预期：不会出现“未知的消息类型: pdf/search”；只有 v1 搜索链路生效。

## 2025-10-06 MsgCenter 搜索路由补全（standard_server）
- 现象：MsgCenter 日志显示对 `pdf-home:search:pdf-files` 与 `pdf/search` 均返回 `response`，且 message 为“未知的消息类型: ...”。
- 原因：`src/backend/msgCenter_server/standard_server.py` 未实现这两类搜索消息的路由分支，走了默认 unknown_message_type 分支。
- 处理：
  - 新增 `handle_pdf_search_request()`，支持两种消息：
    - v1: `pdf-home:search:pdf-files`（顶层 `search_text`）→ 返回标准 `response` 包，`data={ files, total_count, search_text, original_type }`
    - v2: `pdf/search`（`data.search_text` 等）→ 返回类型化消息 `type='pdf/search'`，`data={ records, count, search_text }`
  - 搜索实现优先使用 `pdf_library_api.search_records()`（若注入），否则回退到 `PDFManager` 内存搜索（空搜索=全部）。
- 受影响文件：`src/backend/msgCenter_server/standard_server.py:1`（新增分支与处理方法）
 
- 结果：前端不会再收到“未知的消息类型: pdf/search|pdf-home:search:pdf-files”的错误；`SearchManager` 的 v1/v2 双协议解析均可正常工作。

## 2025-10-06 日志治理（前端）
- 无订阅者事件降级与抑制（websocket:message:received）：防止 WS 高频广播刷屏。
- WSClient ACK 静默前移：避免 console_log 确认响应引发的通用广播。
- 统一 console→logger：前端代码不再直接使用 console.*（保留桥接器内部实现）。

## 任务：修复 logger 改动导致 PDF-Viewer 无法显示

- 时间: 2025-10-06 14:28:02
- 问题背景:
  - 最近一次“日志降噪/console→logger统一”改动后，pdf-viewer 无法正常显示 PDF。
  - logs/pdf-viewer-*-js.log 中出现两类错误：
    - Uncaught SyntaxError: Cannot use import statement outside a module
    - The requested module '/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js' does not provide an export named 'PDFViewerManager'
- 根因定位:
  - floating-controls.js 引入 getLogger 导致使用 ES Module 语法，但 index.html 仍以非模块脚本方式加载，触发“import 语法用于非模块”错误；同时该文件内部未声明 logger 变量。
  - pdf-viewer-manager.js 在 console→logger 改动过程中，Class 声明丢失导出（未导出命名 PDFViewerManager），导致下游 UIManagerCore 的命名导入失败。
- 修复方案:
  - index.html 中将 <script src="assets/floating-controls.js"> 改为 <script type="module" src="assets/floating-controls.js">；
  - src/frontend/pdf-viewer/assets/floating-controls.js 顶部新增 const logger = getLogger('FloatingControls');；
  - src/frontend/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js 将 class PDFViewerManager 改为 export class PDFViewerManager，补齐命名导出。
- 测试设计:
  - 新增用例1：验证 pdf-viewer-manager.js 的命名导出存在；
  - 新增用例2：在 JSDOM 中加载 floating-controls.js，触发 DOMContentLoaded 并模拟点击，验证逻辑不抛错且折叠切换正确。
- 执行与结果:
  - 两个新增测试均通过；项目其他部分未受影响。
- 风险与回归点:
  - 仅涉及 ESModule 装载与命名导出恢复，不改变对外 API；Vite/QtWebEngine 行为与现有脚手架保持一致。
 
- 结果：前端不会再收到"未知的消息类型: pdf/search|pdf-home:search:pdf-files"的错误；`SearchManager` 的 v1/v2 双协议解析均可正常工作。

## 2025-10-06 PDF-Home 最近搜索长期存储 ✅ 完成
### 问题与背景
- 目前 pdf-home 的"最近搜索"仅存于 LocalStorage，无法跨环境/长期保存。
- 目标：将最近搜索改为长期存储到文件 `data/pdf-home-config.json` 的 `recent_search` 字段，并在前端定期（防抖）推送更新。

### 涉及模块与文件
- 前端：`src/frontend/pdf-home/features/sidebar/recent-searches/index.js`
  - 安装时先从 localStorage 读取，再发送 `pdf-home:get:config` 请求，收到回执覆盖本地并渲染。
  - 每次新增/置顶搜索后，300ms 防抖发送 `pdf-home:update:config`，payload 中包含 `recent_search` 数组（元素形如 `{ text, ts }`）。
- 前端事件常量：`src/frontend/common/event/event-constants.js:WEBSOCKET_MESSAGE_TYPES`
  - 新增 `GET_CONFIG`、`UPDATE_CONFIG`。
- 后端：`src/backend/msgCenter_server/standard_server.py`
  - 新增 `handle_pdf_home_get_config`、`handle_pdf_home_update_config`。
  - 配置文件路径：`data/pdf-home-config.json`（UTF-8 + 换行 `\n`）。

### 完成内容
- ✅ 新增事件常量（前端）
- ✅ 编写前端单测（安装请求、更新发送、回执覆盖）
- ✅ 改造 RecentSearchesFeature 读/写后端（含防抖）
- ✅ 增加后端 WS 处理器（UTF-8 文件读写）
- ✅ 修复 WSClient `#flushMessageQueue()` 保留完整消息（含 `request_id`），避免队列消息回执无法关联

---

## 任务：PDFLibraryAPI 插件隔离重构（规划)

- 时间：2025-10-06
- 背景：`src/backend/api/pdf_library_api.py` 现为多功能混合门面（搜索/书签/入库等），职责过重，影响扩展与测试边界。
- 目标：按前端域拆分后端模块，并保留向下兼容门面；不改变 WebSocket 消息契约与前端行为。

### 目录规划
- `src/backend/api/pdf-home/search`：搜索服务（search_records）
- `src/backend/api/pdf-home/add`：文件入库/注册（register_file_info, add_pdf_from_file）
- `src/backend/api/pdf-viewer/bookmark`：书签读写（list_bookmarks, save_bookmarks）
- `src/backend/api/utils`：时间戳、record 映射、tags 归一化等通用工具

### 执行步骤（原子任务）
1. 新建上述目录与空模块，补充 `__init__.py`
2. 提炼工具函数至 `api/utils`（ms/iso/second、tags、row↔record 映射）
3. 迁移搜索逻辑至 `pdf-home/search/service.py`，门面委派
4. 迁移书签逻辑至 `pdf-viewer/bookmark/service.py`，门面委派
5. 迁移入库逻辑至 `pdf-home/add/service.py`，门面委派
6. 子模块新增单测；保留并通过 `test_pdf_library_api.py`
7. 冒烟验证 WebSocket 相关路径（不改协议/调用点）

### 最新进展（2025-10-06 23:58）
- 已新增批量格式化脚本 `scripts/run-prettier.mjs`，封装 Prettier 调用，支持 `--check` / `--write` 与 `--pattern` 定向格式化。
- `package.json` 新增命令：`pnpm run format`（批量写入）与 `pnpm run format:check`（校验），默认覆盖 `src/`、`scripts/` 及根部配置文件。
- 配置文件：新增 `.prettierrc.json`（单引号、100 列宽、LF）与 `.prettierignore`（忽略 node_modules/AItemp 等目录）。
- 验证命令：`pnpm run test:format` 会在示例文件上执行 `format:check`，确保工具链稳定。

### 测试设计
- 覆盖：搜索（多 token/空/标签/评分/分页/排序/负例）、书签（树结构/顺序/区域校验/级联）、入库（路径校验/PDF 校验/回滚/DB 同步）
- 兼容：门面旧测试不变；新增子模块测试

### 约束
- 文件 I/O 全部显式 UTF-8 编码，换行 `\n` 校验
- 目录命名使用 kebab-case（例如 `pdf-home`、`pdf-viewer`）
- 不改动数据库表结构与前端协议

- 需求文档：todo-and-doing/2 todo/20251006140530-pdf-library-api-plugin-isolation/v001-spec.md

## 2025-10-06 实施记录（插件隔离阶段一）
- 新增 ServiceRegistry：src/backend/api/service_registry.py（键：pdf-home.search/pdf-home.add/pdf-viewer.bookmark）
- 新建域目录骨架：
  - src/backend/api/pdf-home/search/{__init__.py, service.py}
  - src/backend/api/pdf-home/add/{__init__.py, service.py}
  - src/backend/api/pdf-viewer/bookmark/{__init__.py, service.py}
- 修改 PDFLibraryAPI：构造函数支持注入 service_registry；search/add/bookmark 方法在服务存在时委派，否则回退原实现；pdf_manager 懒加载避免 Qt 依赖阻塞单测；add_pdf_from_file 懒加载工具避免硬依赖。
- 新增单测：src/backend/api/__tests__/test_api_service_registry.py（验证注入委派生效）
- 单测结果：本地仅执行新用例通过（使用 $env:PYTHONPATH=src）

## 2025-10-06 实施记录（插件隔离阶段二）
- 抽取 utils：src/backend/api/utils/{datetime.py,mapping.py,tags.py}
- 实现默认服务并自动注册（动态按文件路径加载，兼容 kebab-case 目录）：
  - pdf-home/search: DefaultSearchService（search_records）
  - pdf-home/add: DefaultAddService（register_file_info, add_pdf_from_file）
  - pdf-viewer/bookmark: DefaultBookmarkService（list_bookmarks, save_bookmarks）
- 修改 PDFLibraryAPI：_auto_register_default_services + 动态加载 _load_default_service()（避免 Python 包导入对 kebab-case 的限制）
- 保持门面旧逻辑作为回退路径；现默认走委派路径。


## 2025-10-06 实施记录（插件隔离阶段三）
- 标准服务器支持注入：src/backend/msgCenter_server/standard_server.py: __init__(..., pdf_library_api=None, service_registry=None)
- 如提供 service_registry，则内部创建 PDFLibraryAPI(service_registry=...)，否则保持原逻辑（无门面时走回退）
- 维持对现有测试的兼容（仍可直接设置 server.pdf_library_api = Fake 实例）


### 2025-10-06 书签保存故障修复
- 根因1：默认服务自动注册受 search/service.py 相对导入影响，首次失败导致后续（bookmark）未注册；改为分开 try/except 并修正为绝对导入（含兜底）。
- 根因2：StandardWebSocketServer 未默认构造 PDFLibraryAPI，未注入时 `bookmark/save` 不落库；现缺省创建（带 ServiceRegistry）。
- 验证：新增闭环单测 `src/backend/api/__tests__/test_bookmark_persistence.py`，保存→读取成功。

---

## 合并 Worktree D 并适配后端 API 重构（兼容实现）
- 时间: 2025-10-06 14:45:36
- 分支: d-main-20250927 → main
- 提交数: 4 commits (cf0de09, 3493d3e, 4bef0fe, a1b52ed)
- 变更:
  - src/backend/api/pdf_library_api.py: 为 ServiceRegistry 引入 try/except 可选导入，缺失时提供最小桩（register/has/get）与常量，确保 test_pdf_library_api 可运行；保留后续接入真实 ServiceRegistry 的能力。
  - src/backend/msgCenter_server/standard_server.py: 对 ServiceRegistry 采用可选导入与最小桩声明，维持注入接口不变。
- 测试: 后端相关单测 17 通过（命令: PYTHONPATH=src python -m pytest -q src/backend/api/__tests__/test_pdf_library_api.py src/backend/msgCenter_server/__tests__/test_standard_server_bookmarks.py）。
- 后续: 如需完整跟进 main 上的 API 插件隔离重构，请创建子任务落实 service_registry 与域服务实现（search/add/bookmark），当前仅提供兼容层避免功能回归。


### 2025-10-06 前端构建错误修复
- [pdf-viewer-manager] import 花括号内误插入 JSDoc 风格注释，触发 Babel 解析错误
- 修复方式：移除该行，并在 import 之后声明模块级 logger 常量
- 文件：src/frontend/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js:1

### 2025-10-06 书签DB优先与CRUD同步
- 前端 PDFBookmarkFeature 在 PDF 加载后：先远端拉取；若无数据则导入原生书签并远端保存，然后再次从远端加载。
- 创建/更新/删除/排序：本地变更后立即远端保存并重新从远端加载，保证以数据库为单一真相。
- 涉及文件：src/frontend/pdf-viewer/features/pdf-bookmark/index.js:1## 当前任务 (2025-10-06 16:28)
- 目标：统一通信消息/事件三段式命名，修复 PDF-Home 新增文件无 toast，并同步资料
- 相关模块：src/backend/msgCenter_server/*、src/backend/msgCenter_server/__tests__、src/backend/api/pdf_library_api.py、src/frontend/common/event/event-constants.js、src/frontend/common/ws/ws-client.js、src/frontend/pdf-home/features/pdf-list/index.js、src/frontend/pdf-home/index.js
- 原子步骤：
  1. 清点现有命名残留与依赖链路，整理需替换的消息常量/事件
  2. 为后端命名重构与 toast 修复制定测试方案（后端pytest + 前端jest）
  3. 重构后端消息处理（统一命名、接入 PDFLibraryAPI）并更新构建器
  4. 调整前端常量/监听逻辑与依赖获取方式，确保 toast 触发
  5. 运行对应测试，更新文档与 memory bank
- 注意事项：禁止蛇形命名，确保所有新事件符合 {module}:{action}:{status}；保留旧协议兼容入口但默认走新命名；所有文件写入需 UTF-8

---

## 当前问题（2025-10-06 23:58）

- 需求：实现面向仓库的 JavaScript/TypeScript 批量格式化流程，遵守既有 UTF-8/\n 规范与契约驱动协作方式。
- 目标：在现有工具链内（pnpm/脚本）提供可重复执行的格式化命令，并保证不会破坏既有代码结构或契约文件。
- 关注点：已有脚本/配置（如 prettier、eslint）是否存在；全局 Logger/事件规范需保持；避免对非 JS/TS 文件造成影响。

### 相关模块与文件
- package.json / pnpm-lock.yaml：检查是否已声明 Prettier/ESLint。
- scripts/*（若存在）：复用或扩展 CLI 脚本。
- src/frontend/**：待格式化的主要 JS 目录。
- 可能的配置文件：.prettierrc、.eslintrc.*、.editorconfig（需确认是否已有）。

### 执行步骤（原子任务）
1. 调研仓库现有格式化/检查工具配置，确认是否已引入 Prettier 或 ESLint。
2. 阅读相关模块规范文档（docs/SPEC/*、readme、templates）定位格式要求。
3. 设计测试方案：至少包含在样例 JS 文件上运行格式化命令并比对变更；必要时先创建干净样例。
4. 在掌握规范后，先编写测试脚本/命令（例如使用 pnpm script 触发 npx prettier --check）。
5. 实现批量格式化命令（如新增 pnpm script / PowerShell 脚本），确保指定文件编码与换行规范。
6. 执行测试验证命令可运行并输出符合预期的结果；如遇冲突需记录并处理。
7. 更新 memory bank 与日志，记录命令用法、注意事项及后续拓展建议。
## 2025-10-06 修复记录（前端Babel报错）
- 症状：构建时报错 Private name #buildError is not defined，定位到 src/frontend/common/event/event-bus.js
- 原因：在 EventBus.on()/emit() 中错误地调用了 EventNameValidator 的私有静态方法 #buildError（跨类访问私有方法，语法不合法）
- 处理：改为直接构造错误提示字符串，不再跨类调用私有方法；EventNameValidator 内部的私有方法保持不变
- 风险控制：搜索全仓库未发现其它 ClassName.#private 的跨类访问
- 建议：若需对外复用，请将私有方法对等提供一个公开静态方法（如 buildError），或在调用处直接拼装文案
\n---
## 2025-10-06 事件白名单修复（pdf-viewer 打不开）
- 现象：pdf-viewer 自启动时尝试触发 'pdf-viewer:file:load-requested'，被 EventBus 全局白名单拦截（未注册全局事件），导致不加载。
- 影响：自动加载 PDF 中断；书签、侧栏等初始化日志正常。
- 措施：global-event-registry 增加对 PDF_VIEWER_EVENTS 的白名单收集。未新增/改名事件，仅放行既有事件名。
- 建议：后续如出现其它模块类似告警（如 pdf-translator），按相同方式放行或改用 scopedEventBus。
\n---
## 2025-10-06 PyQt 桥接补齐 timestamp
- 变更：src/frontend/pdf-viewer/pyqt/pdf_viewer_bridge.py 的 loadPdfFile 发送消息增加 timestamp（毫秒）。
- 背景：服务器 standard_protocol.validate_message_structure 要求消息必须包含 type 和 timestamp；此前日志出现缺少 timestamp。
- 影响：避免 load_pdf_file 被服务器拒绝，提升打开 PDF 的稳定性。

### 最新进展（2025-10-06 23:58）
- 已新增批量格式化脚本 `scripts/run-prettier.mjs`，封装 Prettier 调用，支持 `--check` / `--write` 与 `--pattern` 定向格式化。
- `package.json` 新增命令：`pnpm run format`（批量写入）与 `pnpm run format:check`（校验），默认覆盖 `src/`、`scripts/` 及根部配置文件。
- 配置文件：新增 `.prettierrc.json`（单引号、100 列宽、LF）与 `.prettierignore`（忽略 node_modules/AItemp 等目录）。
- 验证命令：`pnpm run test:format` 会在示例文件上执行 `format:check`，确保工具链稳定。

- 全域覆盖：已将 pdf-library（list/add/remove/info/config）、bookmark、pdf-page、storage-kv(set/delete/get)、storage-fs(read/write)、system(heartbeat) 纳入能力发现与白名单，契约位于 doing/schemas。
\n---
## 2025-10-06 PDF-Home 编辑器新增重置功能
- 位置：pdf-home 编辑按钮弹窗（features/pdf-edit/index.js）
- 重置书签：通过 bookmark:save:requested 发送空集合清空书签；下次打开查看器自动从PDF源导入
- 重置阅读进度：通过 pdf-library:record-update:requested 将 visited_at/total_reading_time 清零
- 重置标注：前端按钮占位，待后端提供批量清空注解接口/路由后启用（不新增事件名则需约定updates字段）

---

## 任务记录：2025-10-06 标注持久化修复（契约驱动）

- 问题概述：pdf-viewer 标注（Annotation）仅实现了 Phase 1 的内存 Mock，未打通后端持久化；页面渲染日志显示恢复标注为 0。
- 根因：
  - 前端 AnnotationManager 的 #saveAnnotationToBackend/#loadAnnotationsFromBackend 未实现；
  - WebSocket 协议缺少 annotation 域的消息类型与服务端处理；
  - 能力注册与 JSON Schema 契约未覆盖 annotation 域。
- 目标：按契约编程补齐 annotation 域的消息契约、后端处理、前端调用链路，实现创建/更新/删除/加载的持久化。

### 相关模块与函数
- 前端
  - src/frontend/common/event/event-constants.js：新增 WS 消息常量 nnotation:list/save/delete（requested/completed/failed）
  - src/frontend/pdf-viewer/features/annotation/core/annotation-manager.js：
    - 接入 DI 容器获取 wsClient
    - 实现 #saveAnnotationToBackend、#loadAnnotationsFromBackend、#deleteAnnotationFromBackend
  - src/frontend/common/event/global-event-registry.js：自动白名单收敛（引入新常量后即放行）
- 后端
  - src/backend/msgCenter_server/standard_protocol.py：新增 Annotation 消息类型枚举
  - src/backend/msgCenter_server/standard_server.py：
    - handle_annotation_list_request
    - handle_annotation_save_request
    - handle_annotation_delete_request
  - 复用 PDFAnnotationTablePlugin 完成 CRUD
- 契约
  - 	odo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/annotation/v1/messages/*.schema.json
  - 在能力描述 capability:describe:requested 中暴露 annotation 域

### 执行步骤（原子任务）
1. 新增 WS 消息类型（前后端常量）
2. 后端 StandardServer 增加处理分支与实现
3. 前端 AnnotationManager 接入 wsClient 并落库/加载
4. 添加后端消息往返测试（保存 → 列表）
5. 补充 JSON Schema 契约与能力描述
6. 自测：在 pdf-viewer 中创建高亮/截图/批注，刷新后可恢复

### 最新进展（2025-10-06 23:58）
- 已新增批量格式化脚本 `scripts/run-prettier.mjs`，封装 Prettier 调用，支持 `--check` / `--write` 与 `--pattern` 定向格式化。
- `package.json` 新增命令：`pnpm run format`（批量写入）与 `pnpm run format:check`（校验），默认覆盖 `src/`、`scripts/` 及根部配置文件。
- 配置文件：新增 `.prettierrc.json`（单引号、100 列宽、LF）与 `.prettierignore`（忽略 node_modules/AItemp 等目录）。
- 验证命令：`pnpm run test:format` 会在示例文件上执行 `format:check`，确保工具链稳定。

### 设计约束
- 三段式事件命名；所有写入/读取均显式 UTF-8 且换行 \n
- 先设计测试再实现；若产生与主任务不强相关的子任务（如大范围文档重排），交由 subagent

---

## 当前问题（2025-10-06 23:58）

- 需求：实现面向仓库的 JavaScript/TypeScript 批量格式化流程，遵守既有 UTF-8/\n 规范与契约驱动协作方式。
- 目标：在现有工具链内（pnpm/脚本）提供可重复执行的格式化命令，并保证不会破坏既有代码结构或契约文件。
- 关注点：已有脚本/配置（如 prettier、eslint）是否存在；全局 Logger/事件规范需保持；避免对非 JS/TS 文件造成影响。

### 相关模块与文件
- package.json / pnpm-lock.yaml：检查是否已声明 Prettier/ESLint。
- scripts/*（若存在）：复用或扩展 CLI 脚本。
- src/frontend/**：待格式化的主要 JS 目录。
- 可能的配置文件：.prettierrc、.eslintrc.*、.editorconfig（需确认是否已有）。

### 执行步骤（原子任务）
1. 调研仓库现有格式化/检查工具配置，确认是否已引入 Prettier 或 ESLint。
2. 阅读相关模块规范文档（docs/SPEC/*、readme、templates）定位格式要求。
3. 设计测试方案：至少包含在样例 JS 文件上运行格式化命令并比对变更；必要时先创建干净样例。
4. 在掌握规范后，先编写测试脚本/命令（例如使用 pnpm script 触发 npx prettier --check）。
5. 实现批量格式化命令（如新增 pnpm script / PowerShell 脚本），确保指定文件编码与换行规范。
6. 执行测试验证命令可运行并输出符合预期的结果；如遇冲突需记录并处理。
7. 更新 memory bank 与日志，记录命令用法、注意事项及后续拓展建议。
## 2025-10-06 前后端并行开发评估（CRUD）

### 最新进展（2025-10-06 23:58）
- 已新增批量格式化脚本 `scripts/run-prettier.mjs`，封装 Prettier 调用，支持 `--check` / `--write` 与 `--pattern` 定向格式化。
- `package.json` 新增命令：`pnpm run format`（批量写入）与 `pnpm run format:check`（校验），默认覆盖 `src/`、`scripts/` 及根部配置文件。
- 配置文件：新增 `.prettierrc.json`（单引号、100 列宽、LF）与 `.prettierignore`（忽略 node_modules/AItemp 等目录）。
- 验证命令：`pnpm run test:format` 会在示例文件上执行 `format:check`，确保工具链稳定。

### 结论
- 可以并行开发：pdf-home / pdf-viewer 等页面与后端的 CRUD 交互已具备契约驱动的并行开发条件。

### 依据
- 前端：
  - src/frontend/common/event/event-constants.js 已收敛核心消息类型（pdf-library、bookmark、pdf-page、storage-kv/fs、capability、annotation）。
  - src/frontend/common/ws/ws-client.js 已实现基于 
equest_id 的泛化请求-响应结算，未知/未注册类型会显式报错。
  - 全局事件白名单由 global-event-registry.js 自动收敛，防止未注册事件“泄漏”。
- 契约：
  - 	odo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/** 已覆盖各域 JSON Schema（request/completed/failed）。
- 后端：
  - src/backend/msgCenter_server/standard_protocol.py 定义 MessageType 枚举；
  - src/backend/msgCenter_server/standard_server.py 实现各域 handler（list/add/remove/info/record-update、bookmark list/save、pdf-page load/preload/cache-clear、storage-kv/fs、capability、annotation list/save/delete）。

### 并行协作的边界条件（必须遵守）
1) 新增消息类型时，三处同步：
   - 前端 event-constants.js 常量；
   - 后端 standard_protocol.py 与 standard_server.py 分发与实现；
   - 契约 	odo-and-doing/.../schemas/<domain>/v1/messages/*.schema.json；
2) 只允许三段式事件名；未注册事件将被拦截；
3) 所有文件读写显式 UTF-8，换行 \n；消息必须包含 	ype 与 	imestamp；
4) 先写测试/Schema 再实现，使用 i_launcher.py 启停服务做端到端验证。

### 已覆盖领域（当前可直接并行）
- pdf-library: list/add/remove/info/search/record-update/config-read/config-write/viewer
- ookmark: list/save
- nnotation: list/save/delete（建议补充端到端实测）
- pdf-page: load/preload/cache-clear
- storage-kv 与 storage-fs
- capability: discover/describe

### 建议的原子任务拆分（示例）
- 页面A-功能X：
  - 规格：补/核对 Schema → 更新 capability
  - 后端：MessageType + handler + 最小单测（往返）
  - 前端：接入 wsClient.request(type, data) + 处理 completed/failed
  - 自测：ai_launcher 启动后端到端验证

### 快速用法示例（前端）
`js
import { WEBSOCKET_MESSAGE_TYPES as T } from '../common/event/event-constants.js';
const res = await wsClient.request(T.STORAGE_KV_GET, { key: 'recent-searches' });
if (res?.status === 'success') { /* 使用 res.data */ }
`



### 执行结果（20251007000109）
- 合并来源: worktree-A（feature-bookmark-fix）
- 目标分支: main
- 结果: Already up to date；未产生新提交
- 备注: 自动创建的 stash 未弹出，以免覆盖当前 context.md 修改；保留以便手动处理：stash@{0}: On main: auto-stash before merging worktree A

---
## 2025-10-07 00:07:44 决策：并行开发起点采用 Schema-first
- 结论：是，所有新增/调整消息需先完成 JSON Schema（request/completed/failed）。
- 同步项：
  - 前端 event-constants.js（注册消息常量，进入白名单）；
  - 后端 MessageType 与 standard_server handler；
  - capability:describe 能力曝光；
- 验收：requested→completed/failed 往返测试，ai_launcher 端到端验证；
- 规范：UTF-8 文件编码，换行 
；消息含 type/timestamp，三段式事件名。


---

## 当前问题（20251007）
- 报错：Babel Duplicate private name `#deleteAnnotationFromBackend`（annotation-manager.js:440:8）
- 背景：类中存在同名私有方法/字段重复定义，Babel 无法编译
- 影响范围：Feature.annotation（PDF Viewer 批注管理）
- 目标：删除重复定义、合并实现，保持公共 API 不变

### 相关文件
- `src/frontend/pdf-viewer/features/annotation/core/annotation-manager.js`

### 执行步骤
1. 全文检索 `#deleteAnnotationFromBackend`，确认重复定义位置
2. 比对两个实现差异，保留语义更完整的一处，将调用点统一指向保留实现
3. 去除重复私有方法，确保类结构与外部接口无变化
4. 运行构建（或启动 ai_launcher.py 相应模块）验证无错误
5. 更新 AItemp 工作日志与本 context 记录结果与注意事项

### 测试与验证
- 使用项目构建作为最小验证标准（无 Babel 报错）
- 如需进一步验证，补充最小 Node ESM 载入测试（仅语法/导入检验）

\r\n## 执行结果（20251007）
- annotation-manager.js 中重复的私有方法 `#deleteAnnotationFromBackend` 已去重
- 保留的实现：基于 `#wsClient.request` 的删除逻辑
- 构建验证通过：`pnpm run build:pdf-viewer`（无 Babel 报错）

## 2025-10-07 pdf-home 添加PDF 修复
- 背景: 前端通过 QWebChannel 获取文件路径后，向 WS 发送 'pdf-library:add:records'。后端返回标准契约 'pdf-library:add:completed/failed'，但 WSClient 未路由该类型到通用响应事件，导致前端未监听到成功/失败；同时没有‘导入中’提示与文件名绑定的成功/失败 toast。
- 变更: 
  - 新增 ToastManager（左上角堆叠），在发送每个文件时显示 '导入中'，携带 request_id 关联；收到响应后替换为 '<文件名>-导入成功/失败-原因'。
  - WSClient 将 'pdf-library:add:completed/failed' 路由为 'websocket:message:response'，并结算 pending 请求。
  - pdf-list/index.js 发送添加请求附带 request_id；监听 response 处理 add:completed/failed；unknown 兜底转发。
- 相关模块/函数: 
  - 前端: src/frontend/pdf-home/features/pdf-list/index.js, src/frontend/common/ws/ws-client.js, src/frontend/common/utils/toast-manager.js
  - 后端: src/backend/msgCenter_server/standard_server.py (handle_pdf_upload_request), src/backend/api/pdf_library_api.py（add_pdf_from_file）
- 执行步骤: 
  1) 实现 ToastManager；2) 修正 WSClient 路由；3) 发送携带 request_id；4) 监听响应更新 toast；5) 兜底 unknown 转发；6) 观察 logs/ 与 UI 结果。
- 预期: 
  - 点击添加后弹 '导入中'（可堆叠）；每个文件成功时 '文件名-导入成功'；失败时 '文件名-导入失败-原因'；添加完成刷新列表。
- 实际: 按上述实现已完成代码修改，待端到端手动验证。
- 备注: 保持事件命名三段式；严禁 console.*，统一 Logger；所有读写 UTF-8。

### 2025-10-07 Toast 一致性 & 相对导入错误
- Toast: 将 pdf-home 添加流程的错误/成功提示统一改用左上角堆叠Toast (ToastManager)，替换此前使用的 notification.js（右上角）。
- ImportError: DefaultAddService 以 importlib 动态加载，无法依赖相对导入；已将 '...pdf_manager.*' 改为 'src.backend.pdf_manager.*' 绝对导入，避免 'attempted relative import with no known parent package'。
- 受影响文件: src/frontend/pdf-home/features/pdf-list/index.js, src/frontend/common/utils/toast-manager.js, src/frontend/common/ws/ws-client.js, src/backend/api/pdf-home/add/service.py
