# PDF-Home Features 目录

此目录包含 pdf-home 模块的功能域（Features）。

---

## ⚠️ 重要提醒（公共入口 / 容器 / 事件 规范）

- 只允许从另一个 Feature 的 `index.js` 或 `public.js` 导入；严禁跨特性内部深层导入（components/services/core/...）。
  - 已由 ESLint 规则 `custom/no-cross-feature-internals` 强制（CI 门禁）。
  - 需要复用的能力请在目标 Feature 新增 `public.js`，或在其 `install()` 中向 DI 容器注册工厂/实例。
- 跨域通信统一走 EventBus（三段式事件名：`{module}:{action}:{status}`），严禁函数级直呼。
- 只允许通过容器（DependencyContainer）访问全局服务（如 `eventBus`、`wsClient`、`stateManager`）。

---

## 现有 Features（示例）

| 名称 | 说明 | 依赖 | 备注 |
|---|---|---|---|
| search | 搜索框与请求转发 | 无 | 稳定 |
| filter | 高级筛选 | search | 稳定 |
| search-results | 结果展示与交互 | filter | 稳定 |
| search-result-item | 单条结果渲染 | search-results | 提供 `public.js` 出口 |
| pdf-edit | 记录编辑（生产版） | search-results | 已启用 |
| pdf-editor | 记录编辑（实验版） | search-results | 已禁用（flag） |
| sidebar | 侧边栏容器与子域 | 无 | 稳定 |

---

## 快速开始

1) 目录
```bash
mkdir -p features/my-feature/{components,services,__tests__}
touch features/my-feature/index.js
```

2) index.js（最小接口）
```javascript
export class MyFeature {
  get name() { return "my-feature"; }
  get version() { return "1.0.0"; }
  get dependencies() { return []; }
  async install(context) { /* ... */ }
  async uninstall() { /* ... */ }
}
```

3) 公共 API（如需被他域使用）
```javascript
// features/my-feature/public.js
export function createSomething(...) { /* ... */ }
export const MY_FEATURE_CONSTS = { /* ... */ };
```

> 注意：他域只能从 `public.js` 或 `index.js` 导入；禁止 `../my-feature/components/*` 之类路径。

---

## 禁止事项（详细说明）

### ❌ 禁止1：跨Feature直接调用

**错误示例**：
```javascript
// ❌ 错误：直接import其他Feature的内部实现
import { SearchEngine } from '../search/services/search-engine.js';
const engine = new SearchEngine();

// ❌ 错误：直接访问其他Feature的实例
this.otherFeature.doSomething();

// ❌ 错误：通过全局变量共享状态
window.myFeatureState = { ... };
```

**正确做法**：
```javascript
// ✅ 正确：通过EventBus通信
eventBus.emit('search:query:requested', { query: 'keyword' });

// ✅ 正确：通过Container获取已注册的服务
const searchService = container.get('searchService');
if (searchService) {
  searchService.performSearch('keyword');
}

// ✅ 正确：从public.js导入公开API
import { createSearchQuery } from '../search/public.js';
```

**检测方式**：ESLint规则 `custom/no-cross-feature-internals` 会在CI中强制检查。

### ❌ 禁止2：其他常见错误

- ❌ 在 `install()` 中做阻塞性同步操作。
- ❌ 忘记在 `uninstall()` 中清理订阅和 DOM 资源。
- ❌ 在事件回调中订阅新事件（违反"订阅集中管理"原则）。

## 推荐做法

- ✅ 用 EventBus 进行跨域事件交互；事件命名三段式并通过常量文件集中管理。
- ✅ 在 `dependencies` 声明依赖；通过容器获取全局服务。
- ✅ 公开能力通过 `public.js` 或容器注册的工厂/实例。

---

## 参考资料

- 📖 [HOW-TO-ADD-FEATURE.md](../../HOW-TO-ADD-FEATURE.md)
- 📋 项目 ESLint 规则：`eslint.config.js` 与 `eslint-rules/`

---

统一架构 ⇒ 更少回归、更快交付。请严格遵守“公共入口/容器/事件”三件套。
