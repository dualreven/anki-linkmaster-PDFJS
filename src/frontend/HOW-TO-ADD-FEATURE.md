# 如何添加新Feature - 标准流程

**⚠️ 严格遵守此流程，禁止自创方式！**

---

## 第一步：创建Feature目录结构

```bash
# 在对应模块的features目录下创建
src/frontend/[模块名]/features/[功能名]/
├── index.js              # Feature主类（必需）
├── feature.config.js     # 配置文件（可选）
├── events.js            # 事件定义（可选）
├── components/          # 组件目录（可选）
├── services/            # 服务目录（可选）
└── __tests__/          # 测试文件（推荐）
```

---

## 第二步：编写Feature类（index.js）

**标准模板（必须照抄）：**

```javascript
/**
 * @file [功能描述]功能域
 * @module [FeatureName]Feature
 */

/**
 * [功能描述]功能域
 * @class [FeatureName]Feature
 * @implements {IFeature}
 */
export class [FeatureName]Feature {
  // 私有字段（使用 # 前缀）
  #somePrivateField = null;

  /** 功能名称 - 必须实现 */
  get name() {
    return '[feature-name]';  // kebab-case，小写+连字符
  }

  /** 版本号 - 必须实现 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的功能 - 必须实现 */
  get dependencies() {
    // 返回依赖的其他Feature名称数组
    // 例如：return ['app-core', 'pdf-manager'];
    return [];  // 无依赖则返回空数组
  }

  /**
   * 安装功能 - 必须实现
   * @param {FeatureContext} context - 功能上下文
   */
  async install(context) {
    const { globalEventBus, logger, container } = context;

    logger.info(`Installing ${this.name}...`);

    // 在这里初始化你的功能
    // 1. 创建实例
    // 2. 订阅事件
    // 3. 注册服务

    logger.info(`${this.name} installed successfully`);
  }

  /**
   * 卸载功能 - 必须实现
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info(`Uninstalling ${this.name}...`);

    // 在这里清理资源
    // 1. 取消订阅
    // 2. 销毁实例
    // 3. 清理引用

    logger.info(`${this.name} uninstalled`);
  }
}
```

---

## 第三步：注册Feature到Bootstrap

**在 `bootstrap/app-bootstrap-feature.js` 中注册：**

```javascript
// 1. 导入你的Feature类
import { YourFeature } from "../features/your-feature/index.js";

export async function bootstrapPDFViewerAppFeature() {
  // ... 省略其他代码 ...

  // 2. 在注册区域添加（在 registry.installAll() 之前）
  registry.register(new YourFeature());

  // 3. 安装所有Features
  await registry.installAll();

  // ... 省略其他代码 ...
}
```

---

## 常见错误及解决方案

### ❌ 错误1：在Feature外部直接创建实例
```javascript
// ❌ 错误做法
const myManager = new MyManager();
registry.register(myManager);
```

```javascript
// ✅ 正确做法
export class MyFeature {
  #manager = null;

  async install(context) {
    this.#manager = new MyManager(context.globalEventBus);
  }
}
```

---

### ❌ 错误2：忘记实现必需的getter
```javascript
// ❌ 错误做法
export class MyFeature {
  async install(context) { ... }
}
```

```javascript
// ✅ 正确做法
export class MyFeature {
  get name() { return 'my-feature'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  async install(context) { ... }
  async uninstall(context) { ... }
}
```

---

### ❌ 错误3：直接import其他Feature
```javascript
// ❌ 错误做法
import { OtherFeature } from '../other-feature/index.js';
const other = new OtherFeature();
```

```javascript
// ✅ 正确做法 - 通过依赖声明
export class MyFeature {
  get dependencies() {
    return ['other-feature'];  // 在这里声明依赖
  }

  async install(context) {
    // Registry会自动按依赖顺序安装
    // 通过EventBus与other-feature通信
  }
}
```

---

### ❌ 错误4：在install()中做同步操作
```javascript
// ❌ 错误做法
async install(context) {
  this.#manager = new Manager();
  this.#manager.init();  // 可能是异步的
}
```

```javascript
// ✅ 正确做法
async install(context) {
  this.#manager = new Manager();
  await this.#manager.init();  // 确保完成
}
```

---

## 完整示例：书签功能

```javascript
/**
 * @file PDF书签功能域
 * @module PDFBookmarkFeature
 */

import { BookmarkManager } from './components/bookmark-manager.js';

export class PDFBookmarkFeature {
  #bookmarkManager = null;
  #unsubscribeFunctions = [];

  get name() {
    return 'pdf-bookmark';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return ['pdf-manager'];  // 依赖pdf-manager
  }

  async install(context) {
    const { globalEventBus, logger } = context;

    logger.info('Installing PDFBookmarkFeature...');

    // 创建管理器
    this.#bookmarkManager = new BookmarkManager(globalEventBus);

    // 初始化
    await this.#bookmarkManager.initialize();

    // 订阅事件
    const unsubscribe = globalEventBus.subscribe(
      'pdf:loaded',
      (data) => this.#bookmarkManager.loadBookmarks(data)
    );
    this.#unsubscribeFunctions.push(unsubscribe);

    logger.info('PDFBookmarkFeature installed');
  }

  async uninstall(context) {
    const { logger } = context;

    logger.info('Uninstalling PDFBookmarkFeature...');

    // 取消订阅
    this.#unsubscribeFunctions.forEach(fn => fn());
    this.#unsubscribeFunctions = [];

    // 销毁管理器
    if (this.#bookmarkManager) {
      this.#bookmarkManager.destroy();
      this.#bookmarkManager = null;
    }

    logger.info('PDFBookmarkFeature uninstalled');
  }

  // 暴露公共方法供其他Feature使用
  getBookmarkManager() {
    return this.#bookmarkManager;
  }
}
```

---

## 核心原则（必须遵守）

1. **一个Feature = 一个独立功能** - 职责单一
2. **禁止直接调用其他Feature** - 通过EventBus通信
3. **私有字段用#前缀** - 封装实现细节
4. **必须实现4个接口** - name, version, dependencies, install, uninstall
5. **依赖通过dependencies声明** - 不要手动import其他Feature
6. **在bootstrap中注册** - 不要在其他地方创建Feature实例

---

## 检查清单

创建新Feature前，确认：
- [ ] 已阅读本文档
- [ ] 已查看现有Feature示例
- [ ] 功能职责单一明确
- [ ] 目录结构符合规范
- [ ] Feature类实现完整
- [ ] 已在bootstrap注册
- [ ] 已编写测试用例

**如有疑问，参考现有Feature：**
- `app-core` - 核心功能示例
- `pdf-bookmark` - 标准功能示例
- `url-navigation` - 带依赖的示例
