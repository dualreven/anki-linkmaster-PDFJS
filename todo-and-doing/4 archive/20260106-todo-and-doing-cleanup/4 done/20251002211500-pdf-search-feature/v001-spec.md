# PDF Viewer 搜索功能规格说明

**功能ID**: 20251002211500-pdf-search-feature
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 21:15:11
**预计完成**: 2025-10-03
**状态**: 设计中

## 现状说明

### 当前系统状态
- PDF Viewer已实现Feature-based插件化架构
- 已有核心Features：app-core、pdf-manager、ui-manager
- UI管理层已集成缩放、导航、书签等功能
- Text Layer已启用，为搜索功能提供文本基础

### 已有功能基础
1. **EventBus事件总线**: 完整的事件驱动架构
2. **PDFViewerManager**: 封装PDF.js的核心功能
3. **TextLayerManager**: 文本层管理，已启用textContent
4. **依赖注入容器**: SimpleDependencyContainer管理Feature依赖

### 技术栈
- PDF.js 4.7.76 (支持PDFFindController)
- EventBus事件系统
- Feature插件架构
- TypeScript类型定义支持

## 存在问题

### 用户痛点
1. **无法搜索PDF内容**: 用户需要手动翻阅整个文档查找特定文本
2. **效率低下**: 大文档（数百页）中查找信息非常耗时
3. **缺少快捷键支持**: 用户习惯使用Ctrl+F进行搜索，但当前不支持

### 技术限制
1. **没有搜索UI**: 缺少搜索框、结果高亮、导航控件
2. **没有搜索引擎集成**: 未集成PDF.js的PDFFindController
3. **没有搜索事件定义**: 事件常量中没有搜索相关事件

## 提出需求

### 核心功能需求

#### 1. 搜索UI组件
- 搜索输入框（支持实时搜索）
- 搜索选项：区分大小写、全词匹配
- 结果计数显示（如："3/15"）
- 上一个/下一个结果导航按钮
- 关闭按钮

#### 2. 搜索引擎
- 集成PDF.js的PDFFindController
- 支持正则表达式搜索
- 支持跨页搜索
- 结果高亮显示

#### 3. 键盘快捷键
- **Ctrl+F / Cmd+F**: 打开搜索框
- **Enter**: 下一个结果
- **Shift+Enter**: 上一个结果
- **Esc**: 关闭搜索框

#### 4. 搜索结果管理
- 自动跳转到第一个匹配结果
- 高亮所有匹配文本
- 当前结果特殊高亮（不同颜色）
- 结果计数实时更新

### 性能要求
- **搜索响应时间**: < 500ms（200页文档）
- **UI响应**: 输入延迟 < 100ms（使用debounce）
- **内存占用**: 搜索不应显著增加内存使用
- **大文档支持**: 支持1000+页文档搜索

### 用户体验要求
- 搜索框位置固定（建议右上角）
- 搜索结果高亮清晰可见
- 支持连续搜索（保持搜索状态）
- 加载新PDF时自动清空搜索

## 解决方案

### 技术架构

#### Feature设计
```javascript
{
  name: 'search',
  version: '1.0.0',
  dependencies: ['app-core', 'pdf-manager', 'ui-manager'],
  description: 'PDF全文搜索功能，支持高亮、导航和快捷键'
}
```

#### 目录结构
```
features/search/
├── index.js                      # SearchFeature入口
├── components/
│   ├── search-ui.js             # 搜索UI组件（DOM、事件）
│   └── search-toolbar.js        # 搜索工具栏
├── services/
│   ├── search-engine.js         # 搜索引擎（PDFFindController封装）
│   └── search-state-manager.js  # 搜索状态管理
├── __tests__/
│   ├── search-feature.test.js
│   ├── search-engine.test.js
│   └── search-ui.test.js
└── README.md
```

### 事件接口设计

```javascript
// src/frontend/common/event/pdf-viewer-constants.js

SEARCH: {
  // UI控制事件
  OPEN: 'pdf-viewer:search:open',              // 打开搜索框 data: {}
  CLOSE: 'pdf-viewer:search:close',            // 关闭搜索框 data: {}
  TOGGLE: 'pdf-viewer:search:toggle',          // 切换搜索框 data: {}

  // 搜索执行事件
  QUERY: 'pdf-viewer:search:query',            // 执行搜索 data: { query, options }
  QUERY_CHANGED: 'pdf-viewer:search:query:changed',  // 搜索词变化 data: { query }

  // 搜索结果事件
  RESULT_FOUND: 'pdf-viewer:search:result:found',    // 找到结果 data: { results, total }
  RESULT_NOT_FOUND: 'pdf-viewer:search:result:not-found',  // 无结果 data: { query }
  RESULT_UPDATED: 'pdf-viewer:search:result:updated',      // 结果更新 data: { current, total }

  // 导航事件
  NAVIGATE_NEXT: 'pdf-viewer:search:navigate:next',  // 下一个结果 data: {}
  NAVIGATE_PREV: 'pdf-viewer:search:navigate:prev',  // 上一个结果 data: {}
  NAVIGATE_TO: 'pdf-viewer:search:navigate:to',      // 跳转到指定结果 data: { index }

  // 选项事件
  OPTION_CHANGED: 'pdf-viewer:search:option:changed',  // 选项改变 data: { option, value }
}
```

### 组件交互流程

```
用户输入 "关键词"
    ↓
SearchUI 捕获input事件 (debounce 300ms)
    ↓
emit SEARCH.QUERY { query: "关键词", options: {...} }
    ↓
SearchEngine 监听QUERY事件
    ↓
调用 PDFFindController.executeCommand('find', {...})
    ↓
emit SEARCH.RESULT_FOUND { results: [...], total: 15 }
    ↓
SearchUI 更新显示 "1/15"
    ↓
用户点击 "下一个"
    ↓
emit SEARCH.NAVIGATE_NEXT {}
    ↓
SearchEngine 调用 findController.highlightNextMatch()
    ↓
emit SEARCH.RESULT_UPDATED { current: 2, total: 15 }
```

### 核心类设计

#### SearchEngine类
```javascript
class SearchEngine {
  #eventBus
  #findController  // PDF.js PDFFindController
  #currentQuery
  #currentOptions
  #matchCount

  constructor(eventBus, pdfViewerManager)

  // 核心方法
  initialize()                          // 初始化findController
  executeSearch(query, options)         // 执行搜索
  highlightNextMatch()                  // 高亮下一个
  highlightPreviousMatch()              // 高亮上一个
  clearSearch()                         // 清空搜索

  // 事件处理
  #handleSearchQuery(data)              // 处理SEARCH.QUERY
  #handleNavigateNext()                 // 处理SEARCH.NAVIGATE_NEXT
  #handleNavigatePrev()                 // 处理SEARCH.NAVIGATE_PREV

  // findController回调
  #onFindResult(result)                 // 搜索结果回调
  #onUpdateMatchesCount(current, total) // 结果计数更新
}
```

#### SearchUI类
```javascript
class SearchUI {
  #eventBus
  #searchContainer   // 搜索框容器
  #queryInput        // 输入框
  #resultCount       // 结果计数显示
  #prevButton        // 上一个按钮
  #nextButton        // 下一个按钮
  #closeButton       // 关闭按钮
  #caseSensitiveCheckbox  // 区分大小写
  #wholeWordsCheckbox     // 全词匹配

  constructor(eventBus)

  // UI方法
  createUI()                  // 创建DOM
  show()                      // 显示搜索框
  hide()                      // 隐藏搜索框
  toggle()                    // 切换显示
  updateResultCount(current, total)  // 更新结果计数

  // 事件处理
  #handleInputChange()        // 输入变化（debounced）
  #handleNextClick()          // 点击"下一个"
  #handlePrevClick()          // 点击"上一个"
  #handleCloseClick()         // 点击"关闭"
  #handleKeyPress(e)          // 键盘事件
}
```

## 约束条件

### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer` 中的代码，不可修改其他模块（backend、pdf-home）的代码

### 严格遵循代码规范和标准
必须优先阅读和理解 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.yml` 下的代码规范（如果存在）

### Feature架构规范
1. 必须实现IFeature接口（name, version, dependencies, install(), uninstall()）
2. 必须通过依赖注入容器获取依赖
3. 必须使用EventBus进行通信，禁止直接调用其他Feature
4. 必须提供TypeScript类型定义

### PDF.js集成规范
1. 使用PDF.js官方PDFFindController API
2. 不修改PDF.js核心代码
3. 遵循PDF.js事件回调机制

### 代码质量要求
1. 所有公共方法必须有JSDoc注释
2. 私有方法使用#前缀
3. 事件订阅必须提供subscriberId
4. 必须处理所有错误情况

## 可行验收标准

### 单元测试

#### SearchEngine测试
- ✅ 初始化PDFFindController成功
- ✅ executeSearch正确调用findController API
- ✅ highlightNextMatch/Prev正确导航
- ✅ 搜索结果回调正确触发事件
- ✅ 清空搜索正确重置状态

#### SearchUI测试
- ✅ createUI生成正确的DOM结构
- ✅ show/hide/toggle正确改变显示状态
- ✅ 输入框输入触发正确事件（debounced）
- ✅ 按钮点击触发正确事件
- ✅ 键盘快捷键正确响应

#### SearchFeature测试
- ✅ install正确注册依赖和事件监听
- ✅ uninstall正确清理资源
- ✅ 依赖解析正确（依赖app-core、pdf-manager、ui-manager）

### 端到端测试

#### 基本搜索流程
1. 加载PDF文档（测试文档：至少100页，包含重复文本）
2. 按下Ctrl+F，搜索框出现
3. 输入"测试"，自动执行搜索
4. 验证：
   - 结果计数显示"1/N"（N>0）
   - 第一个结果高亮显示
   - 页面自动跳转到第一个结果所在页

#### 结果导航流程
1. 完成基本搜索
2. 点击"下一个"按钮
3. 验证：
   - 结果计数变为"2/N"
   - 当前结果高亮
   - 页面跳转到该结果所在页
4. 点击"上一个"按钮
5. 验证：回到"1/N"

#### 搜索选项流程
1. 勾选"区分大小写"
2. 搜索"Test"
3. 验证：只匹配大小写一致的"Test"，不匹配"test"
4. 勾选"全词匹配"
5. 搜索"test"
6. 验证：只匹配独立单词"test"，不匹配"testing"

#### 无结果流程
1. 搜索"不存在的文本xyzabc123"
2. 验证：
   - 显示"0/0"
   - emit SEARCH.RESULT_NOT_FOUND事件
   - 没有高亮

#### 快捷键流程
1. 按Ctrl+F → 搜索框打开
2. 输入文本后按Enter → 跳转到下一个结果
3. 按Shift+Enter → 跳转到上一个结果
4. 按Esc → 搜索框关闭，高亮清除

### 接口实现

#### 函数：executeSearch
```javascript
/**
 * 执行PDF文本搜索
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @param {boolean} options.caseSensitive - 是否区分大小写（默认false）
 * @param {boolean} options.wholeWords - 是否全词匹配（默认false）
 * @param {boolean} options.highlightAll - 是否高亮所有结果（默认true）
 * @returns {Promise<SearchResult>} 搜索结果
 *
 * @example
 * const result = await searchEngine.executeSearch('keyword', {
 *   caseSensitive: true,
 *   wholeWords: false
 * });
 * // result: { total: 15, matches: [...] }
 */
```

#### 函数：highlightNextMatch
```javascript
/**
 * 高亮下一个搜索结果
 * @returns {Promise<boolean>} 是否成功跳转
 * @throws {Error} 如果当前没有搜索结果
 */
```

#### 函数：highlightPreviousMatch
```javascript
/**
 * 高亮上一个搜索结果
 * @returns {Promise<boolean>} 是否成功跳转
 * @throws {Error} 如果当前没有搜索结果
 */
```

### 类实现

#### 类：SearchFeature
```javascript
/**
 * PDF搜索功能Feature
 * @implements {IFeature}
 */
class SearchFeature {
  /** @type {string} Feature名称 */
  name: 'search'

  /** @type {string} 版本号 */
  version: '1.0.0'

  /** @type {string[]} 依赖的其他Features */
  dependencies: ['app-core', 'pdf-manager', 'ui-manager']

  /** @type {SearchEngine} 搜索引擎实例 */
  #searchEngine

  /** @type {SearchUI} 搜索UI实例 */
  #searchUI

  /**
   * 安装Feature
   * @param {IDependencyContainer} container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(container)

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall()
}
```

#### 类：SearchEngine
```javascript
/**
 * PDF搜索引擎，封装PDF.js PDFFindController
 */
class SearchEngine {
  /**
   * @param {EventBus} eventBus - 事件总线
   * @param {PDFViewerManager} pdfViewerManager - PDF查看器管理器
   */
  constructor(eventBus, pdfViewerManager)

  /** 初始化搜索引擎 */
  initialize(): Promise<void>

  /** 执行搜索 */
  executeSearch(query: string, options: SearchOptions): Promise<SearchResult>

  /** 高亮下一个匹配 */
  highlightNextMatch(): Promise<boolean>

  /** 高亮上一个匹配 */
  highlightPreviousMatch(): Promise<boolean>

  /** 清空搜索 */
  clearSearch(): void
}
```

#### 类：SearchUI
```javascript
/**
 * 搜索UI组件，管理搜索框DOM和用户交互
 */
class SearchUI {
  /**
   * @param {EventBus} eventBus - 事件总线
   */
  constructor(eventBus)

  /** 创建UI元素 */
  createUI(): void

  /** 显示搜索框 */
  show(): void

  /** 隐藏搜索框 */
  hide(): void

  /** 切换显示 */
  toggle(): void

  /** 更新结果计数 */
  updateResultCount(current: number, total: number): void

  /** 销毁UI */
  destroy(): void
}
```

### 事件规范

#### 事件：SEARCH.OPEN
- **描述**: 打开搜索框
- **触发时机**: 用户按下Ctrl+F或点击搜索按钮
- **数据**: `{}`
- **订阅者**: SearchUI

#### 事件：SEARCH.QUERY
- **描述**: 执行搜索
- **触发时机**: 用户输入搜索词（debounced）或按下Enter
- **数据**: `{ query: string, options: SearchOptions }`
- **订阅者**: SearchEngine

#### 事件：SEARCH.RESULT_FOUND
- **描述**: 搜索完成，找到结果
- **触发时机**: SearchEngine完成搜索且有结果
- **数据**: `{ total: number, current: number, query: string }`
- **订阅者**: SearchUI（更新计数显示）

#### 事件：SEARCH.NAVIGATE_NEXT
- **描述**: 导航到下一个搜索结果
- **触发时机**: 用户点击"下一个"按钮或按Enter
- **数据**: `{}`
- **订阅者**: SearchEngine

#### 事件：SEARCH.NAVIGATE_PREV
- **描述**: 导航到上一个搜索结果
- **触发时机**: 用户点击"上一个"按钮或按Shift+Enter
- **数据**: `{}`
- **订阅者**: SearchEngine

## 实现计划

### Phase 1: 事件接口定义（1小时）
- [ ] 在pdf-viewer-constants.js中添加SEARCH事件定义
- [ ] 更新TypeScript类型定义（types/events.d.ts）
- [ ] 提交commit

### Phase 2: SearchEngine实现（3小时）
- [ ] 实现SearchEngine类
- [ ] 集成PDF.js PDFFindController
- [ ] 实现搜索、导航、清空功能
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 3: SearchUI实现（3小时）
- [ ] 实现SearchUI类
- [ ] 创建搜索框DOM
- [ ] 实现用户交互（输入、点击、快捷键）
- [ ] 实现结果显示更新
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 4: SearchFeature集成（2小时）
- [ ] 实现SearchFeature类
- [ ] 注册到FeatureRegistry
- [ ] 添加到bootstrap流程
- [ ] 端到端测试
- [ ] 提交commit

### Phase 5: 文档和优化（1小时）
- [ ] 编写README.md
- [ ] 更新ARCHITECTURE.md
- [ ] 性能优化（debounce、throttle）
- [ ] 最终测试
- [ ] 提交最终commit

**总预计时间**: 10小时

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| PDF.js API变化 | 🟡 中 | 使用稳定版本4.7.76，参考官方文档 |
| 大文档性能问题 | 🟡 中 | 实现debounce，测试1000+页文档 |
| 高亮冲突 | 🟢 低 | 使用PDF.js内置高亮机制 |
| 事件命名冲突 | 🟢 低 | 遵循现有命名规范，使用pdf-viewer:前缀 |
| UI与现有控件冲突 | 🟡 中 | 独立容器，z-index管理，响应式布局 |

## 参考资料

### PDF.js文档
- [PDFFindController API](https://mozilla.github.io/pdf.js/api/draft/PDFFindController.html)
- [Text Search Example](https://github.com/mozilla/pdf.js/tree/master/examples/text-search)

### 项目文档
- [Feature开发指南](../../../src/frontend/pdf-viewer/docs/FEATURE-DEVELOPMENT-GUIDE.md)
- [架构文档](../../../src/frontend/pdf-viewer/docs/ARCHITECTURE.md)
- [TypeScript类型定义](../../../src/frontend/pdf-viewer/types/features.d.ts)

### 类似实现参考
- Chrome PDF Viewer搜索功能
- Firefox PDF Viewer搜索功能
- Adobe Acrobat Reader搜索功能
