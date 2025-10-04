# PDF Home 插件架构说明

## 概述

PDF Home 采用功能域模块化架构，每个功能作为独立插件，通过 EventBus 通信，完全解耦。

## 插件列表

### 核心插件

1. **pdf-list** - PDF 列表管理
   - 负责PDF数据的加载和管理
   - 状态：稳定 ✅

2. **pdf-editor** - PDF 元数据编辑
   - 编辑PDF的标题、作者等元数据
   - 状态：开发中 🚧

3. **pdf-sorter** - PDF 排序
   - 提供多种排序方式
   - 状态：稳定 ✅

4. **pdf-edit** - PDF 记录编辑
   - 编辑PDF相关记录
   - 状态：稳定 ✅

5. **filter** - 搜索和筛选
   - 提供搜索框、高级筛选、预设等功能
   - 状态：稳定 ✅

### 侧边栏插件系统

#### 6. **sidebar** (容器插件)
   - 侧边栏整体布局和收起/展开功能
   - 管理三个子插件
   - 状态：稳定 ✅
   - 版本：v2.0.0

#### 6.1 **recent-searches** (子插件)
   - 显示最近搜索的关键词
   - 依赖：sidebar
   - 状态：开发中 🚧
   - 文件位置：`features/sidebar/recent-searches/`

#### 6.2 **recent-opened** (子插件)
   - 显示最近阅读的PDF文档
   - 依赖：sidebar
   - 状态：开发中 🚧
   - 文件位置：`features/sidebar/recent-opened/`

#### 6.3 **recent-added** (子插件)
   - 显示最近添加的PDF文档
   - 依赖：sidebar
   - 状态：开发中 🚧
   - 文件位置：`features/sidebar/recent-added/`

### 搜索结果插件

#### 7. **search-results**
   - 显示PDF搜索结果表格
   - 处理表格交互（选择、双击等）
   - 依赖：filter
   - 状态：开发中 🚧
   - 文件位置：`features/search-results/`

#### 8. **search-result-item**
   - 渲染单个PDF搜索结果条目
   - 支持缩略图、标签、元数据显示
   - 依赖：search-results
   - 状态：开发中 🚧
   - 文件位置：`features/search-result-item/`

## 插件目录结构

每个插件遵循统一的目录结构：

```
features/[plugin-name]/
├── feature.config.js    # 插件配置（名称、版本、依赖、事件定义）
├── index.js             # 插件主类（必须实现 install/uninstall）
├── components/          # UI组件（可选）
├── services/            # 业务逻辑（可选）
└── styles/              # CSS样式（可选）
    └── [plugin-name].css
```

## 插件注册流程

1. **创建插件类**：实现 `install()` 和 `uninstall()` 方法
2. **导入到 core/pdf-home-app-v2.js**：添加 import 语句
3. **在 #registerFeatures() 中注册**：实例化插件并加入 features 数组
4. **配置 feature-flags.json**：添加插件开关

## Feature Flag 配置

在 `config/feature-flags.json` 中控制插件启用状态：

```json
{
  "plugin-name": {
    "enabled": true/false,
    "description": "插件描述",
    "version": "1.0.0",
    "meta": {
      "status": "stable|development",
      "owner": "team-name",
      "dependencies": ["依赖的其他插件"],
      "releasedAt": "发布日期"
    }
  }
}
```

## 插件通信规范

### EventBus 事件命名

- **本地事件**（插件内部）：使用 ScopedEventBus，事件名无前缀
  ```javascript
  this.#scopedEventBus.emit('item:clicked', data);
  ```

- **全局事件**（跨插件）：使用 GlobalEventBus，事件名格式：`模块:动作:状态`
  ```javascript
  this.#globalEventBus.emit('pdf:opened', data);
  ```

### 依赖注入

插件通过 DependencyContainer 获取依赖：

```javascript
dependencies = ['logger', 'eventBus'];

async install(context) {
  this.#logger = context.logger;
  this.#scopedEventBus = context.scopedEventBus;
  this.#globalEventBus = context.globalEventBus;
  // ...
}
```

## 新增插件清单（本次重构）

✅ 已创建文件结构（内容待实现）：

1. `features/sidebar/recent-searches/` - 最近搜索插件
2. `features/sidebar/recent-opened/` - 最近阅读插件
3. `features/sidebar/recent-added/` - 最近添加插件
4. `features/search-results/` - 搜索结果表格插件
5. `features/search-result-item/` - 搜索结果条目插件 ⭐新增

✅ 已注册到 bootstrap：

- 导入语句已添加到 `core/pdf-home-app-v2.js`
- 实例已加入 `#registerFeatures()` 方法
- Feature flags 已配置（默认关闭，开发中）

## 下一步开发计划

1. 实现各子插件的具体功能
2. 实现插件间的事件通信
3. 完善LocalStorage数据持久化
4. 更新 feature-flags.json 启用插件
5. 编写单元测试

## 备份文件

原侧边栏实现已备份：
- `features/sidebar/feature.config.js.backup`
- `features/sidebar/index.js.backup`
