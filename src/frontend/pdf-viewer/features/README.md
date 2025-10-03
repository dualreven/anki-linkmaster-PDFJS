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

## 现有Features列表

| Feature名称 | 功能描述 | 依赖 | 状态 |
|------------|---------|------|------|
| app-core | 应用核心基础设施 | 无 | ✅ 稳定 |
| pdf-manager | PDF文档管理 | app-core | ✅ 稳定 |
| pdf-reader | PDF阅读器核心 | pdf-manager | ✅ 稳定 |
| pdf-bookmark | 书签管理 | pdf-reader | ✅ 稳定 |
| ui-manager | UI管理器 | pdf-manager | ✅ 稳定 |
| url-navigation | URL参数导航 | app-core, pdf-manager | ✅ 稳定 |
| websocket-adapter | WebSocket适配器 | app-core | ✅ 稳定 |
| pdf-ui | PDF UI组件 | app-core | ✅ 稳定 |

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

### 禁止事项

❌ 直接import其他Feature的类
❌ 在Feature外部创建Feature实例
❌ 绕过EventBus直接调用其他Feature
❌ 在install()中做阻塞性同步操作
❌ 忘记在uninstall()中清理资源

### 推荐做法

✅ 通过EventBus与其他Feature通信
✅ 在dependencies中声明依赖关系
✅ 使用私有字段（#前缀）封装内部状态
✅ 在uninstall()中取消所有订阅
✅ 编写单元测试验证Feature隔离性

---

## 依赖关系图

```
app-core (核心)
  ├── pdf-manager
  │     ├── pdf-reader
  │     │     └── pdf-bookmark
  │     ├── ui-manager
  │     └── url-navigation
  ├── websocket-adapter
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
