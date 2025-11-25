# AI 开发易错点详解（Kilocode Memory Bank 补充说明）

> 本文档承载详细用例与解释，memory-bank 中仅保留规则索引和一行摘要。
> 规则来源：`.kilocode/rules/memory-bank/tech.md` 中“AI开发易错点速查（极易犯错清单）”。

## 🔴 P0级（必须立即检查 - 违反会导致功能完全失效）

### 1. 事件名禁止字符串字面量 —— 必须使用常量

- 位置：`eslint.config.js`、`eslint-rules/event-name-format.js`、`eslint-rules/no-event-literal.js`
- 错误示例：

```javascript
eventBus.on('pdf:load:completed', handler);
eventBus.emit('loadData', data);                  // 非三段式
const event = 'pdf:load:completed';
eventBus.emit(event, data);                       // 使用变量
eventBus.emit(`pdf:${action}:completed`, data);   // 模板字符串
```

- 正确示例：

```javascript
eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.COMPLETED, handler);
eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.COMPLETED, data);
```

- 检查方式：`pnpm exec eslint src --max-warnings=0` 会报错 `custom/event-name-format` / `custom/no-event-literal`。
- 为什么不同：标准项目可以随意用字符串事件名，本项目强制常量化，避免拼写错误和事件碎片化。

### 2. 禁止使用 console.* —— 必须使用 Logger

- 位置：`src/frontend/common/utils/logger.js`、`eslint.config.js`
- 错误示例：

```javascript
console.log('数据加载完成', data);
console.error('发生错误:', error);
console.warn('警告');
```

- 正确示例：

```javascript
import { getLogger } from '../common/utils/logger.js';
const logger = getLogger('ModuleName');

logger.info('数据加载完成', data);
logger.error('发生错误:', error);
logger.warn('警告');
```

- 检查方式：ESLint `no-console`。
- 为什么不同：统一日志入口，支持 toast / 文件日志 / 调试开关等扩展。

### 3. 跨 Feature 调用必须通过 EventBus —— 禁止直接 import 内部实现

- 位置：`HOW-TO-ADD-FEATURE.md`、`ARCHITECTURE-EXPLAINED.md`、`CLAUDE.md`
- 错误示例（跨 Feature 直接 import）：

```javascript
// ❌ pdf-home 直接 import pdf-viewer 的内部模块
import { PdfViewerSidebar } from '../pdf-viewer/features/sidebar/index.js';
```

- 正确示例（通过 EventBus 协作）：

```javascript
// pdf-home 中仅通过事件与 pdf-viewer 协作
eventBus.emitGlobal(PDF_VIEWER_EVENTS.FILE.OPEN.REQUESTED, { pdfId });
```

- 为什么不同：项目使用插件化架构，Feature 间依赖必须显式，通过 EventBus/Container 管理，避免循环依赖与代码碎片化。

### 4. 事件作用域必须一致 —— scoped vs global 不能混用

- 位置：`src/frontend/common/event/scoped-event-bus.js`、`CLAUDE.md`
- 错误示例：

```javascript
scopedEventBus.emit('pdf:file:loaded', data);      // 应该用 emitGlobal
scopedEventBus.on('pdf:file:loaded', handler);     // 应该用 onGlobal
scopedEventBus.onGlobal('@my-feature/data:loaded', handler); // 全局事件不需要命名空间
``>

- 正确示例：

```javascript
// Feature 内部通信（自动加 @feature-name/ 前缀）
scopedEventBus.emit('data:load:completed', data);
scopedEventBus.on('ui:refresh:requested', handler);

// 跨 Feature 通信（无前缀）
scopedEventBus.emitGlobal('pdf:file:loaded', data);
scopedEventBus.onGlobal('pdf:file:loaded', handler);
```

- 检查方式：运行时出现“无订阅者”或作用域错乱。
- 为什么不同：ScopedEventBus 通过前缀隔离各 Feature，避免事件名称污染全局命名空间。

### 5. 项目启动必须用 ai_launcher.py —— 禁止直接 npm/python 启动

- 位置：`CLAUDE.md`、`ai_launcher.py`
- 错误示例：

```bash
npm run dev
python app.py
```

- 正确示例：

```bash
# 启动所有服务
python ai_launcher.py start

# 查看状态
python ai_launcher.py status

# 停止所有服务
python ai_launcher.py stop
```

- 为什么不同：统一管理 Vite / WebSocket / HTTP 等服务的启动顺序、端口分配与日志，避免终端阻塞与环境不一致。

### 6. WebSocket 必须使用 PyQt 提供的实现 —— 禁止其它 WS 客户端

- 位置：`.kilocode/rules/memory-bank/tech.md`、`docs/TECH/WS-MESSAGE-ROUTING-GUIDE.md`
- 错误示例：

```python
import websockets
from websocket import WebSocketApp
```

```javascript
const ws = new WebSocket('ws://localhost:8765');
```

- 正确示例：

```python
from PyQt6.QtWebSockets import QWebSocket, QWebSocketServer
```

- 为什么不同：项目要求由 PyQt 统一托管 WS 生命周期与事件循环，避免多进程 / 多事件循环导致的资源与连接管理混乱。

### 7. Fail-Fast 原则 —— 禁止兜底，未预期行为必须报错

- 位置：`.kilocode/rules/memory-bank/context.md`
- 错误示例（兜底默认值）：

```javascript
function loadConfig(data) {
  return data.config || { theme: 'light' };  // 禁止！
}
```

- 正确示例（立即报错）：

```javascript
function loadConfig(data) {
  if (!data || !data.config) {
    throw new Error('Invalid config data: missing config field');
  }
  return data.config;
}
```

- 说明：
  - 标准前端会用各种 default value 提升“健壮性”，但会掩盖契约错误；
  - 本项目要求“尽早失败、大声失败”，便于快速发现与修复问题；
  - 仅在有明确业务语义时才允许默认值（如“未登录用户显示 Guest”），并需注释说明。

## 🟡 P1级（高频错误 - 会导致部分功能异常）

### 8. 单个代码文件不能超过 500 行 —— 必须拆分重构

- 位置：`.kilocode/rules/memory-bank/tech.md`
- 错误示例（800 行大文件）：

```javascript
// my-feature.js (800行)
export class MyFeature {
  // 100行的字段定义
  // 200行的事件处理
  // 300行的业务逻辑
  // 200行的辅助方法
}
```

- 正确拆分示例：

```javascript
// my-feature/index.js (150行) - 主入口
export class MyFeature {
  get name() { return 'my-feature'; }
  async install(context) { ... }
}

// my-feature/services/data-service.js (200行) - 数据服务
export class DataService { ... }

// my-feature/components/ui-manager.js (180行) - UI 管理
export class UIManager { ... }

// my-feature/utils/helpers.js (120行) - 工具函数
export function formatData() { ... }

// my-feature/constants.js (80行) - 常量定义
export const CONFIG = { ... };
```

- 为什么不同：强制模块化，降低单文件复杂度，方便测试和重构。

### 9. Feature 类必须实现完整接口 —— name/version/dependencies/install/uninstall

- 位置：`src/frontend/HOW-TO-ADD-FEATURE.md`
- 错误示例：

```javascript
export class MyFeature {
  async install(context) { ... }  // 缺少 name/version/dependencies/uninstall
}
```

- 正确示例：

```javascript
export class MyFeature {
  get name() { return 'my-feature'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  async install(context) { ... }
  async uninstall(context) { ... }   // 可以为空实现，但必须存在
}
```

- 为什么不同：插件化 FeatureRegistry 需要完整元数据来管理加载顺序、依赖和卸载流程。

### 10. 事件名必须正好三段 —— `{module}:{action}:{status}`

- 位置：`src/frontend/common/event/event-bus.js`
- 错误示例：

```javascript
'loadData'                  // 1 段
'pdf:loaded'                // 2 段
'pdf:list:data:loaded'      // 4 段
```

- 正确示例：

```javascript
'pdf:load:completed'
'bookmark:toggle:requested'
```

- 为什么不同：统一三段式有利于在日志、监控与规则检测中快速按模块/动作/状态聚合。

### 11. 全局事件必须在白名单注册 —— 否则无法发布

- 位置：`src/frontend/common/event/global-event-registry.js`
- 错误示例：

```javascript
eventBus.emit(NEW_EVENT.REQUESTED, data);  // 新事件未在白名单中
```

- 正确示例：

```javascript
const GLOBAL_EVENTS = new Set([
  'pdf:file:loaded',
  'bookmark:create:completed',
  'new:event:requested',  // 新增事件
]);
```

- 为什么不同：通过白名单强制契约化管理跨模块全局事件，防止事件滥用。

### 12. 测试文件必须放在 __tests__ 目录 —— 不能与源文件同级

- 位置：`docs/TESTING-UNIT-GUIDE.md`、`CLAUDE.md`
- 错误示例：

```text
src/frontend/common/event/
├── event-bus.js
└── event-bus.test.js           // 错误位置
```

- 正确示例：

```text
src/frontend/common/event/
├── event-bus.js
└── __tests__/
    └── event-bus.test.js       // 正确位置
```

### 13. 测试必须用 beforeEach 清理状态 —— 禁止测试间依赖

- 位置：`CLAUDE.md`
- 错误示例（共享状态）：

```javascript
let manager;
test('test 1', () => {
  manager = new Manager();
  manager.data = [1, 2, 3];
});
test('test 2', () => {
  expect(manager.data.length).toBe(0);  // 依赖前一个测试的副作用
});
```

- 正确示例：

```javascript
let manager;
beforeEach(() => {
  manager = new Manager();
});
afterEach(() => {
  manager = null;
});
```

- 为什么不同：每个测试必须独立，避免顺序依赖导致的“偶现”问题。

### 14. ESM 动态导入的 Mock 必须使用 jest.unstable_mockModule

- 位置：`CLAUDE.md`、测试规范
- 错误示例：

```javascript
jest.mock('pdfjs-dist/build/pdf');               // 对 ESM 动态导入无效
const { PDFManager } = await import('../pdf-manager.js');
```

- 正确示例：

```javascript
beforeEach(async () => {
  jest.unstable_mockModule('pdfjs-dist/build/pdf', () => ({
    getDocument: jest.fn(() => ({
      promise: Promise.resolve({ numPages: 10 }),
    })),
  }));
  const { PDFManager } = await import('../pdf-manager.js');
  manager = new PDFManager();
});
```

## 🟢 P2级（注意事项 - 提醒即可）

### 15. Python 必须使用虚拟环境 —— 禁止全局环境

- 位置：`.kilocode/rules/memory-bank/architecture.md`、`docs/architecture/environment.md`
- 正确示例：

```bash
python -m venv .venv
.venv\\Scripts\\activate          # Windows
source .venv/bin/activate         # Linux / Mac
```

### 16. 文件编码必须 UTF-8 + 换行符必须 \n

- 位置：`.kilocode/rules/memory-bank/context.md`
- 正确示例：

```python
open('file.txt', 'r', encoding='utf-8', newline='\\n')
```

### 17. 订阅事件必须集中在 install() 中管理

- 位置：`.kilocode/rules/memory-bank/context.md`
- 正确示例思路：
  - 在 `install(context)` 阶段统一注册所有事件；
  - 避免在回调或业务逻辑中动态注册，防止重复订阅和内存泄漏。

### 18. 私有字段必须使用 # 前缀（ES 私有字段语法）

- 说明：避免使用 `_` 约定式私有字段，统一使用 ES 标准语法 `#privateField`，提升可维护性与工具链支持。

### 19. 测试策略：放弃 Playwright，采用分段集成方案

- 位置：`docs/TESTING-OVERVIEW.md`
- 核心思路：使用 Node/Jest 前端段 + PyTest 后端段 + Flow Runner 编排代替浏览器 E2E，提升稳定性。
