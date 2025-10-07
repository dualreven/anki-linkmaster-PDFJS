# Search 搜索功能插件

## 概述

Search 插件是用户搜索的起点，提供简洁的搜索框UI和基础搜索逻辑。与 Filter 插件协作，实现完整的搜索和筛选功能。

## 职责

- ✅ 渲染搜索框UI（输入框、搜索按钮、清除按钮）
- ✅ 提供添加和排序按钮
- ✅ 处理用户搜索输入（实时搜索、防抖）
- ✅ 发出搜索请求事件
- ✅ 显示搜索结果统计

## 架构设计

### 插件协作流程

```
用户输入搜索关键词
    ↓
Search 插件（发出 search:query:requested）
    ↓
SearchResults 插件（执行搜索、展示结果）
    ↓
Filter 插件（可选：应用高级筛选条件）
    ↓
SearchResults 插件（发出 search:results:updated）
    ↓
Search 插件（更新统计信息）
```

### 事件通信

**发出的事件（全局）**：
- `search:query:requested` - 搜索请求（携带 searchText）
- `search:clear:requested` - 清除搜索请求
- `search:add:requested` - 点击添加按钮
- `search:sort:requested` - 点击排序按钮

**监听的事件（全局）**：
- `search:results:updated` - 搜索结果更新（用于更新统计）

## 组件结构

```
features/search/
├── feature.config.js       # 插件配置
├── index.js                # 插件入口（SearchFeature）
├── README.md               # 本文档
├── components/
│   └── search-bar.js       # 搜索框UI组件
└── styles/
    └── search-bar.css      # 搜索框样式
```

## 使用示例

### 1. 启用插件

在 `config/feature-flags.json` 中启用：

```json
{
  "search": {
    "enabled": true,
    "status": "stable"
  }
}
```

### 2. 编程式控制

```javascript
// 获取搜索框实例（通过事件）
globalEventBus.emit('search:query:requested', {
  searchText: 'JavaScript'
});

// 监听搜索事件
globalEventBus.on('search:query:requested', (data) => {
  console.log('搜索关键词:', data.searchText);
  // 执行搜索逻辑...
});
```

### 3. 配置选项

在 `feature.config.js` 中可配置：

```javascript
config: {
  debounceDelay: 300,           // 实时搜索防抖延迟（毫秒）
  enableLiveSearch: true,       // 是否启用实时搜索
  placeholder: '搜索...'        // 搜索框占位符
}
```

## 与其他插件的协作

### 与 Filter 插件

- Search 提供基础关键词搜索
- Filter 提供高级筛选条件构建
- 两者通过 EventBus 协作，互不依赖

### 与 SearchResults 插件

- Search 发出搜索请求
- SearchResults 执行搜索并展示结果
- SearchResults 更新统计信息给 Search

### 与 PDFList 插件

- Search 的添加/排序按钮点击事件可被 PDFList 监听
- PDFList 负责实际的添加和排序逻辑

## 注意事项

1. **事件命名规范**：严格遵守三段式格式 `search:action:status`
2. **EventBus 使用**：
   - 内部事件使用 `scopedEventBus`（自动添加 @search/ 前缀）
   - 跨插件通信使用 `globalEventBus`
3. **职责边界**：
   - Search 只负责UI和事件发出
   - 不负责实际搜索逻辑（由 SearchResults 处理）
4. **性能优化**：
   - 实时搜索使用防抖（默认300ms）
   - 避免频繁触发搜索请求

## 开发计划

- [x] v1.0.0 - 基础搜索框UI
- [ ] v1.1.0 - 搜索历史记录
- [ ] v1.2.0 - 搜索建议/自动完成
- [ ] v2.0.0 - 语音搜索支持
