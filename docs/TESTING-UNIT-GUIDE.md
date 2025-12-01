# 单元测试开发指南（AI 必读 - 避免高频错误）

本文档专门针对 **AI 开发者**编写测试时的常见错误和最佳实践。阅读时间：10分钟。

---

## ⚠️ 开始前必读

**本项目的测试体系特点**：
1. 使用 Jest + jsdom（无浏览器）
2. 全局 Mock 已配置（jest.setup.js）
3. ESM 模块需要特殊的 Mock 方式
4. 测试文件必须放在 `__tests__/` 目录
5. 禁止使用 console.log（已被 Mock）

**如果你是 AI，请特别关注 🔴 P0级错误和 🟡 P1级错误章节！**

> 提示：本文中出现的部分文件路径（例如某些 `tests/fixtures/...` 示例）可能与当前仓库结构略有出入，这些路径用于说明典型用法。编写或查找测试时，请以实际 `tests/` 目录中的文件为准。

---

## 📂 目录结构规范

### 单元测试文件位置

```
src/frontend/common/event/
├── event-bus.js              # 源文件
├── scoped-event-bus.js       # 源文件
└── __tests__/                # 测试目录
    ├── event-bus.test.js     # event-bus.js 的测试
    └── scoped-event-bus.test.js
```

**规则**：
- ✅ 测试文件必须在与源文件同目录的 `__tests__/` 子目录
- ✅ 测试文件命名：`<源文件名>.test.js`
- ❌ 禁止测试文件与源文件同级
- ❌ 禁止使用 `.spec.js` 后缀（本项目统一用 `.test.js`）

### Smoke 测试文件位置

```
src/frontend/pdf-viewer/
├── __smoke__/                # Smoke 测试目录
│   ├── annotation-card-jump.smoke.test.js
│   └── anchor-create.smoke.test.js
└── features/
    └── pdf-outline/
        └── __smoke__/
            └── outline-smoke.test.js
```

**规则**：
- ✅ Smoke 测试放在 `__smoke__/` 目录
- ✅ 文件名包含 `.smoke.test.js` 后缀
- ⚠️ Smoke 测试是关键流程的快速验证，涉及多个模块协作

---

## 🧪 测试命名规范

### describe 块命名

```javascript
// ✅ 正确：使用类名或模块名
describe('EventBus', () => { ... });
describe('PDFManager', () => { ... });
describe('NavigationService', () => { ... });

// ❌ 错误：不清晰的命名
describe('test', () => { ... });
describe('my tests', () => { ... });
```

### test 用例命名

```javascript
// ✅ 正确：清晰描述预期行为
test('should load PDF successfully when file exists', () => { ... });
test('should throw error when PDF file not found', () => { ... });
test('should cache loaded PDF to avoid re-loading', () => { ... });

// ❌ 错误：不清晰的命名
test('test 1', () => { ... });
test('manager works', () => { ... });
test('check data', () => { ... });
```

**命名模式**：`should <做什么> when <在什么条件下>`

---

## 🚨 AI 常犯错误（P0级 - 会导致测试失效）

### 错误1：忘记清理状态 - 必须用 beforeEach/afterEach

这是 **AI 最常犯的错误**！

```javascript
// ❌ 错误：测试间状态污染
let manager;
test('test 1', () => {
  manager = new Manager();
  manager.data = [1, 2, 3];
  expect(manager.data.length).toBe(3);
});

test('test 2', () => {
  // ❌ manager 仍然是上个测试的实例！
  expect(manager.data).toEqual([]);  // 失败！实际是 [1,2,3]
});

// ✅ 正确：每个测试独立创建实例
let manager;

beforeEach(() => {
  manager = new Manager();
});

afterEach(() => {
  manager = null;  // 清理引用
});

test('test 1', () => {
  manager.data = [1, 2, 3];
  expect(manager.data.length).toBe(3);
});

test('test 2', () => {
  expect(manager.data).toEqual([]);  // ✅ 成功！
});
```

**检查方式**：
- 运行 `pnpm test --randomize` 打乱测试顺序
- 如果顺序打乱后测试失败，说明有状态污染

---

### 错误2：ESM 动态导入 Mock 不生效 - 必须用 jest.unstable_mockModule

**本项目大量使用 ESM 动态导入（如 pdfjs-dist），这是 AI 第二常犯的错误！**

```javascript
// ❌ 错误：jest.mock 无法 Mock 动态导入（import()）
jest.mock('pdfjs-dist/build/pdf');  // ❌ 不生效！

const { PDFManager } = await import('../pdf-manager.js');
const manager = new PDFManager();
// manager 内部使用的仍然是真实的 pdfjs-dist！

// ✅ 正确：使用 jest.unstable_mockModule
beforeEach(async () => {
  // 先 Mock 模块
  jest.unstable_mockModule('pdfjs-dist/build/pdf', () => ({
    getDocument: jest.fn(() => ({
      promise: Promise.resolve({
        numPages: 10,
        getPage: jest.fn()
      })
    }))
  }));

  // 再动态导入
  const { PDFManager } = await import('../pdf-manager.js');
  manager = new PDFManager();
});
```

**为什么？**
- `jest.mock()` 只适用于 CommonJS 模块的静态导入
- ESM 动态导入（`import()`）需要 `jest.unstable_mockModule()`
- pdfjs-dist、pdf.js 等库都是 ESM 模块

**检查方式**：
- 如果测试报错 "Cannot find module pdfjs-dist"
- 或者 Mock 未生效导致真实模块被加载
- 说明你用错了 Mock 方式

---

### 错误3：异步测试没有等待 - 必须 await 或 return Promise

```javascript
// ❌ 错误：异步操作未等待，测试提前结束
test('should load data', () => {
  loadData().then(data => {
    expect(data).toBeDefined();  // ❌ 永远不会执行！
  });
  // 测试已经结束，Promise 回调未执行
});

// ✅ 正确：使用 async/await
test('should load data', async () => {
  const data = await loadData();
  expect(data).toBeDefined();
});

// ✅ 正确：返回 Promise
test('should load data', () => {
  return loadData().then(data => {
    expect(data).toBeDefined();
  });
});
```

**检查方式**：
- 如果测试通过但断言从未执行
- 添加 `console.log`（临时调试）看是否输出
- 检查是否有 `async` 或 `return`

---

### 错误4：使用 console.log 调试测试 - 必须用 logger

**本项目的 console 已被 Mock（jest.setup.js），console.log 不会输出！**

```javascript
// ❌ 错误：console.log 在测试中不可见
test('should load data', () => {
  console.log('Testing data load');  // ❌ 不会输出！
  const result = loadData();
  expect(result).toBe(true);
});

// ✅ 正确：使用 logger（已被 Mock）
import { getLogger } from '../common/utils/logger.js';
const logger = getLogger('TestModule');

test('should load data', () => {
  logger.debug('Testing data load');  // ✅ 会被记录到 Mock
  const result = loadData();
  expect(result).toBe(true);
});

// ✅ 最佳：直接使用 Jest 的调试方式
test('should load data', () => {
  const result = loadData();
  console.table({ result });  // 临时调试时使用
  expect(result).toBe(true);
});
```

**为什么 console 被 Mock？**
- 避免测试输出污染控制台
- 前端代码也禁止使用 console，必须用 logger
- jest.setup.js 已经全局 Mock 了 console

---

### 错误5：测试文件位置错误 - 必须放在 __tests__ 目录

```
❌ 错误位置：
src/frontend/common/event/
├── event-bus.js
└── event-bus.test.js        // ❌ 错误位置！

✅ 正确位置：
src/frontend/common/event/
├── event-bus.js
└── __tests__/
    └── event-bus.test.js     // ✅ 正确位置！
```

**为什么？**
- Jest 配置约定，便于批量运行
- 覆盖率统计更准确
- 避免测试文件污染源代码目录


### 错误6：跳过真实入口层 - 导致测试盲区 🔥 **本次 Bug 教训**

**这是导致 2025-11-16 导航 Bug 的直接原因！**

```python
# ❌ 错误（后端）：直接调用 Handler，跳过 handle_message()
def test_navigate():
    from src.backend.msgCenter_server.handlers.pdf_viewer.viewer import navigate_viewer

    # 直接构造 Handler 参数
    payload = {
        "to": {"pdf_uuid": "sample"},
        "target": {"type": "outline", "outline_item_id": "item-1"}
    }

    # ❌ 跳过了 handle_message() 的参数提取逻辑
    res = navigate_viewer(ctx, req_id, payload)
    assert res["type"] == "pdf-viewer:navigate:completed"

# ✅ 正确（后端）：从真实入口开始测试
def test_navigate_via_handle_message():
    # 构造真实的 WebSocket 消息
    message = {
        "type": "pdf-viewer:navigate:requested",
        "to": {"pdf_uuid": "sample"},  # ← 测试参数提取
        "data": {"target": {"type": "outline", "outline_item_id": "item-1"}}
    }

    # ✅ 从入口开始测试，覆盖参数提取逻辑
    res = server.handle_message(message)
    assert res["type"] == "pdf-viewer:navigate:completed"
```

```javascript
// ❌ 错误（前端）：直接调用 Feature 方法
test('should navigate', () => {
  pdfViewerFeature.navigateToPage(5);  // ← 跳过 EventBus
  expect(viewer.currentPage).toBe(5);
});

// ✅ 正确（前端）：通过 EventBus 触发
test('should navigate via event', () => {
  // 通过真实入口（EventBus）触发
  eventBus.emit('pdf:navigate:requested', { page: 5 });

  // 验证事件名称格式（三段式）
  expect(eventBus.emit).toHaveBeenCalledWith(
    'pdf:navigate:completed',
    expect.objectContaining({ page: 5 })
  );

  expect(viewer.currentPage).toBe(5);
});
```

**为什么这是 P0级错误？**
- 跳过入口层会导致**测试盲区**（未覆盖的代码路径）
- Bug 可能存在于入口层（参数提取、路由、验证），但测试无法发现
- 导致生产环境出现 Bug，影响用户体验

**真实案例（2025-11-16）**：
- Bug：`handle_message()` 第438行参数提取错误（`data.get("to")` 应该是 `message.get("to")`）
- 测试盲区：旧测试直接调用 `navigate_viewer()`，跳过了 `handle_message()`
- 后果：所有导航请求失败（"无可用目标对象"）
- 修复：创建集成测试 `test_handle_message_navigate.py`，从 `handle_message()` 入口开始测试

**检查方式**：
- 查看测试调用栈：是否从真实入口开始？
- 运行覆盖率分析：入口函数的前10行是否被覆盖？
- 问自己：如果参数提取逻辑出错，测试能发现吗？

**详细指南**：
- `docs/TESTING-INTEG-GUIDE.md#13-测试入口选择原则`
- `AItemp/reports/bug-analysis-navigate-20251116.md`

---
---

## 🟡 AI 常犯错误（P1级 - 影响测试质量）

### 错误6：硬编码测试数据 - 应该使用 fixtures

```javascript
// ❌ 错误：硬编码数据，难以维护
test('should parse outline', () => {
  const data = {
    items: [
      { id: '1', name: 'Chapter 1', pageAt: 1, position: 0, children: [] },
      { id: '2', name: 'Chapter 2', pageAt: 10, position: 0, children: [] }
    ]
  };
  const result = parseOutline(data);
  expect(result.length).toBe(2);
});

// ✅ 正确：使用共享 fixture
import outlineData from '../../../../tests/fixtures/json/outline-data.json';

test('should parse outline', () => {
  const result = parseOutline(outlineData);
  expect(result.length).toBe(2);
});
```

**好处**：
- 测试数据集中管理，易于维护
- 多个测试可以共享同一份数据
- 修改数据格式时只需改一处

---

### 错误7：一个测试验证太多行为 - 应该拆分

```javascript
// ❌ 错误：一个测试做太多事情
test('PDF Manager full workflow', () => {
  manager.loadPDF('test.pdf');
  expect(manager.isLoaded).toBe(true);

  manager.navigateToPage(5);
  expect(manager.currentPage).toBe(5);

  manager.addBookmark('bookmark1');
  expect(manager.bookmarks.length).toBe(1);

  manager.removeBookmark('bookmark1');
  expect(manager.bookmarks.length).toBe(0);
  // ... 还有20行代码
});

// ✅ 正确：拆分为多个独立测试
describe('PDFManager', () => {
  beforeEach(() => {
    manager = new PDFManager();
  });

  test('should load PDF successfully', () => {
    manager.loadPDF('test.pdf');
    expect(manager.isLoaded).toBe(true);
  });

  test('should navigate to specified page', () => {
    manager.loadPDF('test.pdf');
    manager.navigateToPage(5);
    expect(manager.currentPage).toBe(5);
  });

  test('should add bookmark', () => {
    manager.loadPDF('test.pdf');
    manager.addBookmark('bookmark1');
    expect(manager.bookmarks.length).toBe(1);
  });

  test('should remove bookmark', () => {
    manager.loadPDF('test.pdf');
    manager.addBookmark('bookmark1');
    manager.removeBookmark('bookmark1');
    expect(manager.bookmarks.length).toBe(0);
  });
});
```

**原则**：
- 一个测试只验证一个行为
- 测试失败时能快速定位问题
- 每个测试控制在 10-15 行代码内

---

### 错误8：忘记验证 Mock 调用 - 应该检查调用次数和参数

```javascript
// ❌ 错误：只 Mock 了，但没验证是否被调用
const mockFetch = jest.fn().mockResolvedValue({ data: [] });
global.fetch = mockFetch;

await loadData();

// ❌ 忘记验证 fetch 是否被调用！
expect(data).toBeDefined();

// ✅ 正确：验证 Mock 调用
const mockFetch = jest.fn().mockResolvedValue({ data: [] });
global.fetch = mockFetch;

await loadData();

// 验证调用次数
expect(mockFetch).toHaveBeenCalledTimes(1);

// 验证调用参数
expect(mockFetch).toHaveBeenCalledWith(
  '/api/data',
  expect.objectContaining({
    method: 'GET'
  })
);
```

**为什么重要？**
- 确保函数确实调用了依赖
- 验证传递的参数正确
- 防止假阳性（函数未调用但测试通过）

---

### 错误9：测试依赖执行顺序 - 必须独立

```javascript
// ❌ 错误：测试依赖执行顺序
describe('Counter', () => {
  test('should start at 0', () => {
    expect(counter.value).toBe(0);
  });

  test('should increment', () => {
    counter.increment();
    expect(counter.value).toBe(1);  // ❌ 依赖上一个测试！
  });

  test('should decrement', () => {
    counter.decrement();
    expect(counter.value).toBe(0);  // ❌ 依赖上两个测试！
  });
});

// ✅ 正确：每个测试独立
describe('Counter', () => {
  beforeEach(() => {
    counter = new Counter();
  });

  test('should start at 0', () => {
    expect(counter.value).toBe(0);
  });

  test('should increment from 0 to 1', () => {
    expect(counter.value).toBe(0);
    counter.increment();
    expect(counter.value).toBe(1);
  });

  test('should decrement from 0 to -1', () => {
    expect(counter.value).toBe(0);
    counter.decrement();
    expect(counter.value).toBe(-1);
  });
});
```

---

## 🔧 jest.setup.js 全局 Mock 说明

**项目已预配置的全局 Mock（无需手动 Mock）**：

### 1. console 已被 Mock
```javascript
// jest.setup.js 中已配置
global.console = {
  ...console,
  log: jest.fn(),      // 不会输出
  debug: jest.fn(),    // 不会输出
  info: jest.fn(),     // 不会输出
  warn: jest.fn(),     // 不会输出
  error: jest.fn()     // 不会输出
};
```

### 2. WebSocket 已被 Mock
```javascript
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,  // OPEN 状态
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));
```

### 3. fetch 已被 Mock
```javascript
global.fetch = jest.fn();
```

### 4. IndexedDB 已被 Mock（fake-indexeddb）
```javascript
require('fake-indexeddb/auto');
```

### 5. 浏览器 API 已被 Mock
- `requestAnimationFrame`
- `cancelAnimationFrame`
- `ResizeObserver`
- `IntersectionObserver`

### 6. Logger 已被 Mock
```javascript
jest.mock('./src/frontend/common/utils/logger.js', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
    setLogLevel: jest.fn()
  })),
  Logger: jest.fn(),
  LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' }
}));
```

**使用建议**：
- ✅ 直接使用这些全局 Mock，无需再次 Mock
- ✅ 如需自定义行为，在测试中覆盖即可
- ❌ 不要删除 jest.setup.js 的配置

---

## 📊 测试覆盖率要求

### 覆盖率目标
- **行覆盖率（Line Coverage）**：≥ 80%
- **分支覆盖率（Branch Coverage）**：≥ 70%
- **函数覆盖率（Function Coverage）**：≥ 85%

### 检查命令
```bash
# 生成覆盖率报告
pnpm test --coverage

# 查看 HTML 报告
open coverage/lcov-report/index.html
```

### 豁免规则
以下文件可豁免覆盖率要求：
- 配置文件（`*.config.js`）
- 类型定义（`*.d.ts`）
- 测试工具文件（`test-utils.js`）
- 已废弃但未删除的代码（需注释说明）

---

## 🎯 Smoke 测试规范

### 什么是 Smoke 测试？
Smoke 测试是关键功能的快速验证，确保核心流程不被破坏。比单元测试更接近真实场景，但比 E2E 测试更轻量。

### 示例
```javascript
// src/frontend/pdf-viewer/__smoke__/annotation-card-jump.smoke.test.js

/**
 * Smoke Test: 批注卡片跳转功能
 * 验证：点击批注卡片 → 页面跳转 → 高亮显示
 */
describe('Annotation Card Jump (Smoke)', () => {
  test('should jump to annotation page when card clicked', async () => {
    // 1. 初始化环境
    const viewer = new PDFViewer();
    await viewer.loadPDF('sample.pdf');

    // 2. 创建批注
    const annotation = await viewer.addAnnotation({
      pageAt: 5,
      position: { x: 100, y: 200 }
    });

    // 3. 点击批注卡片
    await annotation.card.click();

    // 4. 验证跳转
    expect(viewer.currentPage).toBe(5);
    expect(annotation.isHighlighted).toBe(true);
  });
});
```

### 运行 Smoke 测试
```bash
# 只运行 Smoke 测试
pnpm test:smoke

# 实际命令
jest --runTestsByPath src/frontend/pdf-viewer/__smoke__/*.smoke.test.js -i
```

### Smoke 测试原则
- 覆盖核心用户流程（如创建书签、批注跳转）
- 涉及多个模块协作
- 运行时间控制在 1-5 秒/用例
- 失败时能快速定位问题

---

## 📖 快速命令参考

```bash
# 运行所有测试
pnpm test

# 运行单个测试文件
pnpm test path/to/test.js

# 监听模式（开发时推荐）
pnpm test:watch

# 生成覆盖率报告
pnpm test --coverage

# 只运行匹配的测试
pnpm test -t "test name pattern"

# 显示详细输出
pnpm test --verbose

# 运行 Smoke 测试
pnpm test:smoke

# 打乱测试顺序（检查独立性）
pnpm test --randomize
```

---

## 🚨 绝对禁止（0容忍）

### 1. 禁止跳过测试（除非临时调试）
```javascript
❌ test.skip('should work', () => { ... });  // 禁止提交！
❌ describe.skip('MyClass', () => { ... });  // 禁止提交！

✅ test('should work', () => { ... });
```

### 2. 禁止在测试中使用真实的外部依赖
```javascript
❌ const ws = new WebSocket('ws://localhost:8765');  // 禁止！
❌ await fetch('http://real-api.com/data');  // 禁止！

✅ const mockWs = jest.fn();
✅ global.fetch = jest.fn().mockResolvedValue({ data: [] });
```

### 3. 禁止在测试中修改全局状态后不恢复
```javascript
❌ 错误：修改全局变量后不恢复
window.originalFetch = window.fetch;
window.fetch = mockFetch;
// 测试结束后必须恢复！

✅ 正确：在 afterEach 中恢复
let originalFetch;
beforeEach(() => {
  originalFetch = window.fetch;
  window.fetch = mockFetch;
});
afterEach(() => {
  window.fetch = originalFetch;
});
```

### 4. 禁止使用 console.log 而不是 logger
```javascript
❌ console.log('debug info');  // 禁止！（已被 Mock，不会输出）
✅ logger.debug('debug info');  // 正确！
```

---

## ✅ 测试最佳实践

### 1. AAA 模式（Arrange-Act-Assert）
```javascript
test('should calculate total price', () => {
  // Arrange - 准备数据
  const cart = new ShoppingCart();
  cart.addItem({ name: 'Book', price: 10 });
  cart.addItem({ name: 'Pen', price: 2 });

  // Act - 执行操作
  const total = cart.calculateTotal();

  // Assert - 验证结果
  expect(total).toBe(12);
});
```

### 2. 使用描述性的变量名
```javascript
// ❌ 不好
const a = new Manager();
const b = a.getData();
expect(b.length).toBe(5);

// ✅ 好
const pdfManager = new PDFManager();
const loadedPages = pdfManager.getData();
expect(loadedPages.length).toBe(5);
```

### 3. 每个测试只验证一个行为
```javascript
// ❌ 不好：一个测试验证多个行为
test('should handle user actions', () => {
  expect(manager.login()).toBe(true);
  expect(manager.loadData()).toBeDefined();
  expect(manager.save()).toBe(true);
});

// ✅ 好：拆分为多个测试
test('should login successfully', () => {
  expect(manager.login()).toBe(true);
});

test('should load data after login', () => {
  manager.login();
  expect(manager.loadData()).toBeDefined();
});

test('should save data successfully', () => {
  manager.login();
  manager.loadData();
  expect(manager.save()).toBe(true);
});
```

### 4. 避免脆弱的测试
```javascript
// ❌ 脆弱：依赖具体的时间戳
test('should set timestamp', () => {
  const result = manager.create();
  expect(result.timestamp).toBe(1699999999);  // 会失败！
});

// ✅ 稳定：验证类型或范围
test('should set timestamp', () => {
  const result = manager.create();
  expect(result.timestamp).toBeGreaterThan(0);
  expect(typeof result.timestamp).toBe('number');
});
```

---

## 📚 相关文档

1. **CLAUDE.md 测试规范章节** → `CLAUDE.md#🧪-测试开发规范` ⚠️ **AI 必读**
2. **tech.md AI 易错点** → `.kilocode/rules/memory-bank/tech.md#AI开发易错点速查`
3. **集成测试指南** → `docs/TESTING-INTEG-GUIDE.md`
4. **E2E 测试指南** → `docs/TESTING-E2E-GUIDE.md`（注意：本项目的 E2E 是连贯的集成测试流）
5. **测试总览** → `docs/TESTING-OVERVIEW.md`

---

## 🎓 总结

**AI 开发测试时的核心原则**：

1. ✅ **测试文件放在 `__tests__/` 目录**
2. ✅ **每个测试使用 `beforeEach` 清理状态**
3. ✅ **ESM 动态导入用 `jest.unstable_mockModule`**
4. ✅ **异步测试必须 `await` 或 `return Promise`**
5. ✅ **禁止使用 `console.log`，用 `logger`**
6. ✅ **一个测试只验证一个行为**
7. ✅ **验证 Mock 的调用次数和参数**
8. ✅ **使用 fixtures 而不是硬编码数据**
9. ✅ **测试命名清晰（should ... when ...）**
10. ✅ **覆盖率 ≥ 80%**

**记住**：好的测试是代码质量的保障，但写测试本身也需要遵循规范！
