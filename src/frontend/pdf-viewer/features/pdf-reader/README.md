# PDF阅读器功能域

> **Phase 1 核心功能** | PDF文件加载、页面渲染、导航控制

## 📦 功能概述

PDF阅读器是PDF-Viewer的核心功能域，负责：
- PDF文件加载和解析
- 页面渲染
- 导航控制（上一页/下一页/跳转）
- 缩放控制
- 文本层管理
- 页面缓存管理

## 📁 目录结构

```
pdf-reader/
├── index.js                # 功能入口（实现IFeature接口）
├── feature.config.js       # 功能配置
├── README.md              # 本文档
├── components/            # UI组件（待实施）
├── services/              # 业务逻辑（待实施）
└── state/                 # 状态管理（待实施）
```

## 🎯 功能配置

| 配置项 | 值 |
|--------|-----|
| **名称** | `pdf-reader` |
| **版本** | `1.0.0` |
| **依赖** | 无 |
| **阶段** | Phase 1 |
| **优先级** | 高 |

## 📊 状态定义

```javascript
{
  pdfDocument: null,        // PDF文档对象
  currentPage: 1,           // 当前页码
  totalPages: 0,            // 总页数
  zoomLevel: 1.0,           // 缩放级别
  loadingStatus: {          // 加载状态
    isLoading: false,
    progress: 0,
    error: null
  },
  pageCache: {              // 页面缓存
    maxSize: 10,
    cachedPages: []
  }
}
```

## 📡 事件定义

### 文件加载事件
- `@pdf-reader/file:load:requested` - 请求加载文件
- `@pdf-reader/file:load:started` - 开始加载
- `@pdf-reader/file:load:progress` - 加载进度更新
- `@pdf-reader/file:load:success` - 加载成功
- `@pdf-reader/file:load:error` - 加载失败

### 页面导航事件
- `@pdf-reader/page:change:requested` - 请求切换页面
- `@pdf-reader/page:changed` - 页面已切换
- `@pdf-reader/page:render:start` - 开始渲染页面
- `@pdf-reader/page:render:success` - 渲染成功
- `@pdf-reader/page:render:error` - 渲染失败

### 缩放控制事件
- `@pdf-reader/zoom:change:requested` - 请求缩放
- `@pdf-reader/zoom:changed` - 缩放已变更

## 🛠️ 服务定义

| 服务名 | 职责 | 状态 |
|--------|------|------|
| `pdf-loader-service` | PDF文件加载 | 🚧 待实施（阶段3） |
| `pdf-document-manager` | PDF文档管理 | 🚧 待实施（阶段3） |
| `pdf-page-renderer` | 页面渲染 | 🚧 待实施（阶段3） |
| `pdf-page-cache-manager` | 页面缓存管理 | 🚧 待实施（阶段3） |

## 🚀 使用示例

```javascript
import { PDFReaderFeature } from './features/pdf-reader/index.js';
import { FeatureRegistry } from '../../common/micro-service/index.js';

// 创建功能注册中心
const registry = new FeatureRegistry({ container });

// 注册PDF阅读器功能
registry.register(new PDFReaderFeature());

// 安装功能
await registry.install('pdf-reader');

// 触发文件加载
scopedEventBus.emit('@pdf-reader/file:load:requested', {
  filePath: '/path/to/document.pdf'
});
```

## 📋 实施计划

| 阶段 | 任务 | 状态 |
|------|------|------|
| **阶段2** | 创建功能域骨架 | ✅ 完成 |
| **阶段3** | 迁移PDF加载逻辑 | 🚧 待实施 |
| **阶段3** | 迁移导航控制逻辑 | 🚧 待实施 |
| **阶段3** | 迁移缩放控制逻辑 | 🚧 待实施 |
| **阶段3** | 使用StateManager管理状态 | 🚧 待实施 |
| **阶段3** | 使用ScopedEventBus替代全局事件 | 🚧 待实施 |
| **阶段3** | 编写单元测试 | 🚧 待实施 |

## 🔄 迁移映射

```
现有代码 → 功能域

pdf/pdf-manager-refactored.js
  → services/pdf-manager-service.js

pdf/pdf-loader.js
  → components/pdf-loader.js

pdf/pdf-document-manager.js
  → services/document-service.js

pdf/page-cache-manager.js
  → components/page-cache.js

handlers/file-handler.js
handlers/navigation-handler.js
handlers/zoom-handler.js
  → services/（合并整合）
```

## ✅ 验收标准

- ✅ 功能可注册到FeatureRegistry
- ✅ 依赖关系正确解析
- ✅ 生命周期钩子（install/uninstall）正常工作
- 🚧 PDF加载功能正常（阶段3）
- 🚧 页面导航功能正常（阶段3）
- 🚧 缩放功能正常（阶段3）
- 🚧 单元测试覆盖率 > 80%（阶段3）

---

**最后更新**: 2025-10-02
**状态**: 🚧 骨架已创建，待实施具体功能
