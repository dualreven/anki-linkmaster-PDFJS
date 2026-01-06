# PDF Viewer 书签栏 UI 功能规格说明（第一期）

**功能ID**: 20251004030515-pdf-viewer-bookmark-ui
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-04 03:05:15
**预计完成**: 2025-10-06
**状态**: 设计中

## 现状说明
- PDF Viewer 当前已有基础的书签显示功能
- 书签数据以树形结构展示，支持多级嵌套
- 缺少用户交互功能：添加、删除、修改、拖动等操作

## 存在问题
- 用户无法自定义书签，只能查看 PDF 原有书签
- 无法快速标记重要页面或区域
- 缺少书签管理功能，不便于长期使用

## 提出需求

### 核心功能需求
**第一期（仅UI实现，不涉及后端交互）**：

#### 1. 书签栏顶部操作按钮
在书签栏顶部添加四个操作按钮：
- **添加按钮**：将当前页设为书签
- **删除按钮**：删除选中的书签
- **修改按钮**：编辑选中的书签
- **拖动提示**：支持书签拖拽排序

#### 2. 添加书签功能（UI）
- 点击"添加"按钮，弹出书签编辑对话框
- 对话框包含：
  - 书签名称输入框（默认为"第X页"）
  - 书签类型选择：
    - 选项1：当前页（默认）
    - 选项2：当前精确区域（记录滚动位置和缩放级别）
  - 确定/取消按钮
- 添加后，新书签出现在书签列表中
- 数据暂存在前端内存中（LocalStorage或内存变量）

#### 3. 删除书签功能（UI）
- 选中一条书签，点击"删除"按钮
- 弹出确认对话框："确定删除书签 [书签名] 吗？"
- 如果是父书签（有子书签），提示："该书签包含 X 个子书签，确定全部删除吗？"
- 确认后，从列表中移除（级联删除）

#### 4. 修改书签功能（UI）
- 选中一条书签，点击"修改"按钮
- 弹出编辑对话框（与添加对话框类似）
- 可修改：
  - 书签名称
  - 目标页码
  - 书签类型（页/区域）
- 如果是父书签，提示："修改父书签可能影响 X 个子书签"
- 确认后更新列表显示

#### 5. 拖动排序功能（UI）
- 支持鼠标拖拽书签条目
- 拖动时显示插入位置预览线
- 支持以下拖动操作：
  - 同级拖动：改变书签顺序
  - 拖入父书签：创建子书签关系
  - 拖出父书签：解除子书签关系
- 拖动父书签时，子书签随之移动
- 拖动过程中显示视觉反馈（半透明拖动层）

### 性能要求
- 按钮操作响应时间 < 100ms
- 对话框弹出动画流畅（60fps）
- 拖动操作无卡顿
- 支持至少 500 个书签的流畅操作

## 解决方案

### 技术方案

#### 1. UI 组件设计
```
BookmarkPanel (书签面板)
├── BookmarkToolbar (工具栏)
│   ├── AddButton (添加按钮)
│   ├── DeleteButton (删除按钮)
│   ├── EditButton (编辑按钮)
│   └── HelpIcon (拖动提示图标)
├── BookmarkTree (书签树)
│   └── BookmarkItem (书签条目) - 支持拖放
└── BookmarkDialog (编辑对话框)
    ├── NameInput (名称输入)
    ├── TypeSelector (类型选择)
    └── ActionButtons (确定/取消)
```

#### 2. 数据结构
```javascript
// 书签数据结构
{
  id: string,              // 唯一标识
  name: string,            // 书签名称
  type: 'page' | 'region', // 书签类型
  pageNumber: number,      // 目标页码
  region: {                // 区域信息（type=region时有效）
    scrollX: number,
    scrollY: number,
    zoom: number
  },
  children: [],            // 子书签数组
  parentId: string | null, // 父书签ID
  order: number,           // 排序序号
  createdAt: timestamp,    // 创建时间
  updatedAt: timestamp     // 更新时间
}
```

#### 3. 前端实现技术栈
- 使用原生 JavaScript（ES6+）
- CSS3 实现动画效果
- HTML5 Drag and Drop API 实现拖拽
- LocalStorage 存储书签数据（第一期临时方案）

#### 4. 事件系统集成
复用现有的 EventBus 系统：
```javascript
// 书签相关事件
BOOKMARK_EVENTS = {
  ADD: 'pdf-viewer:bookmark:add',
  DELETE: 'pdf-viewer:bookmark:delete',
  UPDATE: 'pdf-viewer:bookmark:update',
  REORDER: 'pdf-viewer:bookmark:reorder',
  SELECT: 'pdf-viewer:bookmark:select'
}
```

## 约束条件

### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer` 中的代码，不可修改其他模块的代码

### 严格遵循代码规范和标准
必须优先阅读和理解 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.yml` 下的代码规范

### 第一期限制
- **不实现后端交互**：所有数据操作仅在前端完成
- **临时存储**：使用 LocalStorage 保存书签数据
- **不涉及同步**：不考虑多设备同步问题
- **不涉及导入导出**：暂不支持书签的导入导出功能

### UI/UX 要求
- 遵循现有 PDF Viewer 的设计风格
- 按钮图标使用统一的图标库
- 弹窗样式与现有对话框保持一致
- 响应式设计，适配不同屏幕尺寸

### 兼容性要求
- 不影响原有 PDF 书签的显示
- 用户自定义书签与 PDF 原生书签区分显示
- 支持与现有 PDF 渲染功能无缝集成

## 可行验收标准

### 单元测试
所有新增代码通过单元测试，覆盖率 ≥ 80%

### 端到端测试

#### 测试场景1：添加书签
1. 打开 PDF 文件
2. 滚动到第 10 页
3. 点击"添加书签"按钮
4. 输入书签名称"重要内容"
5. 选择"当前页"类型
6. 点击确定
7. **预期结果**：书签列表中出现"重要内容"书签，点击后跳转到第 10 页

#### 测试场景2：删除书签
1. 在书签列表中选中一个书签
2. 点击"删除"按钮
3. 确认删除
4. **预期结果**：书签从列表中移除

#### 测试场景3：修改书签
1. 选中一个书签
2. 点击"修改"按钮
3. 修改书签名称为"已修改"
4. 点击确定
5. **预期结果**：书签名称更新为"已修改"

#### 测试场景4：拖动排序
1. 拖动书签A到书签B下方
2. **预期结果**：书签A移动到书签B下方，顺序改变

#### 测试场景5：级联删除
1. 创建父书签"第一章"
2. 在其下创建子书签"1.1节"、"1.2节"
3. 删除父书签"第一章"
4. **预期结果**：父书签和所有子书签一起被删除

### 接口实现

#### 接口1: addBookmark
- **函数**: `BookmarkManager.addBookmark(bookmarkData)`
- **描述**: 添加新书签
- **参数**:
  - `bookmarkData: Object` - 书签数据对象
    - `name: string` - 书签名称
    - `type: 'page' | 'region'` - 书签类型
    - `pageNumber: number` - 页码
    - `region?: Object` - 区域信息（可选）
- **返回值**: `{ success: boolean, bookmarkId: string }`

#### 接口2: deleteBookmark
- **函数**: `BookmarkManager.deleteBookmark(bookmarkId, cascadeDelete)`
- **描述**: 删除书签
- **参数**:
  - `bookmarkId: string` - 书签ID
  - `cascadeDelete: boolean` - 是否级联删除子书签
- **返回值**: `{ success: boolean, deletedIds: string[] }`

#### 接口3: updateBookmark
- **函数**: `BookmarkManager.updateBookmark(bookmarkId, updates)`
- **描述**: 更新书签
- **参数**:
  - `bookmarkId: string` - 书签ID
  - `updates: Object` - 更新的字段
- **返回值**: `{ success: boolean, updatedBookmark: Object }`

#### 接口4: reorderBookmarks
- **函数**: `BookmarkManager.reorderBookmarks(bookmarkId, newParentId, newIndex)`
- **描述**: 重新排序书签
- **参数**:
  - `bookmarkId: string` - 被移动的书签ID
  - `newParentId: string | null` - 新的父书签ID
  - `newIndex: number` - 新的排序位置
- **返回值**: `{ success: boolean }`

### 类实现

#### 类1: BookmarkManager
- **描述**: 书签管理核心类
- **属性**:
  - `bookmarks: Map<string, Bookmark>` - 书签集合
  - `rootBookmarks: string[]` - 根级书签ID列表
- **方法**:
  - `addBookmark()` - 添加书签
  - `deleteBookmark()` - 删除书签
  - `updateBookmark()` - 更新书签
  - `reorderBookmarks()` - 重排序
  - `loadFromStorage()` - 从 LocalStorage 加载
  - `saveToStorage()` - 保存到 LocalStorage

#### 类2: BookmarkUI
- **描述**: 书签UI渲染和交互类
- **属性**:
  - `container: HTMLElement` - 书签面板容器
  - `selectedBookmarkId: string | null` - 当前选中的书签
- **方法**:
  - `render()` - 渲染书签列表
  - `showAddDialog()` - 显示添加对话框
  - `showEditDialog()` - 显示编辑对话框
  - `showDeleteConfirm()` - 显示删除确认
  - `setupDragAndDrop()` - 设置拖放功能

### 事件规范

#### 事件1: bookmark:add
- **描述**: 用户添加新书签时触发
- **参数**:
  - `detail: { bookmark: Object }` - 新添加的书签对象
- **返回值**: 无

#### 事件2: bookmark:delete
- **描述**: 用户删除书签时触发
- **参数**:
  - `detail: { bookmarkIds: string[] }` - 被删除的书签ID列表
- **返回值**: 无

#### 事件3: bookmark:update
- **描述**: 用户修改书签时触发
- **参数**:
  - `detail: { bookmarkId: string, updates: Object }` - 更新信息
- **返回值**: 无

#### 事件4: bookmark:reorder
- **描述**: 用户拖动排序书签时触发
- **参数**:
  - `detail: { bookmarkId: string, newParentId: string, newIndex: number }` - 排序信息
- **返回值**: 无

## 第二期预告

第二期将实现后端功能：
- 设计后端书签存储服务
- 实现前后端书签数据同步
- 优先从后端加载书签，不存在时从前端加载
- 书签编辑实时同步到后端
- 支持多设备书签同步

## 附录

### 参考设计
可参考 Adobe Acrobat、福昕阅读器等成熟 PDF 阅读器的书签功能

### 开发建议
1. 先实现数据层（BookmarkManager）
2. 再实现UI层（BookmarkUI）
3. 最后实现拖放功能（最复杂）
4. 每完成一个功能点，立即编写测试
