# PDF Viewer 标注栏功能规格说明（第二期：UI深化）

**功能ID**: 20251004030600-pdf-annotation-sidebar-stage2
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-04 03:06:00
**预计完成**: 2025-10-10
**状态**: 设计中
**依赖需求**: 20251002213000-pdf-annotation-sidebar (第一期)

## 现状说明

### 当前系统状态
- ✅ 第一期已完成：基础标注功能（截图、选字、批注）
- ✅ 标注侧边栏已实现：工具栏、标注列表、评论功能
- ✅ 数据持久化已实现：WebSocket通信、JSON存储
- ✅ 标注渲染已实现：三种标注类型在PDF上正确显示

### 已有功能基础
1. **AnnotationSidebarUI**: 基础侧边栏实现
2. **AnnotationManager**: 标注CRUD管理
3. **标注卡片**: 显示标注类型、内容、时间、页码
4. **评论系统**: 可添加、查看评论

## 存在问题

### 用户痛点
1. **操作按钮过大**: 工具栏按钮占用空间大，影响列表显示
2. **标注不可点击追加评论**: 必须通过菜单才能添加评论，操作繁琐
3. **标注ID不可复制**: 调试时无法快速复制标注ID进行追踪
4. **无法筛选标注**: 标注过多时无法快速找到想要的标注
5. **无法排序标注**: 无法按不同维度查看标注（时间/页码）
6. **只能查看全部标注**: 无法仅查看当前页的标注

### 技术限制
1. **按钮尺寸固定**: 没有响应式设计，按钮尺寸不可调整
2. **筛选功能缺失**: 没有筛选UI和筛选逻辑
3. **排序功能缺失**: 没有排序UI和排序逻辑
4. **页面关联缺失**: 没有标注与当前页面的关联机制

## 提出需求

### 核心功能需求（第二期）

#### 1. 操作按钮优化

**工具栏按钮改小**
- 将工具栏按钮从大尺寸（40px × 40px）改为小尺寸（28px × 28px）
- 使用纯图标，移除文字标签
- 添加Tooltip提示（鼠标悬停显示名称）
- 按钮间距减小（4px → 2px）
- 工具栏整体高度从60px减少到40px

**按钮布局**
```
旧布局（第一期）:
┌────────────────────────────────────┐
│  [📷 截图] [✏️ 选字] [📝 批注]  [✕] │  60px高
└────────────────────────────────────┘

新布局（第二期）:
┌──────────────────────────────┐
│  [📷] [✏️] [📝] [🔍] [⚙️] [✕] │  40px高
└──────────────────────────────┘
```

#### 2. 标注对象可点击追加评论、可复制ID

**标注卡片点击区域增强**
```
旧版标注卡片:
┌────────────────────────┐
│ 📷 截图标注             │ [→] [...]
│ 页码: P.23             │
│ 时间: 2025-10-02       │
│ 💬 2条评论             │
└────────────────────────┘

新版标注卡片:
┌────────────────────────┐
│ 📷 截图标注             │ [→] [📋] [...]
│ ID: ann_abc123 [复制]   │  ← 新增ID行，可点击复制
│ 页码: P.23             │
│ 时间: 2025-10-02       │
│ 💬 2条评论 [点击追加]   │  ← 可点击区域
└────────────────────────┘
   ↑ 整个卡片可点击展开评论区
```

**交互行为**
- **点击卡片主体**: 展开/收起评论区域
- **点击"复制"按钮**: 复制标注ID到剪贴板，显示提示"已复制"
- **点击"💬 N条评论"**: 展开评论区并聚焦输入框
- **点击跳转按钮 [→]**: 跳转到标注位置（不展开评论）
- **点击菜单按钮 [...]**: 显示编辑/删除菜单

**评论区展开状态**
```
┌────────────────────────────────┐
│ 📷 截图标注                     │ [→] [📋] [...]
│ ID: ann_abc123 [复制]           │
│ 页码: P.23                     │
│ 时间: 2025-10-02               │
│ 💬 2条评论 [收起]               │
├────────────────────────────────┤
│ 📝 用户1: 这是第一条评论        │
│    2025-10-02 15:30            │
├────────────────────────────────┤
│ 📝 用户2: 这是第二条评论        │
│    2025-10-02 16:00            │
├────────────────────────────────┤
│ [输入评论...]         [发送]   │
└────────────────────────────────┘
```

#### 3. 新增筛选按钮

**筛选工具栏**
- 位置：标注列表上方，工具栏下方
- 高度：35px
- 默认收起，点击🔍按钮展开

**筛选选项**

##### 3.1 根据添加日期筛选
```
┌────────────────────────────────┐
│ 筛选条件:                      │
│ ○ 全部时间                     │
│ ○ 今天                         │
│ ○ 最近7天                      │
│ ○ 最近30天                     │
│ ○ 自定义日期范围                │
│   [开始日期] ~ [结束日期]       │
└────────────────────────────────┘
```

**日期筛选逻辑**
- **今天**: `createdAt >= 今天00:00:00`
- **最近7天**: `createdAt >= 7天前00:00:00`
- **最近30天**: `createdAt >= 30天前00:00:00`
- **自定义日期**: 用户指定起止日期

##### 3.2 仅显示当前页标注
```
┌────────────────────────────────┐
│ 页面筛选:                      │
│ ☑ 仅显示当前页标注 (P.23)      │
│ □ 显示所有页标注               │
└────────────────────────────────┘
```

**页面筛选逻辑**
- 监听PDF页面切换事件：`PDF_VIEWER.PAGE_CHANGED`
- 自动更新"当前页"显示（例：P.23）
- 勾选后仅显示 `annotation.pageNumber === currentPageNumber` 的标注
- 取消勾选后显示所有标注

##### 3.3 按标注类型筛选
```
┌────────────────────────────────┐
│ 标注类型:                      │
│ ☑ 📷 截图标注                  │
│ ☑ ✏️ 选字标注                  │
│ ☑ 📝 批注标注                  │
└────────────────────────────────┘
```

**类型筛选逻辑**
- 支持多选（可同时勾选多种类型）
- 仅显示勾选类型的标注
- 默认全选（显示所有类型）

**筛选UI展开/收起**
```
收起状态:
┌────────────────────────────────┐
│  [📷] [✏️] [📝] [🔍] [⚙️] [✕]  │  ← 工具栏
├────────────────────────────────┤
│ 标注列表 (共15条)               │
│ ...                            │
└────────────────────────────────┘

展开状态:
┌────────────────────────────────┐
│  [📷] [✏️] [📝] [🔍] [⚙️] [✕]  │  ← 工具栏
├────────────────────────────────┤
│ 筛选条件 [收起]                 │  ← 筛选面板（35px高）
│ 日期: [今天▼] 类型: [全部▼]     │
│ ☑ 仅显示当前页 (P.23)           │
├────────────────────────────────┤
│ 标注列表 (筛选后3条)             │
│ ...                            │
└────────────────────────────────┘
```

#### 4. 新增排序按钮

**排序工具栏**
- 位置：标注列表上方（筛选条件下方）
- 高度：30px
- 始终可见

**排序选项**
```
┌────────────────────────────────┐
│ 排序: [添加日期▼] [倒序 ⬇]      │
│                                │
│ 排序方式:                      │
│ ○ 按添加日期                   │
│ ○ 按修改日期                   │
│ ○ 按页码                       │
│                                │
│ 排序顺序:                      │
│ ○ 正序 (⬆ 最早/最小在前)        │
│ ○ 倒序 (⬇ 最新/最大在前)        │
└────────────────────────────────┘
```

**排序逻辑**

##### 4.1 按添加日期排序
- **正序**: `createdAt` 升序（最早的标注在前）
- **倒序**: `createdAt` 降序（最新的标注在前）
- 默认：倒序

##### 4.2 按修改日期排序
- **正序**: `updatedAt` 升序（最早修改的在前）
- **倒序**: `updatedAt` 降序（最近修改的在前）
- 默认：倒序

##### 4.3 按页码排序
- **正序**: `pageNumber` 升序（第1页在前）
- **倒序**: `pageNumber` 降序（最后一页在前）
- 默认：正序

**排序UI示例**
```
当前排序: 按添加日期 倒序
┌────────────────────────────────┐
│ 📝 批注标注                     │
│ 时间: 2025-10-04 10:30 (最新)  │
├────────────────────────────────┤
│ ✏️ 选字标注                     │
│ 时间: 2025-10-03 15:20         │
├────────────────────────────────┤
│ 📷 截图标注                     │
│ 时间: 2025-10-02 08:10         │
└────────────────────────────────┘

当前排序: 按页码 正序
┌────────────────────────────────┐
│ 📷 截图标注                     │
│ 页码: P.5                      │
├────────────────────────────────┤
│ ✏️ 选字标注                     │
│ 页码: P.23                     │
├────────────────────────────────┤
│ 📝 批注标注                     │
│ 页码: P.67                     │
└────────────────────────────────┘
```

#### 5. 综合UI布局（第二期完整界面）

```
┌────────────────────────────────────┐
│  [📷] [✏️] [📝] [🔍] [⚙️] [✕]      │  ← 工具栏（40px）
├────────────────────────────────────┤
│ 筛选: [今天▼] [全部类型▼] [收起▼]  │  ← 筛选工具栏（35px，可收起）
│ ☑ 仅显示当前页 (P.23)               │
├────────────────────────────────────┤
│ 排序: [添加日期▼] [倒序 ⬇]          │  ← 排序工具栏（30px）
├────────────────────────────────────┤
│ 标注列表 (筛选后5条 / 共20条)        │  ← 标注列表
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 📷 截图标注                     │ │
│ │ ID: ann_abc123 [复制]           │ │
│ │ 页码: P.23 | 2025-10-04 10:30  │ │
│ │ 💬 2条评论 [点击追加]   [→] [...] │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ✏️ 选字标注                     │ │
│ │ ID: ann_def456 [复制]           │ │
│ │ 页码: P.23 | 2025-10-03 15:20  │ │
│ │ 💬 0条评论 [点击追加]   [→] [...] │ │
│ └────────────────────────────────┘ │
│                                    │
│ ...                                │
└────────────────────────────────────┘
```

### 性能要求
- **按钮响应时间**: < 100ms（点击后立即响应）
- **筛选计算时间**: < 200ms（1000个标注）
- **排序计算时间**: < 300ms（1000个标注）
- **ID复制响应**: < 50ms（点击后立即复制）
- **列表渲染时间**: < 500ms（筛选/排序后重新渲染）

### 用户体验要求
- 按钮尺寸适中，不占用过多空间
- 筛选和排序选项清晰易懂
- 支持快捷键（F3筛选当前页，F4切换排序）
- 复制ID后显示Toast提示"已复制"
- 筛选/排序状态持久化（重新打开PDF时保持上次设置）

## 解决方案

### 技术架构

#### 目录结构更新
```
features/annotation/
├── components/
│   ├── annotation-sidebar-ui.js         # 标注侧边栏UI（更新）
│   ├── annotation-toolbar.js            # 标注工具栏（更新，按钮改小）
│   ├── annotation-card.js               # 标注卡片组件（更新，新增ID和点击）
│   ├── filter-panel.js                  # 新增：筛选面板
│   ├── sort-panel.js                    # 新增：排序面板
│   └── ...（第一期已有）
├── services/
│   ├── annotation-manager.js            # 标注管理器（更新，新增筛选/排序）
│   ├── annotation-filter.js             # 新增：标注筛选服务
│   ├── annotation-sorter.js             # 新增：标注排序服务
│   └── ...（第一期已有）
├── utils/
│   ├── clipboard-helper.js              # 新增：剪贴板辅助工具
│   └── date-filter.js                   # 新增：日期筛选工具
└── ...
```

### 事件接口设计

```javascript
// src/frontend/common/event/pdf-viewer-constants.js

ANNOTATION: {
  // ...（第一期已有事件）

  // 筛选事件（新增）
  FILTER_CHANGE: 'pdf-viewer:annotation:filter:change',          // 筛选条件改变 data: { filters }
  FILTER_APPLY: 'pdf-viewer:annotation:filter:apply',            // 应用筛选 data: { filters }
  FILTER_RESET: 'pdf-viewer:annotation:filter:reset',            // 重置筛选 data: {}

  // 排序事件（新增）
  SORT_CHANGE: 'pdf-viewer:annotation:sort:change',              // 排序方式改变 data: { sortBy, sortOrder }
  SORT_APPLY: 'pdf-viewer:annotation:sort:apply',                // 应用排序 data: { sortBy, sortOrder }

  // UI交互事件（新增）
  CARD_EXPAND: 'pdf-viewer:annotation:card:expand',              // 展开标注卡片 data: { id }
  CARD_COLLAPSE: 'pdf-viewer:annotation:card:collapse',          // 收起标注卡片 data: { id }
  ID_COPY: 'pdf-viewer:annotation:id:copy',                      // 复制标注ID data: { id }
  ID_COPIED: 'pdf-viewer:annotation:id:copied',                  // ID已复制 data: { id }

  // 页面关联事件（新增）
  SHOW_CURRENT_PAGE_ONLY: 'pdf-viewer:annotation:show-current-page',  // 仅显示当前页 data: { enabled }
}
```

### 核心类设计

#### AnnotationFilter类
```javascript
/**
 * 标注筛选服务
 */
class AnnotationFilter {
  #filters = {
    dateRange: 'all',       // 'all' | 'today' | 'week' | 'month' | 'custom'
    customStartDate: null,
    customEndDate: null,
    currentPageOnly: false,
    types: ['screenshot', 'text-highlight', 'comment']  // 启用的类型
  }

  /**
   * 应用筛选条件
   * @param {Array<Annotation>} annotations - 原始标注列表
   * @param {number} currentPageNumber - 当前页码
   * @returns {Array<Annotation>} 筛选后的标注列表
   */
  apply(annotations, currentPageNumber)

  setDateRange(range)                    // 设置日期范围
  setCustomDateRange(startDate, endDate) // 设置自定义日期范围
  toggleCurrentPageOnly(enabled)         // 切换仅显示当前页
  toggleType(type, enabled)              // 切换类型筛选
  reset()                                // 重置筛选条件
  getFilters()                           // 获取当前筛选条件

  // 内部方法
  #filterByDate(annotations)             // 按日期筛选
  #filterByPage(annotations, pageNumber) // 按页码筛选
  #filterByType(annotations)             // 按类型筛选
}
```

#### AnnotationSorter类
```javascript
/**
 * 标注排序服务
 */
class AnnotationSorter {
  #sortBy = 'createdAt'      // 'createdAt' | 'updatedAt' | 'pageNumber'
  #sortOrder = 'desc'        // 'asc' | 'desc'

  /**
   * 应用排序
   * @param {Array<Annotation>} annotations - 原始标注列表
   * @returns {Array<Annotation>} 排序后的标注列表
   */
  apply(annotations)

  setSortBy(sortBy)                      // 设置排序字段
  setSortOrder(order)                    // 设置排序顺序
  toggleSortOrder()                      // 切换排序顺序
  getSortConfig()                        // 获取当前排序配置

  // 内部方法
  #sortByCreatedAt(a, b)                 // 按创建时间排序
  #sortByUpdatedAt(a, b)                 // 按修改时间排序
  #sortByPageNumber(a, b)                // 按页码排序
}
```

#### FilterPanel类
```javascript
/**
 * 筛选面板UI组件
 */
class FilterPanel {
  #eventBus
  #container
  #isExpanded = false
  #currentPageNumber

  constructor(eventBus)

  // UI方法
  createUI()                             // 创建DOM结构
  expand()                               // 展开面板
  collapse()                             // 收起面板
  toggle()                               // 切换展开/收起
  updateCurrentPage(pageNumber)          // 更新当前页显示

  // 事件处理
  #handleDateRangeChange(range)          // 处理日期范围改变
  #handleCurrentPageToggle(enabled)      // 处理仅显示当前页切换
  #handleTypeToggle(type, enabled)       // 处理类型切换
  #handleReset()                         // 处理重置按钮

  // 辅助方法
  #createDateRangeSelector()             // 创建日期范围选择器
  #createCurrentPageCheckbox()           // 创建当前页复选框
  #createTypeCheckboxes()                // 创建类型复选框
}
```

#### SortPanel类
```javascript
/**
 * 排序面板UI组件
 */
class SortPanel {
  #eventBus
  #container
  #sortBy = 'createdAt'
  #sortOrder = 'desc'

  constructor(eventBus)

  // UI方法
  createUI()                             // 创建DOM结构
  updateUI()                             // 更新UI显示

  // 事件处理
  #handleSortByChange(sortBy)            // 处理排序字段改变
  #handleSortOrderToggle()               // 处理排序顺序切换

  // 辅助方法
  #createSortBySelector()                // 创建排序字段选择器
  #createSortOrderButton()               // 创建排序顺序按钮
}
```

#### AnnotationCard类（更新）
```javascript
/**
 * 标注卡片组件（第二期更新）
 */
class AnnotationCard {
  #eventBus
  #annotation
  #isExpanded = false

  constructor(eventBus, annotation)

  // UI方法
  render()                               // 渲染卡片
  expand()                               // 展开评论区
  collapse()                             // 收起评论区
  toggle()                               // 切换展开/收起

  // 事件处理
  #handleCardClick()                     // 处理卡片点击（展开/收起）
  #handleCopyIdClick(e)                  // 处理复制ID点击
  #handleCommentClick(e)                 // 处理评论区点击
  #handleJumpClick(e)                    // 处理跳转点击（阻止冒泡）
  #handleMenuClick(e)                    // 处理菜单点击（阻止冒泡）

  // 辅助方法
  #createIdRow()                         // 创建ID行（新增）
  #createCommentRow()                    // 创建评论行（新增可点击）
  #createExpandedCommentArea()           // 创建展开的评论区（新增）
}
```

#### ClipboardHelper类
```javascript
/**
 * 剪贴板辅助工具
 */
class ClipboardHelper {
  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>} 是否成功
   */
  static async copyText(text)

  /**
   * 显示复制成功提示
   * @param {string} message - 提示消息
   */
  static showCopyToast(message)
}
```

#### AnnotationManager类（更新）
```javascript
/**
 * 标注管理器 - 核心业务逻辑（第二期更新）
 */
class AnnotationManager {
  // ...（第一期已有属性）

  #filter                // AnnotationFilter
  #sorter                // AnnotationSorter
  #currentPageNumber     // 当前页码
  #filteredAnnotations   // 筛选后的标注
  #sortedAnnotations     // 排序后的标注

  constructor(eventBus, storage, renderer, filter, sorter)

  // 筛选和排序方法（新增）
  applyFilter(filters)                   // 应用筛选
  applySort(sortBy, sortOrder)           // 应用排序
  updateCurrentPage(pageNumber)          // 更新当前页码
  getFilteredAndSortedAnnotations()      // 获取筛选排序后的标注

  // 事件处理（新增）
  #handleFilterChange(data)              // 处理筛选改变
  #handleSortChange(data)                // 处理排序改变
  #handlePageChange(data)                // 处理页面改变
  #handleIdCopy(data)                    // 处理ID复制
}
```

### 数据模型更新

#### FilterConfig接口
```javascript
/**
 * 筛选配置
 */
interface FilterConfig {
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom'
  customStartDate?: Date
  customEndDate?: Date
  currentPageOnly: boolean
  types: Array<'screenshot' | 'text-highlight' | 'comment'>
}
```

#### SortConfig接口
```javascript
/**
 * 排序配置
 */
interface SortConfig {
  sortBy: 'createdAt' | 'updatedAt' | 'pageNumber'
  sortOrder: 'asc' | 'desc'
}
```

### 状态持久化

**使用LocalStorage保存用户偏好**
```javascript
// 保存筛选和排序配置
const userPreferences = {
  filter: {
    dateRange: 'today',
    currentPageOnly: true,
    types: ['screenshot', 'text-highlight']
  },
  sort: {
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
}

localStorage.setItem('annotation-preferences', JSON.stringify(userPreferences))
```

## 约束条件

### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/annotation` 中的代码，不修改其他Feature

### 严格遵循代码规范和标准
- 必须遵循第一期的代码风格和架构
- 必须使用EventBus进行通信
- 必须编写单元测试

### 向后兼容
- 第二期功能不能破坏第一期功能
- 数据结构保持兼容
- 事件接口向后兼容

### UI设计规范
- 保持与第一期UI风格一致
- 按钮图标使用Emoji或Font Awesome
- 筛选和排序面板可折叠，默认收起

## 可行验收标准

### 单元测试

#### AnnotationFilter测试
- ✅ filterByDate正确筛选今天的标注
- ✅ filterByDate正确筛选最近7天的标注
- ✅ filterByPage正确筛选当前页标注
- ✅ filterByType正确筛选指定类型标注
- ✅ 组合筛选正确工作（日期 + 页面 + 类型）
- ✅ reset正确重置筛选条件

#### AnnotationSorter测试
- ✅ sortByCreatedAt正确按创建时间排序
- ✅ sortByUpdatedAt正确按修改时间排序
- ✅ sortByPageNumber正确按页码排序
- ✅ toggleSortOrder正确切换排序顺序

#### FilterPanel测试
- ✅ createUI生成正确DOM结构
- ✅ 日期范围选择器正确工作
- ✅ 当前页复选框正确触发事件
- ✅ 类型复选框正确触发事件
- ✅ 展开/收起动画流畅

#### SortPanel测试
- ✅ createUI生成正确DOM结构
- ✅ 排序字段选择器正确触发事件
- ✅ 排序顺序按钮正确切换

#### AnnotationCard测试
- ✅ ID行正确显示和格式化
- ✅ 复制ID按钮正确复制到剪贴板
- ✅ 卡片点击正确展开/收起评论区
- ✅ 评论区点击正确聚焦输入框
- ✅ 跳转和菜单按钮不触发卡片点击

#### ClipboardHelper测试
- ✅ copyText正确复制文本
- ✅ showCopyToast显示提示并自动消失

### 端到端测试

#### 测试1: 按钮优化验证
1. 打开标注侧边栏
2. 验证：
   - 工具栏按钮尺寸为28px × 28px
   - 仅显示图标，无文字
   - 鼠标悬停显示Tooltip
   - 工具栏高度为40px（比第一期减少20px）

#### 测试2: ID复制功能
1. 创建一个标注
2. 验证：标注卡片显示ID行
3. 点击"复制"按钮
4. 验证：
   - 剪贴板包含正确的标注ID
   - 显示Toast提示"已复制"
   - 提示3秒后自动消失

#### 测试3: 标注卡片可点击追加评论
1. 创建一个标注
2. 点击标注卡片主体（非按钮区域）
3. 验证：
   - 评论区展开
   - 评论输入框显示
4. 输入评论并发送
5. 验证：
   - 评论显示在列表中
   - 评论数量更新
6. 再次点击卡片
7. 验证：评论区收起

#### 测试4: 日期筛选功能
1. 创建多个标注（不同日期）
2. 点击🔍按钮展开筛选面板
3. 选择"今天"
4. 验证：仅显示今天创建的标注
5. 选择"最近7天"
6. 验证：显示最近7天创建的标注
7. 选择"自定义日期范围"，输入日期
8. 验证：仅显示指定日期范围的标注

#### 测试5: 仅显示当前页标注
1. 创建多个标注（不同页码）
2. 导航到第23页
3. 勾选"仅显示当前页标注"
4. 验证：
   - 仅显示第23页的标注
   - 筛选信息显示"(P.23)"
5. 导航到第45页
6. 验证：
   - 自动更新为第45页的标注
   - 筛选信息显示"(P.45)"
7. 取消勾选
8. 验证：显示所有页的标注

#### 测试6: 类型筛选功能
1. 创建三种类型的标注
2. 取消勾选"截图标注"
3. 验证：截图标注不显示，其他类型显示
4. 仅勾选"批注标注"
5. 验证：仅显示批注标注

#### 测试7: 排序功能
1. 创建多个标注（不同时间和页码）
2. 选择"按添加日期"，倒序
3. 验证：最新的标注在最前面
4. 点击排序顺序按钮切换为正序
5. 验证：最早的标注在最前面
6. 选择"按页码"，正序
7. 验证：第1页的标注在前，最后一页在后
8. 选择"按修改日期"，倒序
9. 编辑一个旧标注
10. 验证：刚编辑的标注跳到最前面

#### 测试8: 组合筛选和排序
1. 创建10个标注（不同类型、时间、页码）
2. 设置筛选：今天 + 仅当前页 + 仅截图标注
3. 设置排序：按添加时间倒序
4. 验证：
   - 仅显示符合筛选条件的标注
   - 标注按时间倒序排列
   - 列表显示"筛选后N条 / 共10条"

#### 测试9: 状态持久化
1. 设置筛选：最近7天 + 仅截图标注
2. 设置排序：按页码正序
3. 关闭PDF文档
4. 重新打开同一PDF
5. 验证：
   - 筛选条件保持"最近7天 + 仅截图标注"
   - 排序保持"按页码正序"
   - 标注列表按上次设置显示

### 接口实现

#### 函数：applyFilter
```javascript
/**
 * 应用筛选条件
 * @param {FilterConfig} filters - 筛选配置
 * @returns {Array<Annotation>} 筛选后的标注列表
 */
```

#### 函数：applySort
```javascript
/**
 * 应用排序
 * @param {'createdAt'|'updatedAt'|'pageNumber'} sortBy - 排序字段
 * @param {'asc'|'desc'} sortOrder - 排序顺序
 * @returns {Array<Annotation>} 排序后的标注列表
 */
```

#### 函数：copyAnnotationId
```javascript
/**
 * 复制标注ID到剪贴板
 * @param {string} annotationId - 标注ID
 * @returns {Promise<boolean>} 是否成功
 */
```

### 类实现

#### 类：AnnotationFilter
```javascript
class AnnotationFilter {
  apply(annotations, currentPageNumber): Array<Annotation>
  setDateRange(range): void
  setCustomDateRange(startDate, endDate): void
  toggleCurrentPageOnly(enabled): void
  toggleType(type, enabled): void
  reset(): void
}
```

#### 类：AnnotationSorter
```javascript
class AnnotationSorter {
  apply(annotations): Array<Annotation>
  setSortBy(sortBy): void
  setSortOrder(order): void
  toggleSortOrder(): void
}
```

### 事件规范

#### 事件：ANNOTATION.FILTER_CHANGE
- **描述**: 筛选条件改变
- **触发时机**: 用户修改筛选条件
- **数据**: `{ filters: FilterConfig }`
- **订阅者**: AnnotationManager

#### 事件：ANNOTATION.SORT_CHANGE
- **描述**: 排序方式改变
- **触发时机**: 用户修改排序设置
- **数据**: `{ sortBy, sortOrder }`
- **订阅者**: AnnotationManager

#### 事件：ANNOTATION.ID_COPIED
- **描述**: 标注ID已复制
- **触发时机**: 用户点击复制按钮
- **数据**: `{ id }`
- **订阅者**: ToastNotification

## 实现计划

### Phase 1: 按钮优化（2小时）
- [ ] 修改AnnotationToolbar按钮尺寸和样式
- [ ] 添加Tooltip提示
- [ ] 调整工具栏高度和间距
- [ ] 编写CSS样式
- [ ] 提交commit

### Phase 2: 标注卡片增强（3小时）
- [ ] 在AnnotationCard中添加ID行
- [ ] 实现ClipboardHelper工具
- [ ] 实现ID复制功能和Toast提示
- [ ] 实现卡片点击展开/收起评论
- [ ] 更新卡片事件处理（阻止冒泡）
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 3: 筛选服务和UI（6小时）
- [ ] 实现AnnotationFilter类
- [ ] 实现DateFilter工具
- [ ] 实现FilterPanel组件
- [ ] 实现日期范围选择器
- [ ] 实现当前页筛选
- [ ] 实现类型筛选
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 4: 排序服务和UI（4小时）
- [ ] 实现AnnotationSorter类
- [ ] 实现SortPanel组件
- [ ] 实现排序字段选择器
- [ ] 实现排序顺序切换
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 5: AnnotationManager集成（4小时）
- [ ] 更新AnnotationManager支持筛选和排序
- [ ] 实现事件监听和处理
- [ ] 实现页面切换监听
- [ ] 实现筛选排序组合
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 6: 状态持久化（2小时）
- [ ] 实现LocalStorage保存筛选和排序配置
- [ ] 实现启动时恢复用户偏好
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 7: UI集成和样式（3小时）
- [ ] 更新AnnotationSidebarUI集成筛选和排序面板
- [ ] 编写CSS样式（筛选面板、排序面板、卡片）
- [ ] 实现展开/收起动画
- [ ] 响应式布局调整
- [ ] 提交commit

### Phase 8: 端到端测试（4小时）
- [ ] 测试按钮优化
- [ ] 测试ID复制功能
- [ ] 测试日期筛选
- [ ] 测试页面筛选
- [ ] 测试类型筛选
- [ ] 测试排序功能
- [ ] 测试组合筛选排序
- [ ] 测试状态持久化
- [ ] 提交commit

### Phase 9: 文档和优化（2小时）
- [ ] 更新README.md
- [ ] 更新ARCHITECTURE.md
- [ ] 性能优化（debounce筛选、虚拟滚动）
- [ ] 最终测试
- [ ] 提交最终commit

**总预计时间**: 30小时

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 筛选性能问题（大量标注）| 🟡 中 | 使用Web Worker，实现虚拟滚动 |
| 日期筛选逻辑复杂 | 🟢 低 | 使用day.js或date-fns库 |
| 状态持久化冲突 | 🟢 低 | 使用版本号，迁移旧数据 |
| UI空间不足 | 🟡 中 | 筛选和排序面板可折叠 |
| 剪贴板API兼容性 | 🟢 低 | 降级到document.execCommand |
| 卡片点击事件冲突 | 🟢 低 | 使用事件冒泡控制 |

## 后续版本规划（不在第二期实现）

### 第三期功能（后端支持）
- 标注数据的持久化到数据库
- 标注增量同步
- 标注导出（JSON、Markdown、PDF）
- 标注导入
- 标注备份和恢复

### 第四期功能（高级功能）
- 标注全文搜索
- 标注标签系统
- 标注分组
- 标注统计和报告
- 协作标注（多用户）

## 参考资料

### 项目文档
- [标注栏第一期规格说明](../20251002213000-pdf-annotation-sidebar/v001-spec.md)
- [Feature开发指南](../../../src/frontend/pdf-viewer/docs/FEATURE-DEVELOPMENT-GUIDE.md)

### UI设计参考
- Adobe Acrobat Reader筛选和排序功能
- Notion数据库筛选功能
- Trello卡片筛选功能
