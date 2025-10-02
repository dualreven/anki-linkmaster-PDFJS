# PDF-Home Features 目录

此目录包含所有pdf-home模块的功能域（Features）。

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
| pdf-list | PDF列表管理 | 无 | ✅ 稳定 |
| pdf-editor | PDF编辑功能 | pdf-list | ✅ 稳定 |
| pdf-sorter | PDF排序功能 | pdf-list | ✅ 稳定 |

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
// bootstrap/app-bootstrap-v2.js 或 index.js
import { MyFeature } from "./features/my-feature/index.js";

const registry = new FeatureRegistry({ ... });
registry.register(new MyFeature());
await registry.installAll();
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
pdf-list (核心列表管理)
  ├── pdf-editor (编辑功能)
  └── pdf-sorter (排序功能)
```

---

## 参考资料

- 📖 [完整开发指南](../../HOW-TO-ADD-FEATURE.md)
- 📋 [CLAUDE.md - 功能域架构章节](../../../CLAUDE.md#功能域模块化架构)
- 🔍 参考现有Feature源码学习最佳实践

---

**记住：统一的架构 = 更少的bug + 更快的开发 + 更好的协作**
