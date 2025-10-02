# PDF-Viewer 配置文件

## 📁 文件说明

### `feature-flags.json`

功能开关配置文件，用于控制功能域的启用/禁用状态。

---

## 🚀 使用方法

### 基本用法

```javascript
import { FeatureFlagManager } from '../../common/micro-service/index.js';

const flagManager = new FeatureFlagManager({
  environment: 'development'
});

// 加载配置
await flagManager.loadFromConfig('./config/feature-flags.json');

// 检查功能是否启用
if (flagManager.isEnabled('pdf-bookmark')) {
  // 加载书签功能
}
```

---

## 🎛️ 配置结构

### 顶层配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 配置文件版本 |
| `environment` | string | 环境名称 (development/staging/production) |
| `description` | string | 配置文件描述 |
| `lastUpdated` | string | 最后更新时间 (ISO 8601) |
| `flags` | object | 功能标志定义 |

### 功能标志（Flag）配置

每个功能标志支持以下字段：

```json
{
  "feature-name": {
    "enabled": true,              // 是否启用
    "description": "功能描述",     // 功能说明
    "dependencies": [],           // 依赖的其他功能
    "rollout": 50,               // 灰度发布百分比 (0-100)
    "environments": ["dev"],      // 允许的环境
    "metadata": {                 // 元数据（可选）
      "phase": "Phase 1",
      "priority": "high",
      "includes": []
    }
  }
}
```

---

## 📋 当前功能（Phase 1）

### 核心功能

| 功能 | 标志名 | 状态 | 依赖 |
|------|--------|------|------|
| **PDF阅读器** | `pdf-reader` | 🚧 开发中 | - |
| **UI组件** | `pdf-ui` | 🚧 开发中 | pdf-reader |
| **书签管理** | `pdf-bookmark` | 🚧 开发中 | pdf-reader, pdf-ui |
| **WebSocket适配器** | `websocket-adapter` | 🚧 开发中 | - |

### 架构切换

| 功能 | 标志名 | 默认值 | 说明 |
|------|--------|--------|------|
| **功能域架构** | `use-feature-domain-architecture` | `false` | 启用v003架构 |

---

## 🔮 未来功能（Phase 2+）

| 功能 | 标志名 | 阶段 | 优先级 |
|------|--------|------|--------|
| **Anki制卡** | `anki-card-maker` | Phase 2 | 高 |
| **Anki启动器** | `anki-launcher` | Phase 2 | 中 |
| **翻译功能** | `translation` | Phase 2 | 中 |
| **AI助手** | `ai-assistant` | Phase 3 | 低 |

---

## 🛠️ 开发和调试

| 功能 | 标志名 | 说明 |
|------|--------|------|
| **调试模式** | `debug-mode` | 启用详细日志和性能监控 |
| **性能监控** | `performance-monitor` | 监控页面渲染和内存使用 |

---

## 📝 修改指南

### 启用功能

将功能的 `enabled` 字段设置为 `true`：

```json
{
  "pdf-bookmark": {
    "enabled": true,  // ← 修改这里
    "description": "书签管理功能"
  }
}
```

### 灰度发布

设置 `rollout` 字段（0-100）：

```json
{
  "anki-card-maker": {
    "enabled": true,
    "rollout": 50,  // ← 50%的用户可以使用
    "description": "Anki制卡功能"
  }
}
```

### 环境限制

限制功能只在特定环境启用：

```json
{
  "ai-assistant": {
    "enabled": true,
    "environments": ["development"],  // ← 只在开发环境启用
    "description": "AI助手功能"
  }
}
```

---

## ⚠️ 注意事项

1. **依赖关系**
   - 功能的依赖必须先启用
   - 例如：启用 `pdf-bookmark` 需要先启用 `pdf-reader` 和 `pdf-ui`

2. **环境匹配**
   - 功能的 `environments` 必须包含当前环境
   - 否则即使 `enabled: true` 也不会启用

3. **灰度发布**
   - `rollout` 值为 0-100 的整数
   - 0 表示禁用，100 表示全部启用
   - 中间值按百分比随机启用

4. **配置热更新**
   - 修改配置后需要重新加载
   - 某些功能可能需要重启应用

---

## 🔄 迁移计划

### 当前状态（2025-10-02）

- ✅ 阶段0.5：公共组件已创建
- ✅ 阶段1：集成测试已通过
- 🚧 阶段2-7：待实施

### 启用新架构

当功能域架构实施完成后，修改配置：

```json
{
  "use-feature-domain-architecture": {
    "enabled": true  // ← 切换到新架构
  }
}
```

---

## 📚 参考资料

- [v003规格说明](../../todo-and-doing/2 todo/20251002040217-pdf-viewer-architecture-refactoring/v003-spec.md)
- [微服务组件文档](../../common/micro-service/README.md)
- [Feature Flag最佳实践](https://martinfowler.com/articles/feature-toggles.html)

---

**最后更新**: 2025-10-02
**维护者**: Anki-Linkmaster Team
