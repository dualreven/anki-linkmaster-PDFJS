# 技术规范（最新版·极简索引）

**注意**：2025年11月的详细变更记录已移至 `context.md`，此处仅保留核心技术规范。历史变更详见 `docs/context-archive/`。

  - 核心规则（立即执行）
  - UTF-8 + \n：所有读写显式 UTF-8，统一换行 \n。
  - Fail‑Fast：参数/事件/消息不合法一律失败，禁止兜底/静默回退。
  - 事件三段式：`{module}:{action}:{status}`；事件名必须通过命名空间常量引用（`*_EVENTS`、`*_MESSAGE_TYPES`、`PDF_VIEWER_EVENTS`、`WEBSOCKET_EVENTS`）。
  - Viewer 导航自动启动：当发送 `pdf-viewer:navigate:requested` 且目标 viewer 未注册时，MsgCenter 会触发 `app-window:open:requested` 并缓存待转发，viewer 注册后自动转发（回执 `code=202`）。
  - 白名单：全局事件新增前，先在常量中登记；`global-event-registry.js` 放行。
  - 作用域：跨模块用 `onGlobal/emitGlobal`；避免 scoped↔global 不一致；组件初始化需幂等。
  - WebSocket 常量使用规范：请求/发送事件用 `WEBSOCKET_EVENTS.MESSAGE.SEND|RECEIVED|SEND_FAILED`；响应事件用 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`（切勿写成 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`）。
  - **代码文件行数限制**：单个代码文件（.js/.py/.ts等）原则上不能超过 **500 行**；超过时必须重构拆分为多个模块或文件。合理的拆分方式包括：按功能域拆分（如将一个大的 Feature 拆分为多个子 Feature）、提取工具函数到独立文件、分离配置和常量、使用组合模式替代继承等。
  - **行数门禁脚本（P0 止血）**：使用 `pnpm run ci:frontend-line-limit` 检查 `src/frontend`（基线+增量），基线文件为 `scripts/ci/baselines/frontend-line-limit.json`。
  - **memory-bank 门禁（自动归档）**：`pnpm run lint` 前置执行 `pnpm run lint:memory-bank`；check-only 用 `pnpm run ci:memory-bank-limit`。

- 主题索引（详细说明见 docs）
  1) 事件与常量命名规范 → docs/standards/events.md
  2) WebSocket 契约（Outline 域示例） → docs/contracts/ws-outline.md
  3) 构建与运行（源码/分发与静态路由） → docs/engineering/build-run.md
  4) 质量门禁（Lint/测试/E2E/契约差异检查） → docs/quality/quality-gates.md
  5) 自检清单（上线前/提交前） → docs/checklists/self-check.md
  6) Memory Bank 压缩机制规范 → .kilocode/rules/memory-bank/compression.md

- 现行检查清单（最小集合）
  - 事件名：只用命名空间常量；禁止字面量/变量/模板字符串。
  - 全局事件：新增前登记白名单。
  - Outline 首次导入（后端优先、一次渲染）：  
    1) 首先 `pdf-viewer:outline-list:request`；  
    2) 若返回空 → 从 PDF 提取原生大纲并 `pdf-viewer:outline-bulk-save:request`；  
    3) 保存完成后再次 `outline-list:request` 并仅在最终回执时发出一次 `OUTLINE.LOAD.SUCCESS`；  
    4) 去掉本地缓存（localStorage）写入/读取逻辑。
  - UI/数据层事件作用域一致；重复初始化有幂等守卫。
  - 禁用 alert/confirm；错误统一 logger.error(...,{toast:true}) 或使用 `common/utils/notification.js` / 统一错误辅助工具（如 `WebSocketErrorHandler`、`notifyDomainError`）。
  - Plan 模式：AI 在执行任何会修改代码/文档/数据或运行具有写入/副作用的脚本前，必须先在对话中输出可审核的 Plan，并在用户明确确认后才能实际执行。
  - Memory Bank 压缩：当 `context.md` 超过 7 天记录或行数过多，或 `AItemp` 中出现超过 30 天的工作日志 / 文件数量过大时，必须按《Memory Bank 压缩机制规范》执行归档与压缩，禁止直接删除历史记录。
  - PyQt 前端窗口：优先复用 `src/frontend/common/pyqt` 与 `src/frontend/pyqtui` 中的公共工具（如 `qt_app_runner.py`、`ports_utils.py`、`BaseLoggingWebPage`），避免在各模块内重复实现 QApplication 启动与 JS 控制台日志逻辑。
  - PyQt 工具窗口 URL：`SimpleWebWindowApp` 仅允许透传 `client-id`；禁止通过 URL query 透传业务参数（如 `pdf-id`），业务初始化统一走 MsgCenter 消息。
  - 工具窗口单例：标注管理器 `anno-manager` 为强单例窗口，MsgCenter 打开时 client_id 固定为 `"anno-manager"`，重复打开仅激活窗口。

维护记录
- 2025-11-07 精简为索引版；详细内容迁移到 docs（见 todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md）。
 - 2025-11-07 接口调整：HighlightRenderer 构造签名由 `(pdfViewerManager, logger)` → `(logger)`；ScreenshotCapturer 构造签名由 `(pdfViewerManager)` → `()`；调用点与测试已同步。

## AI开发易错点索引（精简版）

- 本节是“规则导航版”，每条只保留标题 + 一句话解释 + docs 路径；完整用例与详细说明见 `docs/standards/ai-pitfalls.md`。
- P0 级（必须立即检查）：
  1. 事件名必须使用命名空间常量，禁止字符串字面量/变量/模板字符串。
  2. 禁止使用 `console.*`，统一通过 Logger 记录日志。
  3. 跨 Feature 调用必须通过 EventBus/Container，禁止直接 import 其他 Feature 内部实现。
  4. ScopedEventBus 内部使用 scoped 事件，跨 Feature 通信使用 global 事件，严禁混用作用域。
  5. 项目启动必须使用 `python ai_launcher.py start`，禁止直接 `npm run dev` 或裸 `python` 启动服务。
  6. WebSocket 只允许使用 PyQt 提供的实现，不得在前端或脚本中自行建立原生 WS 连接。
  7. 遵守 Fail‑Fast 原则：任何契约不匹配都必须抛错，禁止兜底默认值和静默吞错。
- P1 级（高频错误）：
  8. 单个代码文件行数不得超过 500 行，需通过职责拆分/提取 service/utils 等方式重构。
  9. Feature 类必须实现 name/version/dependencies/install/uninstall 等完整接口。
  10. 事件名必须严格为三段 `{module}:{action}:{status}`，多一段或少一段都视为错误。
  11. 全局事件必须先在白名单中注册，未登记的全局事件禁止发布。
  12. 测试文件必须放在 `__tests__` 目录，而不是与源文件同级。
  13. 测试必须使用 `beforeEach/afterEach` 清理状态，禁止测试之间共享可变状态。
  14. ESM 动态导入的 Mock 必须使用 `jest.unstable_mockModule`，`jest.mock` 无法拦截动态导入。
- P2 级（注意事项）：
  15. Python 必须使用虚拟环境，禁止全局环境直接安装依赖。
  16. 文件编码必须统一为 UTF‑8，且读写时显式使用 `\n` 换行。
  17. 事件订阅必须集中在 Feature 的 `install()` 阶段统一注册，避免在回调中动态订阅。
  18. 私有字段必须使用 `#` 前缀（ES 私有字段语法），不要使用 `_` 约定式私有字段。
  19. 测试策略采用“分段集成 + Flow Runner”替代 Playwright 浏览器 E2E。

## AI开发易错点速查（极易犯错清单）

本章节聚焦于**与常规开发习惯不同的项目特殊约定**，帮助AI避免高频错误。共16条核心易错点。

### 🔴 P0级（必须立即检查 - 违反会导致功能完全失效）
**7条关键约束**：事件名常量化、禁用console、Feature隔离、事件作用域、启动方式、WebSocket约束、**Fail-Fast原则**

#### 1. 事件名禁止字符串字面量 - 必须使用常量
- **位置**: `eslint.config.js:54`、`eslint-rules/event-name-format.js`、`eslint-rules/no-event-literal.js`
- **❌ 错误做法**:
  ```javascript
  eventBus.on('pdf:load:completed', handler);
  eventBus.emit('loadData', data);  // 非三段式
  const event = 'pdf:load:completed'; eventBus.emit(event, data);  // 使用变量
  eventBus.emit(`pdf:${action}:completed`, data);  // 模板字符串
  ```
- **✅ 正确做法**:
  ```javascript
  eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.COMPLETED, handler);
  eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.COMPLETED, data);
  ```
- **📍 检查方式**: 运行 `pnpm exec eslint src --max-warnings=0`，会报错 `custom/event-name-format` 和 `custom/no-event-literal`
- **💡 为什么不同**: 标准前端项目允许字符串事件名，本项目强制使用常量防止拼写错误和事件碎片化

#### 2. 禁止使用 console.* - 必须使用Logger
- **位置**: `src/frontend/common/utils/logger.js`、`eslint.config.js:83`
- **❌ 错误做法**:
  ```javascript
  console.log('数据加载完成', data);
  console.error('发生错误:', error);
  console.warn('警告');
  ```
- **✅ 正确做法**:
  ```javascript
  import { getLogger } from '../common/utils/logger.js';
  const logger = getLogger('ModuleName');
  logger.info('数据加载完成', data);
  logger.error('发生错误:', error, { toast: true });
  ```
- **📍 检查方式**: ESLint会报错 `no-console`，除了 `logger.js` 文件本身
- **💡 为什么不同**:
  - 统一日志格式，便于调试和追踪
  - 支持日志级别控制，生产环境可关闭debug
  - 日志会被PyQt捕获并保存到文件
  - 与PyQt集成，前后端日志统一管理

#### 3. Feature间禁止直接import - 必须通过EventBus或依赖注入
- **位置**: `src/frontend/HOW-TO-ADD-FEATURE.md`、`eslint-rules/no-cross-feature-internals.js`
- **❌ 错误做法**:
  ```javascript
  import { BookmarkFeature } from '../bookmark/index.js';
  const bookmarkFeature = new BookmarkFeature();
  import { helper } from '../other-feature/utils/helper.js';  // 跨Feature内部import
  ```
- **✅ 正确做法**:
  ```javascript
  // 方式1：通过EventBus通信
  eventBus.emitGlobal(BOOKMARK_EVENTS.ACTION.REQUESTED, data);

  // 方式2：通过Container获取服务
  const bookmarkManager = container.get('bookmarkManager');

  // 方式3：在dependencies中声明依赖
  get dependencies() { return ['bookmark']; }
  ```
- **📍 检查方式**: ESLint会报错 `custom/no-cross-feature-internals`
- **💡 为什么不同**: 插件架构要求Feature完全解耦，避免循环依赖和紧耦合

#### 4. 局部事件 vs 全局事件 - 严格区分作用域
- **位置**: `src/frontend/common/event/scoped-event-bus.js`、`CLAUDE.md`
- **❌ 错误做法**:
  ```javascript
  scopedEventBus.emit('pdf:file:loaded', data);  // 全局事件应用 emitGlobal
  scopedEventBus.on('pdf:file:loaded', handler);  // 应用 onGlobal
  scopedEventBus.onGlobal('@my-feature/data:loaded', handler);  // 全局事件不需要命名空间
  ```
- **✅ 正确做法**:
  ```javascript
  // Feature内部通信（自动添加 @feature-name/ 前缀）
  scopedEventBus.emit('data:load:completed', data);
  scopedEventBus.on('ui:refresh:requested', handler);

  // 跨Feature通信（不添加前缀）
  scopedEventBus.emitGlobal('pdf:file:loaded', data);
  scopedEventBus.onGlobal('pdf:file:loaded', handler);
  ```
- **📍 检查方式**: 运行时事件无法传递，控制台会显示"无订阅者"警告
- **💡 为什么不同**: 插件架构需要严格隔离，防止Feature间事件污染

#### 5. 项目启动禁止直接用 npm/python 命令 - 必须用 ai_launcher.py
- **位置**: `CLAUDE.md`、`ai_launcher.py`
- **❌ 错误做法**:
  ```bash
  npm run dev
  python app.py
  ```
- **✅ 正确做法**:
  ```bash
  # 启动所有服务
  python ai_launcher.py start

  # 检查服务状态
  python ai_launcher.py status

  # 停止所有服务
  python ai_launcher.py stop
  ```
- **📍 检查方式**: 直接npm run dev会导致终端阻塞，无法继续输入命令
- **💡 为什么不同**:
  - 自动管理多个服务的启动顺序（Vite、WebSocket、HTTP服务器）
  - 自动检测端口冲突
  - 后台运行，不阻塞终端
  - 统一日志管理

#### 6. WebSocket必须使用PyQt提供的实现 - 禁止其他库
- **位置**: `.kilocode/rules/memory-bank/tech.md:173-178`
- **❌ 错误做法**:
  ```python
  import websockets
  from websocket import WebSocketApp
  ```
  ```javascript
  const ws = new WebSocket('ws://localhost:8765');
  ```
- **✅ 正确做法**:
  ```python
  from PyQt6.QtWebSockets import QWebSocket, QWebSocketServer
  ```
- **📍 检查方式**: Code review或运行时出现连接问题
- **💡 为什么不同**: 与PyQt的事件循环集成，避免进程管理复杂性

#### 7. Fail-Fast 原则 - 禁止兜底，任何未预期行为必须报错
- **位置**: `.kilocode/rules/memory-bank/context.md:12`、核心规则第一条
- **❌ 错误做法**:
  ```javascript
  // ❌ 提供默认值兜底
  function loadConfig(data) {
    return data.config || { theme: 'light' };  // 禁止！
  }

  // ❌ 静默捕获错误并返回兜底值
  async function fetchData(id) {
    try {
      return await api.get(id);
    } catch (error) {
      console.log('获取失败，返回默认值');
      return { id, name: 'Unknown' };  // 禁止！
    }
  }

  // ❌ 参数校验失败后使用默认值
  function setPage(page) {
    if (page < 1) page = 1;  // 禁止！应该报错
    this.currentPage = page;
  }

  // ❌ 可选链 + 空值合并提供兜底
  const name = user?.profile?.name ?? 'Guest';  // 慎用！确保有明确业务语义
  ```
- **✅ 正确做法**:
  ```javascript
  // ✅ 数据不合法立即报错
  function loadConfig(data) {
    if (!data || !data.config) {
      throw new Error('Invalid config data: missing config field');
    }
    return data.config;
  }

  // ✅ 错误向上抛出，不静默处理
  async function fetchData(id) {
    if (!id) {
      throw new Error(`Invalid id: ${id}`);
    }
    // 不捕获，让错误向上传播
    return await api.get(id);
  }

  // ✅ 参数不合法立即报错
  function setPage(page) {
    if (page < 1) {
      throw new Error(`Invalid page number: ${page}. Must be >= 1`);
    }
    this.currentPage = page;
  }

  // ✅ 必需字段缺失时报错
  function getUsername(user) {
    if (!user?.profile?.name) {
      throw new Error('User profile name is required');
    }
    return user.profile.name;
  }
  ```
- **📍 检查方式**: Code review检查是否有 `|| defaultValue`、`try-catch + 返回默认值`、参数校验后自动修正等模式
- **💡 为什么不同**:
  - **标准做法**：前端常用兜底逻辑提升"健壮性"（如 `data || []`、`catch + 返回默认值`）
  - **本项目要求**：契约不匹配必须失败，快速暴露问题，便于调试和追踪
  - **核心理念**：问题要"尽早失败、大声失败"，不要被掩盖
  - **例外情况**：仅在有明确业务语义时才允许默认值（如"未登录用户显示Guest"），必须有注释说明

---

### 🟡 P1级（高频错误 - 会导致部分功能异常）

#### 8. 单个代码文件行数不能超过500行 - 必须拆分重构
- **位置**: `.kilocode/rules/memory-bank/tech.md:12`
- **❌ 错误做法**:
  ```javascript
  // my-feature.js (800行)
  export class MyFeature {
    // 100行的字段定义
    // 200行的事件处理
    // 300行的业务逻辑
    // 200行的辅助方法
  }
  ```
- **✅ 正确做法**:
  ```javascript
  // my-feature/index.js (150行) - 主入口
  export class MyFeature {
    get name() { return 'my-feature'; }
    async install(context) { ... }
  }

  // my-feature/services/data-service.js (200行) - 数据服务
  export class DataService { ... }

  // my-feature/components/ui-manager.js (180行) - UI管理
  export class UIManager { ... }

  // my-feature/utils/helpers.js (120行) - 工具函数
  export function formatData() { ... }

  // my-feature/constants.js (80行) - 常量定义
  export const CONFIG = { ... };
  ```
- **📍 检查方式**: 使用 `wc -l <file>` 或编辑器行数显示
- **💡 为什么不同**:
  - 标准做法：很多项目允许单文件超过1000行
  - 本项目要求：强制模块化，提高可维护性和可读性
  - 合理拆分方式：
    * 按职责拆分：将一个大Feature拆分为多个职责单一的类
    * 提取服务层：将业务逻辑提取到独立的 service 文件
    * 分离UI和逻辑：将UI组件和业务逻辑分离
    * 提取工具函数：将通用函数提取到 utils 目录
    * 分离常量和配置：将常量、配置项提取到独立文件
  - 例外情况：生成代码（如从schema生成的类型定义）可以豁免，但需要在文件头注释说明

#### 9. Feature类必须实现4个接口 - 缺一不可
- **位置**: `src/frontend/HOW-TO-ADD-FEATURE.md`
- **❌ 错误做法**:
  ```javascript
  export class MyFeature {
    async install(context) { ... }  // 缺少name、version、dependencies
  }
  ```
- **✅ 正确做法**:
  ```javascript
  export class MyFeature {
    get name() { return 'my-feature'; }         // 必须
    get version() { return '1.0.0'; }           // 必须
    get dependencies() { return []; }           // 必须
    async install(context) { ... }              // 必须
    async uninstall(context) { ... }            // 必须（可以为空实现）
  }
  ```
- **📍 检查方式**: FeatureRegistry.installAll()会报错"missing required getter"
- **💡 为什么不同**: 插件模式需要元数据来管理生命周期和依赖

#### 10. 事件名必须正好3段 - 不能多也不能少
- **位置**: `src/frontend/common/event/event-bus.js:33-40`
- **❌ 错误示例**:
  ```javascript
  'loadData'                 // 只有1段
  'pdf:loaded'               // 只有2段
  'pdf:list:data:loaded'     // 4段
  ```
- **✅ 正确示例**:
  ```javascript
  'pdf:load:completed'       // 正好3段
  'bookmark:toggle:requested' // 正好3段
  ```
- **📍 检查方式**: EventBus会在运行时阻止发布，控制台显示详细错误
- **💡 为什么不同**: 强制三段式 `{module}:{action}:{status}` 统一命名规范

#### 11. Vite代理目标必须用 127.0.0.1 - 不能用 localhost
- **位置**: `vite.config.js:91`、`.kilocode/rules/memory-bank/context.md:59`
- **❌ 错误做法**:
  ```javascript
  proxy: {
    '/pdfs': {
      target: 'http://localhost:8080',  // Windows会解析为IPv6
    }
  }
  ```
- **✅ 正确做法**:
  ```javascript
  proxy: {
    '/pdfs': {
      target: 'http://127.0.0.1:8080',  // 明确使用IPv4
    }
  }
  ```
- **📍 检查方式**: Vite代理请求失败，控制台显示ECONNREFUSED
- **💡 为什么不同**: Windows环境下localhost行为不一致（DNS优先解析为IPv6 ::1）

#### 12. 全局事件必须在白名单注册 - 否则无法发布
- **位置**: `src/frontend/common/event/global-event-registry.js`
- **❌ 错误做法**:
  ```javascript
  // 新事件未在白名单中，发布会被阻止
  eventBus.emit(NEW_EVENT.REQUESTED, data);  // 运行时报错
  ```
- **✅ 正确做法**:
  ```javascript
  // 先在 global-event-registry.js 中注册
  const GLOBAL_EVENTS = new Set([
    'pdf:file:loaded',
    'bookmark:create:completed',
    'new:event:requested',  // 新增事件
  ]);
  ```
- **📍 检查方式**: EventBus会报错"未注册的全局事件，已被禁止发布"
- **💡 为什么不同**: 防止事件滥用，强制契约化管理

#### 13. 测试文件必须放在 __tests__ 目录 - 不能与源文件同级
- **位置**: `docs/TESTING-UNIT-GUIDE.md`、`CLAUDE.md` 测试规范章节
- **❌ 错误做法**:
  ```
  src/frontend/common/event/
  ├── event-bus.js
  └── event-bus.test.js        // ❌ 错误位置！
  ```
- **✅ 正确做法**:
  ```
  src/frontend/common/event/
  ├── event-bus.js
  └── __tests__/
      └── event-bus.test.js     // ✅ 正确位置！
  ```
- **📍 检查方式**: 查看测试文件是否在 `__tests__/` 子目录
- **💡 为什么不同**: Jest 配置约定，便于批量运行和覆盖率统计

#### 14. 测试必须用 beforeEach 清理状态 - 禁止测试间依赖
- **位置**: `CLAUDE.md` 测试规范章节
- **❌ 错误做法**:
  ```javascript
  let manager;
  test('test 1', () => {
    manager = new Manager();
    manager.data = [1, 2, 3];
    expect(manager.data.length).toBe(3);
  });
  test('test 2', () => {
    // ❌ manager 仍然是上个测试的实例！
    expect(manager.data.length).toBe(0);  // 失败！
  });
  ```
- **✅ 正确做法**:
  ```javascript
  let manager;
  beforeEach(() => {
    manager = new Manager();  // 每个测试都创建新实例
  });
  afterEach(() => {
    manager = null;  // 清理
  });
  test('test 1', () => {
    manager.data = [1, 2, 3];
    expect(manager.data.length).toBe(3);
  });
  test('test 2', () => {
    expect(manager.data).toEqual([]);  // ✅ 成功！
  });
  ```
- **📍 检查方式**: 测试顺序打乱后仍然通过
- **💡 为什么不同**:
  - 标准做法：很多项目允许测试间共享状态
  - 本项目要求：每个测试必须独立，避免顺序依赖
  - 核心理念：测试失败应该只反映代码问题，不是测试顺序问题

#### 15. ESM 动态导入 Mock 必须用 jest.unstable_mockModule - 不能用 jest.mock
- **位置**: `CLAUDE.md` 测试规范章节、`tech.md:488`
- **❌ 错误做法**:
  ```javascript
  jest.mock('pdfjs-dist/build/pdf');  // ❌ 不生效！
  const { PDFManager } = await import('../pdf-manager.js');
  ```
- **✅ 正确做法**:
  ```javascript
  beforeEach(async () => {
    jest.unstable_mockModule('pdfjs-dist/build/pdf', () => ({
      getDocument: jest.fn(() => ({
        promise: Promise.resolve({ numPages: 10 })
      }))
    }));
    const { PDFManager } = await import('../pdf-manager.js');
    manager = new PDFManager();
  });
  ```
- **📍 检查方式**: Mock 未生效时，测试会因真实模块加载失败而报错
- **💡 为什么不同**:
  - 标准做法：jest.mock 适用于 CommonJS 模块
  - 本项目要求：ESM 动态导入必须用 jest.unstable_mockModule
  - 原因：pdfjs-dist 等库使用动态导入，jest.mock 无法拦截

---

### 🟢 P2级（注意事项 - 提醒即可，不易出错）

#### 16. Python必须使用虚拟环境 - 禁止全局环境
- **位置**: `.kilocode/rules/memory-bank/architecture.md:11`、`docs/architecture/environment.md`
- **✅ 正确做法**:
  ```bash
  # 创建虚拟环境
  python -m venv .venv

  # 激活虚拟环境（Windows）
  .venv\Scripts\activate

  # 激活虚拟环境（Linux/Mac）
  source .venv/bin/activate
  ```
- **📍 检查方式**: 查看 `.venv/` 目录是否存在
- **💡 为什么不同**: 避免依赖冲突和环境污染

#### 17. 文件编码必须 UTF-8 + 换行符必须 \n - 禁止CRLF
- **位置**: `.kilocode/rules/memory-bank/context.md:10`
- **❌ 错误做法**:
  ```python
  open('file.txt')  # 没有指定encoding
  ```
- **✅ 正确做法**:
  ```python
  open('file.txt', 'r', encoding='utf-8', newline='\n')
  ```
- **📍 检查方式**: Git会显示整个文件都是diff（行尾符不同）
- **💡 为什么不同**: Fail-Fast原则，统一跨平台行为

#### 18. 订阅事件必须在 install() 中集中管理
- **位置**: `.kilocode/rules/memory-bank/context.md:46-51`
- **❌ 错误做法**:
  ```javascript
  #handleEvent(data) {
    // 在回调中动态订阅
    this.#eventBus.on(ANOTHER_EVENT, handler);
  }
  ```
- **✅ 正确做法**:
  ```javascript
  async install(context) {
    this.#setupEventListeners();  // 所有订阅集中在这里
  }

  #setupEventListeners() {
    this.#eventBus.on(EVENT, handler, {
      subscriberId: 'FeatureName-purpose'
    });
  }
  ```
- **📍 检查方式**: 运行时报错"重复订阅检测"
- **💡 为什么不同**: 防止重复订阅和内存泄漏

#### 19. 私有字段必须用 # 前缀 - 不要用 _ 前缀
- **位置**: Babel配置支持私有字段
- **❌ 错误做法**:
  ```javascript
  class MyClass {
    _privateField = null;  // 约定式私有
  }
  ```
- **✅ 正确做法**:
  ```javascript
  class MyClass {
    #privateField = null;  // 真正的私有字段
  }
  ```
- **📍 检查方式**: Code review
- **💡 为什么不同**: 使用ES2022标准的私有字段语法

#### 20. 测试策略：放弃Playwright - 使用分段集成
- **位置**: `docs/TESTING-OVERVIEW.md`、`.kilocode/rules/memory-bank/context.md:68`
- **✅ 正确做法**: Node/Jest前端段 + PyTest后端段 + Flow Runner编排
- **📍 检查方式**: 查看 `tests/e2e/` 目录结构
- **💡 为什么不同**: 无浏览器依赖，更快更稳定

---

### 🔧 快速自检命令

```bash
# ESLint检查（会捕获P0/P1级错误）
pnpm exec eslint src --max-warnings=0

# 测试检查
pnpm test

# 服务状态检查
python ai_launcher.py status
```

---

### 📚 相关文档

- 事件系统详解：`src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md`
- Feature开发指南：`src/frontend/HOW-TO-ADD-FEATURE.md`
- 架构深度解析：`src/frontend/ARCHITECTURE-EXPLAINED.md`
- 事件追踪调试：`src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md`

---

## ESLint 使用规则（团队标准）

- 扫描范围与命令
  - 范围：src（包含产品代码与测试）；不针对第三方依赖执行。
  - 基准命令（严格门禁，0 容忍）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --max-warnings=0 --report-unused-disable-directives`
  - 自动修复（仅限格式类规则；业务契约类需人工）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --fix`
  - 生成报告（可选）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --format json > AItemp/reports/eslint-report-YYYYMMDDHHmmss.src.json`

- 关键门禁（全部按 error 报告）
  - 自定义规则
    - custom/event-name-format：事件名必须来自命名空间常量（*_EVENTS、*_MESSAGE_TYPES、PDF_VIEWER_EVENTS、WEBSOCKET_EVENTS）；禁止字符串字面量、变量、模板字符串作为事件名。
    - custom/no-event-literal：同上，禁止直接使用字符串事件。
    - custom/logger-toast-shape：`{ toast }` 形状受限；`toast.type` 仅允许 'error' | 'warn' | 'info' | 'success' | 'debug'。
  - 内置规则
    - no-console：严禁使用；统一使用内部 logger。仅 logger.js 允许 console（见 overrides）。
    - no-unused-vars / no-unused-private-class-members：禁止未使用的变量/私有成员。不要用 `_` 作为占位逃避检查；应删除或实际使用。
    - no-undef：禁止未定义标识符（典型如 `catch { ... e }` 误用）。
    - no-redeclare：禁止重复声明。
    - 风格相关：no-trailing-spaces、no-multiple-empty-lines、eol-last 等。

- Overrides 与豁免点（仅限以下文件/场景）
  - logger 实现文件（如 common/utils/logger.js）：允许 console（rule: off）；其他文件一律禁止。
  - 事件总线内核与工具（event-bus 实现层）：允许关闭 custom/event-name-format 与 no-event-literal（用于框架内生成/透传）；业务与测试代码仍必须遵守事件常量门禁。
  - 测试代码：遵循与产品代码一致的事件门禁与 no-console；可根据需要开启 Jest 环境声明，但不得放宽自定义事件规则。

- 提交流程与 CI 门禁
  - 提交前本地必跑：同“基准命令”；`--max-warnings=0` 强制中断有风险的提交。
  - CI 保底：同一条命令；报告按时间戳落地到 `AItemp/reports/`，用于排障归档。

- 常见修复指引
 - 事件名：将 `on("x-y-z", handler)` 等字符串/变量，替换为命名空间常量 `on(PDF_VIEWER_EVENTS.X.Y.Z, handler)`；模板字符串/变量拼接一律禁止。
  - 捕获错误：不使用 `catch () {}` 或 `catch(_) {}` 这类占位写法；若不使用错误对象，写 `catch { ... }`；若要使用则 `catch (e) { ... }` 并实际引用 e。
  - 未用变量/参数：删除变量或使用之；请勿通过 `_` 命名或注释规避。
  - 日志：使用模块级 `getLogger("ModuleName")`；禁止在功能代码中使用 `console.*`。

 - 约定与产物
  - Lint 运行与报告输出，务必写入 AItemp/reports（禁止污染根目录）。
  - 与本文档描述不一致的需求变更，须先更新 `eslint.config.js` 与本节说明，再执行大范围治理。
 - 2025-11-07 约束补充：新增 WS 响应常量使用规范与静态扫描测试，防止 `RESPONSE` 常量误用。

## 阅读历史（Resume Reading）使用说明（2025-11-10 更新：服务端持久化）
- 启动参数
  - `resumeReading.enabled: boolean`（默认 `true`）
  - `resumeReading.applyMode: "ifNoExplicitJump" | "always" | "disabled"`（默认 `ifNoExplicitJump`）
  - `resumeReading.throttleMs: number`（默认 `2500`）
  - `resumeReading.transport: "ws"`（默认 `ws`）
- 服务端字段
  - `pdf_info.json_data.resume: { page: number, y_percent?: number, zoom?: number, rotation?: number, updated_at: ms }`
- 读写消息（WS）
  - 读取：`{ type: "pdf-library:info:requested", data: { pdf_id } }`
  - 写入：`{ type: "pdf-library:record-update:requested", data: { file_id: pdf_uuid, updates: { visited_at, json_data: { resume: { ... } } } } }`
- 优先级（显式跳转 > resume > 首页）
  - URL/WS/Anchor 显式导航优先；满足条件时才应用 resume。
- 错误处理（Fail‑Fast）
  - resume 非法（越界/比例无效）→ toast + 回首页；不启用默认本地兜底（如需兜底须显式配置）。

## 测试运行规范（Jest / PyTest / Flow Runner）
- Jest
  - 入口：`pnpm test` 或 `pnpm exec jest`。
  - Babel：`jest.config.js` 使用 `babel-jest`，并显式传入绝对路径 `babel.jest.config.cjs`（避免在不同 CWD/根解析失败）。
  - 排除：`testPathIgnorePatterns` 排除 `tests/e2e/`，E2E 不由 Jest 执行。
  - 报告：`--json --outputFile test-results/jest-results-YYYYMMDDHHMMSS.json`；概览可落地到 `AItemp/reports/jest-summary-*.md`。
  - Mock（建议）：对 ESM 动态导入模块（如 `pdfjs-dist/build/pdf`）优先使用 `jest.unstable_mockModule`；或在实现中为 Jest 提供 CJS `require()` 分支，确保 `doMock` 生效。
- PyTest
  - 入口：`node tests/e2e/runner/run-py-step.mjs <pytest-file>`（runner 以 `python_exe` 绝对路径调用）。
  - 报告：建议将断言关键截取写入 `AItemp/flows/.../step-PY*.json`。
- Flow Runner（编排器）
  - 入口：`node tests/e2e/runner/run-flows.mjs --config tests/e2e/config/local.json --flows <pattern>`
  - 作用：按注册的步骤顺序串联 F/N/PY/CT，并聚合 `AItemp/reports/e2e/<run_id>/summary.json`。

## 事件总线错误可观测性（订阅/发布）
- event-bus 增强：
  - 在 `on()` 与 `emit()` 的“未注册/无效事件”错误路径附带订阅者/执行者ID与调用栈（前5帧），便于快速定位来源；
  - 在 `on()` 中订阅者ID推断提前于白名单校验，保证日志携带订阅者ID。


## Toast 引擎调试开关（2025-11-08）
- `window.__DISABLE_TOAST_FALLBACK`：布尔；默认 true（禁用 fallback，仅用 izitoast）；设为 false 可恢复降级路径。
- 影响范围：`src/frontend/common/utils/thirdparty-toast.js`。

## Outline 调试日志开关（2025-11-08）
- URL 参数：`?outlineLog=debug|info|warn|error`
- 默认：ERROR（在 `app-bootstrap-feature.js` 中先设置为 ERROR，再按参数提升）
- 影响模块：`Feature.pdf-outline`、`OutlineSidebarUI`、`OutlineManager`

## Python后端事件常量使用规范（2025-11-10）
- 背景：后端数据库插件使用四段式事件名 `table:{table-name}:{action}:{status}`
- 强制要求：禁止使用字符串字面量，必须使用常量
- 常量位置：`src/backend/database/plugin/table_event_constants.py`
- 使用示例：
  ```python
  from src.backend.database.plugin import TableEventConstants

  # ❌ 错误：使用字符串字面量
  event_bus.on('table:pdf-info:delete:completed', handler)

  # ✅ 正确：使用常量
  event_bus.on(TableEventConstants.PDFInfo.DELETE_COMPLETED, handler)
  ```
- 常量结构：
  ```python
  class TableEventConstants:
      class PDFInfo:
          CREATE_COMPLETED: Final[str] = 'table:pdf-info:create:completed'
          CREATE_FAILED: Final[str] = 'table:pdf-info:create:failed'
          UPDATE_COMPLETED: Final[str] = 'table:pdf-info:update:completed'
          # ...
      class PDFAnnotation:
          CREATE_COMPLETED: Final[str] = 'table:pdf-annotation:create:completed'
          # ...
  ```
- Pylint检查：
  - 错误代码：E9001 (table-event-string-literal)
  - 检查范围：`event_bus.on/emit/once()` 的第一个参数
  - 智能提示：自动推荐对应的常量名
  - 白名单：`event_bus.py`、`table_event_constants.py` 不检查
- 运行检查：
  ```bash
  cd src/backend
  export PYTHONPATH=.
  python -m pylint \
    --load-plugins=linters.table_event_lint_checker \
    --enable=E9001 \
    --disable=all \
    database/plugins/*.py
  ```
- CI集成建议：
  - 在 `pyproject.toml` 或 `.pylintrc` 中启用 E9001 规则
  - 在 pre-commit hooks 中运行检查
  - 在 CI/CD 流程中作为质量门禁
- 向后兼容：
  - 保留 `TableEvents` 辅助类（动态生成事件名）
  - 仅在跨插件事件监听时强制使用常量
  - 插件内部的 `_emit_event()` 可继续使用辅助函数

### 2025-11-13 WebSocket 使用约束（强制）
- 禁止使用非 PyQt 提供的 WebSocket 实现；包括但不限于：Python `websockets/websocket-client`、Node `ws`、浏览器原生 `WebSocket` 直连等。
- 如需使用 WebSocket 功能，必须使用 PyQt 的 QtWebSockets 能力（如 `QWebSocket`/`QWebSocketServer`），并由 PyQt 进程统一托管连接的生命周期、重连与安全策略。
- 前端/脚本若需要消息通信，应通过 PyQt 提供的桥接（如信号/槽、`QWebChannel` 或 PyQt 封装的适配层）进行转发，禁止自行建立 WS 连接。
- 迁移提示（存量代码）：将所有直连 WS 的调用替换为 PyQt 封装接口；若无现成封装，先补充 PyQt 侧 API，再调整调用方。测试需覆盖连接、发送/接收、超时与错误分支（Fail‑Fast，无兜底）。
- 编码一致：仍强制显式 UTF‑8 与统一换行 `\\n`；出现不合规实现视为错误（CI/测试应拦截）。

## MsgCenter 转发与客户端身份原则

- MsgCenter 不仅负责 pdf-viewer 导航消息的转发, 也统一管理 pdf-home / pdf-viewer 的窗口启动: 所有窗口启动请求都应通过 WebSocket 消息(如 pdf-home:open:requested, pdf-library:viewer:requested) 进入 MsgCenter, 再由 BackendLauncher 统一决策.
- 启动类消息必须携带 is_prod 标记(data.is_prod=true|false), BackendLauncher._on_msgcenter_message 根据该标记与 logs/runtime-ports.json 中的 vite_port 决定前端使用 dev(vite) 还是 prod(静态) 入口; 禁止在 GUI 或前端自行硬编码端口.
- runtime-ports.json 仍是 Vite / MsgCenter / PDF 文件服务器端口的唯一真源, MsgCenter/BackendLauncher 仅在 dev 模式下解析 vite_port, prod 模式一律以静态端口为准.
- HTML 层的 WSClient 在 MsgCenter 侧必须使用新协议的 `client:register:requested` 注册：
  - `data.client_id = "pdf-viewer-<pdf_id>"`（作为导航与路由的唯一身份 ID）；
  - `data.client_type` 至少包含 `"window:pdf-viewer:<pdf_id>"` 与 `"editable"`；
  - `data.capabilities` 应覆盖 `"navigation"|"annotation"|"bookmark"|"outline"` 等核心能力；
  - `data.metadata.pdf_id = "<pdf_id>"`；
  - Hosted 模式下的 PyQt 启动窗口仍通过 WindowLifecycleManager 以同一个 ID 管理窗口与 ws-client 槽位，但不再使用相同 ID 的新协议注册，以避免在 MsgCenter 侧出现 `CLIENT_ID_EXISTS` 误报。

## 2025-12-03：pdf-anchor 与 pdf-resume 的位置追踪统一

- 位置追踪实现：统一由 `src/frontend/pdf-viewer/shared/position-tracker.js` 提供；该模块基于 `viewerContainer` + 可选 `DomEventHub` 监听 `wheel/click/scroll`，通过 `onPositionChange(pageAt, position)` 向上层 Feature 报告位置变更，并内置去抖动与 `freezeFor(ms)` 冻结能力。
- pdf-resume：`PDFResumeFeature` 在安装时创建 `PositionTracker`，在位置变更回调中更新 `ResumeUpdater` 的页码，并采用“1 秒节流 + WS record-update:requested”的方式写入 `json_data.resume`，导航恢复时调用 `freezeFor(3000)` 防止刚跳转即被覆盖。
- pdf-anchor：`PDFAnchorFeature` 现在也创建自己的 `PositionTracker` 实例，并在内部维护 `#activeAnchorId`：
  - 只有当存在激活锚点时才处理位置变更回调；
  - 以 1 秒节流的方式调用 `ANCHOR.UPDATE/ANCHOR.UPDATED` 事件写回锚点的 `page_at/position`；
  - 导航到锚点（`ANCHOR.NAVIGATE.REQUESTED` → `#navigateToAnchor`）时调用 `positionTracker.freezeFor(3000)`，防止导航过程中立刻回写错误位置；
  - 取消激活（`ANCHOR.ACTIVATE(active:false)`）仅清空 `#activeAnchorId`，PositionTracker 保持激活但不会再对任何锚点写入位置。
- 约束：
  - 禁止在 pdf-anchor 中重新引入独立的心跳定时器或手写 DOM `scroll` 监听来做位置采样；新的代码必须通过 PositionTracker 或 `getCurrentPageAndPosition(container)` 获取位置。
  - 任何新 Feature 若需要基于滚动/位置做写回，应优先复用 PositionTracker，而不是复制一套 position 计算逻辑。

## 2025-12-04：三类前端工具窗口的 API 预留约定

- Custom Reviewer（定制卡片复习器）
  - 与 Anki 的交互必须通过明确的 API/消息完成，前端窗口不直接读取 Anki 数据库文件；
  - 需要预留的关键接口示例（具体协议后续在 SPEC 中细化）：
    - `card_html:get:requested`：按 card_id（或 note_id+card_type）获取可直接嵌入的 HTML 片段，用于主显示区渲染；
    - `card_review:submit:requested`：提交复习结果（again/good/easy 等），由后端负责更新调度与统计；
    - `card_edit:open:requested`：请求在 Anki 或专用编辑器中打开某张卡片；
  - 每个 Custom Reviewer 窗口使用独立 client_id（如 `custom-reviewer-<uuid>`），所有消息通过 MsgCenter 路由，避免多窗口状态互相污染。

- 新卡片规划器（Batch Card Planner）
  - 对外暴露“操作卡片草稿结构”的抽象 API，而不是与某个具体布局耦合，例如：
    - `draft_card:create/update/delete`、`draft_face:add/remove`、`draft_content:add/remove/reorder`；
    - 这些操作应可被树状视图、文件浏览器视图、表格视图等多种 UI 复用。
  - 针对“拖放标注/大纲/锚点”和“Ctrl+V 识别 ID”的需求，需在前端建立统一的“引用解析器”模块，负责将任意输入解析成标准引用对象 `{ kind: 'annotation'|'outline'|'anchor', id: '...' }`，再交给规划器内部模型处理。

- 标注管理器（Annotation Manager）
  - 作为“标注与关系数据”的聚合入口，对外提供统一查询 API，例如：
    - `annotation_query:search`（支持条件：来源 PDF、tag、是否有卡片、时间范围等）；
    - `annotation_query:related`（返回某标注的一跳/多跳邻居，包括 PDF / Card / 其他标注）。
  - UI 层的多种布局（列表/树/导图等）应基于这些查询 API 构建，不直接拼写 SQL 或访问底层表结构，确保后续可以在后端调整表设计而不影响前端调用。
  - 启动路径：
    - GUI Launcher：按钮 → 通过 MsgCenter `app-window:open:requested` 打开 `window_type="anno-manager"` 的 Hosted 窗口（client_id 固定为 `anno-manager`，由 BackendLauncher 通过 WindowLifecycleManager 管理生命周期）；
    - pdf-viewer 内部：标注侧栏 Header 方框按钮通过 `PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED` 事件发起请求，由 WebSocketAdapter 统一封装 `WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_OPEN_REQUESTED` 消息，消息体 `data = { client_id: "anno-manager", window_type: "anno-manager", params: { pdf_id } }`，交由 MsgCenter/BackendLauncher 打开或激活标注管理器窗口。

## 2026-01-04：测试与门禁用法更新（RUN_E2E / lint 集成）

- Python E2E（pytest）：
  - `tests/e2e/**` 默认不会在 `python -m pytest` 全量中执行（避免依赖外部进程/历史工件导致误报）。
  - 需要执行 E2E 时：设置环境变量 `RUN_E2E=1`。
  - e2e runner：`tests/e2e/runner/run-py-step.mjs` 已自动注入 `RUN_E2E=1`（使用 `pnpm` 的 e2e flow 不受影响）。
- 前端行数门禁（≤500）：
  - 已纳入 `pnpm run lint`（先跑 `lint:memory-bank`，再跑 `ci:frontend-line-limit`，再跑 eslint）。
  - baseline 文件：`scripts/ci/baselines/frontend-line-limit.json`（仅记录当前仍 >500 的文件；拆分完成后可再次 `pnpm run ci:frontend-line-limit:write-baseline` 继续收敛）。
