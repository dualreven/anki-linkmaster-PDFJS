# 微服务架构核心组件

> **通用基础设施** | 功能域架构（Feature-Oriented Architecture）核心组件

## 📦 组件清单

| 组件 | 文件 | 行数 | 测试数 | 说明 |
|------|------|------|--------|------|
| **DependencyContainer** | `dependency-container.js` | 392行 | 16个 | 依赖注入容器 |
| **FeatureRegistry** | `feature-registry.js` | 656行 | 21个 | 功能注册中心 |
| **StateManager** | `state-manager.js` | 641行 | 73个 | 响应式状态管理 |
| **FeatureFlagManager** | `feature-flag-manager.js` | 505行 | 49个 | Feature Flag管理 |
| **总计** | | **2194行** | **159个** | **100%通过** ✅ |

---

## 🎯 设计原则

### 1. **通用性（Universality）**
- ✅ 零业务耦合
- ✅ 纯架构基础设施
- ✅ 可被任何前端模块使用

### 2. **单一职责（Single Responsibility）**
- ✅ 每个组件只负责一件事
- ✅ 接口清晰，职责明确

### 3. **依赖倒置（Dependency Inversion）**
- ✅ 依赖抽象接口
- ✅ 不依赖具体实现

### 4. **开闭原则（Open-Closed Principle）**
- ✅ 对扩展开放（注册新功能）
- ✅ 对修改封闭（核心代码不变）

---

## 📖 使用指南

### 快速开始

```javascript
// 1. 导入核心组件
import {
  DependencyContainer,
  FeatureRegistry,
  StateManager,
  FeatureFlagManager
} from '../../common/micro-service/index.js';

// 2. 创建应用实例
export class MyApp {
  constructor() {
    // 依赖注入容器
    this.container = new DependencyContainer('my-app');

    // 功能注册中心
    this.registry = new FeatureRegistry({
      container: this.container
    });

    // 状态管理器
    this.stateManager = new StateManager();

    // Feature Flag管理器
    this.flagManager = new FeatureFlagManager();
  }

  async initialize() {
    // 注册全局服务
    this.container.register('eventBus', globalEventBus);
    this.container.register('stateManager', this.stateManager);

    // 注册功能域
    this.registry.register(new MyFeature1());
    this.registry.register(new MyFeature2());

    // 安装功能
    await this.registry.installAll();
  }
}
```

---

## 🔧 核心组件详解

### 1️⃣ DependencyContainer（依赖注入容器）

**功能**：
- 服务注册（单例、瞬时、工厂）
- 作用域隔离（全局、功能域）
- 自动依赖解析
- 继承和覆盖机制

**API示例**：
```javascript
const container = new DependencyContainer('my-app');

// 注册单例服务
container.register('logger', Logger, { scope: 'singleton' });

// 注册工厂函数
container.register('wsClient', createWSClient, {
  scope: 'singleton',
  factory: true
});

// 获取服务
const logger = container.get('logger');

// 创建子作用域
const featureScope = container.createScope('my-feature');
featureScope.register('featureService', FeatureService);
```

---

### 2️⃣ FeatureRegistry（功能注册中心）

**功能**：
- 功能注册和管理
- 依赖解析（拓扑排序）
- 生命周期管理（install/uninstall/enable/disable）
- 错误隔离

**IFeature接口**：
```javascript
class MyFeature {
  get name() {
    return 'my-feature';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return ['core', 'websocket'];
  }

  async install(context) {
    const { scopedEventBus, logger } = context;
    logger.info('MyFeature installed');
    // 注册事件监听、初始化状态等
  }

  async uninstall(context) {
    const { scopedEventBus, logger } = context;
    logger.info('MyFeature uninstalled');
    // 清理事件监听、清理状态等
  }
}
```

**API示例**：
```javascript
const registry = new FeatureRegistry({ container });

// 注册功能域
registry.register(new MyFeature());

// 安装所有功能（自动按依赖顺序）
await registry.installAll();

// 单独安装/卸载
await registry.install('my-feature');
await registry.uninstall('my-feature');

// 查询功能状态
const status = registry.getStatus('my-feature');
```

---

### 3️⃣ StateManager（响应式状态管理）

**功能**：
- 基于Proxy的响应式状态
- 嵌套对象自动代理
- 路径订阅机制
- 计算属性（缓存+懒加载）
- 状态快照和恢复
- 命名空间隔离

**API示例**：
```javascript
const stateManager = new StateManager();

// 创建功能域状态
const state = stateManager.createState('my-feature', {
  currentPage: 1,
  totalPages: 0,
  items: []
});

// 响应式订阅
state.subscribe('currentPage', (newPage, oldPage) => {
  console.log(`Page changed: ${oldPage} → ${newPage}`);
});

// 修改状态（自动触发订阅）
state.currentPage = 2;

// 计算属性
state.defineComputed('progress', () => {
  return (state.currentPage / state.totalPages * 100).toFixed(1);
});

// 状态快照
const snapshot = state.snapshot();
state.restore(snapshot);
```

---

### 4️⃣ FeatureFlagManager（Feature Flag管理）

**功能**：
- 配置文件加载
- 运行时启用/禁用
- 条件启用（环境、用户、角色、百分比）
- 变更监听
- 统计和导出

**API示例**：
```javascript
const flagManager = new FeatureFlagManager({
  environment: 'development'
});

// 加载配置
await flagManager.loadFromConfig('./config/feature-flags.json');

// 检查功能是否启用
if (flagManager.isEnabled('new-feature')) {
  await registry.install('new-feature');
}

// 运行时切换
flagManager.enable('debug-mode');
flagManager.disable('debug-mode');

// 监听变化
flagManager.on('change', ({ flag, enabled }) => {
  console.log(`Flag ${flag} changed to ${enabled}`);
});
```

**配置示例**：
```json
{
  "new-feature": {
    "enabled": true,
    "description": "新功能"
  },
  "experimental-feature": {
    "enabled": false,
    "rollout": 50,
    "description": "实验性功能（灰度发布50%）"
  }
}
```

---

## 🧪 测试

### 运行测试

```bash
# 运行所有micro-service测试
npm test -- src/frontend/common/micro-service/__tests__

# 运行单个组件测试
npm test -- src/frontend/common/micro-service/__tests__/dependency-container.test.js
```

### 测试覆盖率

```
Test Suites: 4 passed, 4 total
Tests:       159 passed, 159 total
Coverage:    100%
```

---

## 📚 使用场景

### ✅ 适用场景

1. **功能域架构**
   - 需要独立、可插拔的功能模块
   - 团队并行开发，降低Git冲突

2. **灰度发布和A/B测试**
   - 需要Feature Flag控制功能开关
   - 逐步推出新功能

3. **大型前端应用**
   - 多个模块共享基础设施
   - 需要统一的依赖注入和状态管理

### ❌ 不适用场景

1. **简单静态页面**
   - 无需复杂的架构支持

2. **单功能小应用**
   - 架构过重，增加复杂度

---

## 🔄 版本历史

| 版本 | 日期 | 来源 | 说明 |
|------|------|------|------|
| **1.0.0** | 2025-10-02 | PDF-Home (anki-linkmaster-B) | 首次提取为公共组件 |

---

## 📝 使用此组件的模块

| 模块 | 状态 | 说明 |
|------|------|------|
| **PDF-Home** | ✅ 已使用 | 2025年6月完成迁移，156个测试通过 |
| **PDF-Viewer** | 🚧 计划中 | v003架构重构，预计2025-10-16完成 |

---

## 🤝 贡献指南

### 修改公共组件时的注意事项

⚠️ **重要**：此目录包含被多个模块共享的核心组件，修改时需格外小心！

1. **向后兼容**
   - 新增功能时不能破坏现有API
   - 废弃API需要保留并标记为deprecated

2. **测试覆盖**
   - 所有修改必须有对应的测试用例
   - 确保159个测试全部通过

3. **影响范围评估**
   - 修改前评估对所有使用模块的影响
   - 在各模块中运行集成测试

4. **文档更新**
   - 修改API必须同步更新本README.md
   - 更新版本号和变更日志

---

## 📖 参考资料

- [PDF-Home架构重构总结](../../pdf-home/ARCHITECTURE-REFACTORING-SUMMARY.md)
- [PDF-Viewer v003规格说明](../../../todo-and-doing/2 todo/20251002040217-pdf-viewer-architecture-refactoring/v003-spec.md)
- [依赖注入模式](https://en.wikipedia.org/wiki/Dependency_injection)
- [功能切换（Feature Toggle）](https://martinfowler.com/articles/feature-toggles.html)

---

## 📧 联系方式

如有问题或建议，请：
1. 查阅本README.md
2. 运行测试验证
3. 查看源代码注释（JSDoc）
4. 参考PDF-Home的使用示例

---

**最后更新**: 2025-10-02
**维护者**: Anki-Linkmaster Team
**许可证**: MIT
