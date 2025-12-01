# PDF-Viewer Features 目录

此目录包含所有pdf-viewer模块的功能域（Features）。

---

## ⚠️ 重要提醒

**开发新Feature前必读：**
- 📖 **完整指南**: [../../HOW-TO-ADD-FEATURE.md](../../HOW-TO-ADD-FEATURE.md)
- 📋 **标准模板**: 见指南中的"第二步"
- ✅ **检查清单**: 见指南末尾

**严禁自创注册方式！必须严格遵循标准流程！**

---

命名统一说明（进行中）
- 规范名采用三段式：layer-domain[-capability]；本目录已将部分名称切换为规范名：
  - app-core → infra-app（别名兼容：app-core）
  - ui-manager → infra-ui（别名兼容：ui-manager）
  - websocket-adapter → infra-ws-adapter（别名兼容：websocket-adapter）
  - annotation → pdf-annotation（别名兼容：annotation；事件作用域仍为 annotation）
  - search → pdf-search（别名兼容：search）
  - text-selection-quick-actions → pdf-quick-actions（别名兼容：text-selection-quick-actions）

> 说明：别名兼容由 FEATURE_ALIASES 提供；注册中心在 register/has/get/install 时统一按别名解析为规范名，依赖拓扑与安装顺序不受影响。

---

## 现有Features列表

| Feature名称 | 功能描述 | 依赖 | 状态 |
|------------|---------|------|------|
| infra-app | 应用核心基础设施 | 无 | ✅ 稳定 |
| pdf-manager | PDF文档管理 | 无 | ✅ 稳定 |
| pdf-outline | 大纲管理 | pdf-manager | ✅ 稳定 |
| infra-ui | UI管理器 | pdf-manager | ✅ 稳定 |
| infra-ws-adapter | WebSocket适配器 | 无 | ✅ 稳定 |
| pdf-ui | PDF UI组件 | 无 | ✅ 稳定 |

---

## 快速开始

### 1. 创建新Feature

```bash
# 在features目录下创建
mkdir -p features/my-feature/{components,services,__tests__}
touch features/my-feature/index.js
```

### 2. 复制标准模板到index.js

参考 [HOW-TO-ADD-FEATURE.md](../../HOW-TO-ADD-FEATURE.md) 第二步的完整模板。

### 3. 在bootstrap注册

```javascript
// bootstrap/app-bootstrap-feature.js
import { MyFeature } from "../features/my-feature/index.js";

// 在 registry.installAll() 之前添加
registry.register(new MyFeature());
```

---

## Feature开发规范

### 必须实现的接口

```javascript
export class MyFeature {
  get name() { return 'my-feature'; }         // 必需
  get version() { return '1.0.0'; }           // 必需
  get dependencies() { return []; }           // 必需
  async install(context) { ... }              // 必需
  async uninstall(context) { ... }            // 必需
}
```

### 禁止事项（详细说明）

#### ❌ 禁止1：跨Feature直接调用

**错误示例**：
```javascript
// ❌ 错误：直接import其他Feature的内部实现
import { OutlineManager } from '../pdf-outline/components/outline-manager.js';
const manager = new OutlineManager();

// ❌ 错误：直接访问其他Feature的实例
this.otherFeature.doSomething();

// ❌ 错误：通过全局变量共享状态
window.myFeatureState = { ... };
```

**正确做法**：
```javascript
// ✅ 正确：通过EventBus通信
eventBus.emitGlobal('pdf-outline:toggle:requested', {}, { actorId: 'MyFeature' });

// ✅ 正确：通过Container获取已注册的服务
const outlineService = container.get('outlineService');
if (outlineService) {
  outlineService.toggle();
}
```

**检测方式**：ESLint规则 `custom/no-cross-feature-internals` 会在CI中强制检查。

#### ❌ 禁止2：其他常见错误

- ❌ 在Feature外部创建Feature实例
- ❌ 在install()中做阻塞性同步操作
- ❌ 忘记在uninstall()中清理资源
- ❌ 在事件回调中订阅新事件（违反"订阅集中管理"原则）

### 推荐做法

✅ 通过EventBus与其他Feature通信
✅ 在dependencies中声明依赖关系
✅ 使用私有字段（#前缀）封装内部状态
✅ 在uninstall()中取消所有订阅
✅ 编写单元测试验证Feature隔离性

---

## 依赖关系图

```
infra-app (核心)
  ├── pdf-manager
  │     ├── pdf-outline
  │     └── infra-ui
  ├── infra-ws-adapter
  └── pdf-ui
```

---

## 常见问题

### Q: 如何让Feature A使用Feature B的功能？

A: 不要直接调用！通过以下方式：
1. 在Feature A的dependencies中声明对Feature B的依赖
2. Feature B通过EventBus发布事件
3. Feature A订阅这些事件

### Q: 如何在Feature之间共享数据？

A: 推荐方案：
1. 通过EventBus传递数据
2. 使用Container注册共享服务
3. 通过StateManager管理全局状态

### Q: Feature加载顺序如何确定？

A: FeatureRegistry会自动根据dependencies声明计算加载顺序，无需手动管理。

---

## 参考资料

- 📖 [完整开发指南](../../HOW-TO-ADD-FEATURE.md)
- 📋 [CLAUDE.md - 功能域架构章节](../../../CLAUDE.md#功能域模块化架构)
- 🔍 参考现有Feature源码学习最佳实践

---

**记住：统一的架构 = 更少的bug + 更快的开发 + 更好的协作**


