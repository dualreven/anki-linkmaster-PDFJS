# Feature注册规则 - 必须遵守

**适用范围**: pdf-home 和 pdf-viewer 模块的所有功能开发

---

## 🚨 核心规则（违反将导致严重错误）

### 规则1: 必须使用标准Feature类模板

```javascript
// ✅ 正确 - 完整实现所有必需接口
export class MyFeature {
  get name() { return 'my-feature'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }
  async install(context) { /* 初始化逻辑 */ }
  async uninstall(context) { /* 清理逻辑 */ }
}

// ❌ 错误 - 缺少必需接口
export class MyFeature {
  async install(context) { ... }
}
```

### 规则2: 必须在bootstrap中注册

```javascript
// ✅ 正确 - 在bootstrap中使用registry.register()
import { MyFeature } from "../features/my-feature/index.js";
registry.register(new MyFeature());

// ❌ 错误 - 在其他地方创建实例
const myFeature = new MyFeature();
myFeature.install(context);
```

### 规则3: 禁止直接调用其他Feature

```javascript
// ✅ 正确 - 通过EventBus通信
export class FeatureA {
  async install(context) {
    context.globalEventBus.subscribe('feature-b:data', (data) => {
      // 处理来自Feature B的数据
    });
  }
}

// ❌ 错误 - 直接import和调用
import { FeatureB } from '../feature-b/index.js';
const featureB = new FeatureB();
featureB.doSomething();
```

### 规则4: 依赖必须在dependencies中声明

```javascript
// ✅ 正确 - 声明依赖关系
export class MyFeature {
  get dependencies() {
    return ['app-core', 'pdf-manager'];
  }
}

// ❌ 错误 - 不声明直接使用
export class MyFeature {
  get dependencies() { return []; }
  async install(context) {
    // 假设app-core已存在，但没声明依赖
  }
}
```

---

## 📋 标准开发流程（逐步检查）

### Step 1: 阅读文档
- [ ] 已阅读 `src/frontend/HOW-TO-ADD-FEATURE.md`
- [ ] 已查看对应模块的 `features/README.md`
- [ ] 已参考现有Feature示例代码

### Step 2: 创建目录结构
```bash
src/frontend/[模块]/features/[功能名]/
├── index.js              # Feature主类
├── components/           # 组件（可选）
├── services/            # 服务（可选）
└── __tests__/           # 测试（推荐）
```

### Step 3: 实现Feature类
- [ ] 复制标准模板到 index.js
- [ ] 实现 name getter（kebab-case命名）
- [ ] 实现 version getter
- [ ] 实现 dependencies getter
- [ ] 实现 install() 方法
- [ ] 实现 uninstall() 方法

### Step 4: 注册到Bootstrap
- [ ] 在 bootstrap 文件中导入 Feature 类
- [ ] 使用 `registry.register(new YourFeature())` 注册
- [ ] 确保在 `registry.installAll()` 之前注册

### Step 5: 测试验证
- [ ] 编写单元测试
- [ ] 运行 `npm run test` 确保通过
- [ ] 手动测试功能正常

---

## ⚠️ 常见错误示例

### 错误1: 自创注册方式

```javascript
// ❌ 错误 - 手动调用install
const myFeature = new MyFeature();
await myFeature.install({ globalEventBus, logger });

// ✅ 正确 - 使用Registry
registry.register(new MyFeature());
await registry.installAll();
```

### 错误2: 忘记实现接口

```javascript
// ❌ 错误 - 缺少getter
export class MyFeature {
  constructor() {
    this.name = 'my-feature';  // 错误：应该用getter
  }
}

// ✅ 正确
export class MyFeature {
  get name() { return 'my-feature'; }
}
```

### 错误3: 循环依赖

```javascript
// ❌ 错误 - Feature A和B互相依赖
export class FeatureA {
  get dependencies() { return ['feature-b']; }
}
export class FeatureB {
  get dependencies() { return ['feature-a']; }
}

// ✅ 正确 - 通过EventBus解耦
export class FeatureA {
  get dependencies() { return []; }
  async install(context) {
    context.globalEventBus.emit('feature-a:ready');
  }
}
export class FeatureB {
  get dependencies() { return []; }
  async install(context) {
    context.globalEventBus.subscribe('feature-a:ready', ...);
  }
}
```

### 错误4: 忘记清理资源

```javascript
// ❌ 错误 - 没有取消订阅
export class MyFeature {
  async install(context) {
    context.globalEventBus.subscribe('event', this.handler);
  }
  async uninstall(context) {
    // 忘记取消订阅，导致内存泄漏
  }
}

// ✅ 正确 - 保存并取消订阅
export class MyFeature {
  #unsubscribe = null;

  async install(context) {
    this.#unsubscribe = context.globalEventBus.subscribe('event', this.handler);
  }

  async uninstall(context) {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }
}
```

---

## 🔍 快速参考

### Bootstrap注册位置

**pdf-viewer**:
- 文件: `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`
- 位置: `registry.installAll()` 之前

**pdf-home**:
- 文件: `src/frontend/pdf-home/bootstrap/app-bootstrap-v2.js` 或 `index.js`
- 位置: `registry.installAll()` 之前

### 获取Context内容

```javascript
async install(context) {
  const {
    globalEventBus,  // 全局事件总线
    logger,          // 日志记录器
    container,       // 依赖容器
    config           // 配置对象（可选）
  } = context;
}
```

### EventBus使用示例

```javascript
// 发布事件
context.globalEventBus.emit('my-event', data, { actorId: 'MyFeature' });

// 订阅事件
const unsubscribe = context.globalEventBus.subscribe('other-event', (data) => {
  // 处理事件
});

// 取消订阅
unsubscribe();
```

---

## 📚 相关文档

- 📖 **完整指南**: `src/frontend/HOW-TO-ADD-FEATURE.md`
- 📋 **CLAUDE.md**: 功能域模块化架构章节
- 🔍 **示例代码**:
  - `src/frontend/pdf-viewer/features/app-core/index.js`
  - `src/frontend/pdf-viewer/features/pdf-bookmark/index.js`

---

**记住**: 这不是建议，这是规则！违反将导致难以调试的错误！
