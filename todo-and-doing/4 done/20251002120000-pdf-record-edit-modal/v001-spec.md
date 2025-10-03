# PDF记录编辑模态框规格说明

**功能ID**: 20251002120000-pdf-record-edit-modal
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-02 12:00:00
**预计完成**: 2025-10-03
**状态**: 设计中

## 现状说明

当前 PDF 管理系统具备以下功能：
- PDF 记录包含 13 个字段（6 个基础字段 + 7 个扩展字段）
- 使用 Tabulator 表格展示 PDF 列表
- 前后端通过 WebSocket 通信
- 基于 EventBus 事件驱动架构
- 技术栈：原生 JavaScript + Vite 5.0.0

已有的扩展字段：
- `last_accessed_at`: 上次访问时间
- `review_count`: 复习次数
- `rating`: 评分（0-5星）
- `tags`: 标签列表
- `is_visible`: 可见性
- `total_reading_time`: 累计学习时长
- `due_date`: 截止日期

## 存在问题

1. **无法编辑扩展字段**：用户无法修改评分、标签、截止日期等信息
2. **缺少编辑入口**：表格中没有编辑按钮，无法触发编辑操作
3. **需要良好用户体验**：编辑操作应该便捷、直观，提供即时反馈

## 提出需求

实现 PDF 记录编辑功能，包含以下核心要素：

### 1. 表格编辑按钮
- 在 Tabulator 表格中添加"编辑"列
- 每行显示一个编辑按钮（图标或文字）
- 点击按钮触发编辑事件

### 2. 编辑模态框（Modal Dialog）
- 使用**纯 JavaScript 实现**（不引入 PyQt）
- 模态框内容：
  - 显示当前 PDF 的基本信息（只读）：文件名、页数、大小
  - 可编辑字段表单：
    - 评分（Rating）：星级选择器（0-5星）
    - 标签（Tags）：多标签输入组件
    - 截止日期（Due Date）：日期选择器
    - 可见性（Visibility）：开关按钮
  - 操作按钮：确定、取消

### 3. 数据流转
- 点击编辑按钮 → EventBus 触发 `pdf:edit:requested` 事件
- ModalManager 显示模态框，填充当前记录数据
- 用户修改表单 → 点击确定 → EventBus 触发 `pdf:update:requested` 事件
- PDFManager 通过 WebSocket 发送更新请求到后端
- 后端处理完成 → 广播 `pdf:list:updated` 事件
- 前端接收 → 刷新表格显示

## 解决方案

### 技术方案：纯 JavaScript 实现

**选择理由**：
1. 符合项目技术栈（原生 JavaScript + Vite）
2. 无需引入新依赖和通信协议
3. 响应快，用户体验好
4. 可直接复用 EventBus、WebSocket 等现有模块
5. 维护成本低，代码集中在前端

**架构设计**：
```
用户点击编辑按钮
  ↓
EventBus.emit('pdf:edit:requested', {record})
  ↓
ModalManager.show(config)
  ↓
渲染表单 (Form Components)
  ↓
用户填写并提交
  ↓
EventBus.emit('pdf:update:requested', {id, updates})
  ↓
PDFManager → WebSocket → 后端处理
  ↓
后端广播 pdf:list:updated
  ↓
Tabulator 表格刷新
```

### 分阶段实现

**Phase 1: 表格编辑按钮**（30分钟）
- 在 Tabulator 表格配置中添加"编辑"列
- 使用 `formatter` 渲染编辑按钮图标
- 绑定点击事件，触发 `pdf:edit:requested` 事件

**Phase 2: 模态框管理器**（60分钟）
- 创建 `ModalManager` 类，管理模态框生命周期
- 实现模态框 HTML 结构生成
- 实现显示/隐藏动画
- 支持遮罩层点击关闭、ESC 键关闭

**Phase 3: 表单组件**（90分钟）
- 星级选择器组件（StarRatingInput）
- 多标签输入组件（TagsInput）
- 日期选择器（DatePicker，可使用原生 `<input type="date">`）
- 开关按钮（ToggleSwitch）

**Phase 4: 数据交互**（40分钟）
- 监听 `pdf:edit:requested` 事件，显示模态框并填充数据
- 表单提交时触发 `pdf:update:requested` 事件
- PDFManager 监听更新事件，发送 WebSocket 消息
- 后端处理完成后刷新表格

**Phase 5: 样式和优化**（30分钟）
- 编写 CSS 样式（模态框、表单组件）
- 添加过渡动画
- 响应式设计（适配不同屏幕）

**预计总时间**：4小时10分钟

## 约束条件

### ⚠️ 并行开发原则（最重要）

**功能域隔离架构**：

本功能必须作为**独立的功能域**（pdf-edit）实现，严禁侵入其他功能域：

```
src/frontend/pdf-home/features/
├── pdf-list/              【禁止修改】其他团队维护
│   ├── components/
│   │   └── pdf-table.js   【仅允许】添加编辑按钮触发全局事件
│   └── events.js          【禁止】添加编辑相关事件
│
└── pdf-edit/              【本次开发】独立功能域
    ├── feature.config.js  【必须】声明依赖和提供的事件
    ├── events.js          【必须】定义内部事件
    ├── components/
    │   ├── modal-manager.js
    │   ├── star-rating.js
    │   ├── tags-input.js
    │   └── toggle-switch.js
    ├── services/
    └── state/
```

**跨域通信机制**：

```javascript
// ✅ 正确：pdf-table.js 使用全局事件触发编辑
eventBus.emitGlobal(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, rowData);

// ❌ 错误：直接调用 pdf-edit 功能域的方法
import { openEditModal } from '../pdf-edit/modal-manager.js'; // 严禁

// ✅ 正确：pdf-edit 监听全局事件
eventBus.onGlobal(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, (data) => {
  this.openEditModal(data);
});
```

**关键原则**：

1. **功能域独立性**：pdf-edit 所有代码必须在 `features/pdf-edit/` 目录下
2. **最小化修改**：仅在 pdf-table.js 中添加编辑按钮列和触发全局事件
3. **禁止侵入**：不得在 pdf-list/events.js 中添加编辑事件
4. **全局事件通信**：使用 `PDF_MANAGEMENT_EVENTS.EDIT.*` 进行跨域通信
5. **声明依赖**：在 feature.config.js 中明确声明监听和提供的事件

### 允许修改和新建的文件

**最小化修改现有文件**：
- ✅ `features/pdf-list/components/pdf-table.js` - 仅添加编辑按钮列和全局事件触发
- ✅ `common/event/event-constants.js` - 添加 `PDF_MANAGEMENT_EVENTS.EDIT`
- ✅ `managers/pdf-manager.js` - 监听编辑完成事件（如需）
- ✅ `src/backend/websocket/handlers.py` - 添加更新处理器（如需）
- ✅ `src/backend/services/pdf_service.py` - 添加批量更新方法（如需）

**新建独立功能域**：
- ✅ `features/pdf-edit/feature.config.js` - 功能域配置
- ✅ `features/pdf-edit/events.js` - 内部事件定义
- ✅ `features/pdf-edit/components/modal-manager.js` - 模态框管理器
- ✅ `features/pdf-edit/components/star-rating.js` - 星级选择器
- ✅ `features/pdf-edit/components/tags-input.js` - 多标签输入
- ✅ `features/pdf-edit/components/toggle-switch.js` - 开关按钮
- ✅ `features/pdf-edit/styles/modal.css` - 模态框样式
- ✅ `features/pdf-edit/styles/form-components.css` - 表单组件样式

**严禁修改**：
- ❌ `features/pdf-list/events.js` - 不得添加编辑事件
- ❌ 其他功能域的代码（除了必要的事件触发点）
- ❌ 现有的 WebSocket 消息协议核心结构（仅扩展）

### 严格遵循代码规范和标准

- 必须先阅读 `src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-pdf-home.yml`
- 使用 ES6+ 语法（const/let、箭头函数、解构）
- 类的私有方法使用 `#` 前缀
- 所有函数必须有 JSDoc 注释
- 异步操作使用 async/await
- 事件命名遵循现有规范（全局：`pdf:edit:requested`，域内：`edit:requested`）
- 字段命名统一使用 snake_case（前后端一致）

### 技术限制

- **严禁引入 PyQt 或其他 Python UI 框架**
- **严禁引入重量级 UI 库**（如 React、Vue）
- **优先使用原生 HTML5 组件**（如 `<input type="date">`）
- **可选择轻量级无依赖组件**（如需自定义日期选择器）

## 可行验收标准

### 逐段验证

#### 验证1: 表格编辑按钮显示

**测试方法**：
1. 启动开发服务器：`python ai-launcher.py start`
2. 打开 http://localhost:3000
3. 检查 Tabulator 表格

**验收标准**：
- 表格最右侧显示"编辑"列
- 每行显示编辑按钮（图标或文字）
- 鼠标悬停时有视觉反馈（如颜色变化）

#### 验证2: 模态框打开和关闭

**测试方法**：
1. 点击任意 PDF 记录的编辑按钮
2. 检查模态框是否显示
3. 测试关闭方式：点击取消、点击遮罩层、按 ESC 键

**验收标准**：
- 模态框居中显示，带有遮罩层
- 显示/隐藏有平滑过渡动画
- 三种关闭方式都能正常工作
- 关闭后表格数据未改变

#### 验证3: 表单数据填充

**测试方法**：
1. 选择一个已有评分、标签的 PDF 记录
2. 点击编辑按钮
3. 检查模态框中的表单数据

**验收标准**：
- 基本信息（只读）正确显示：文件名、页数、大小
- 评分显示为对应的星级（如 3 星）
- 标签列表正确显示（如 ["学习", "重要"]）
- 截止日期正确显示（如有）
- 可见性开关状态正确

#### 验证4: 表单提交和更新

**测试方法**：
1. 打开编辑模态框
2. 修改评分（如从 3 星改为 5 星）
3. 添加新标签
4. 点击确定按钮
5. 检查表格是否更新

**验收标准**：
- 模态框关闭
- 表格中对应记录的评分显示为 5 星
- 标签列表显示新增的标签
- 控制台无错误信息

#### 验证5: WebSocket 消息格式

**测试方法**：
在浏览器 Console 中监听 WebSocket 消息

**验收标准**：
- 提交表单时发送 `pdf:update:requested` 消息
- 消息格式正确：
  ```javascript
  {
    type: 'pdf:update',
    data: {
      pdf_id: string,
      updates: {
        rating: number,
        tags: string[],
        due_date: number,
        is_visible: boolean
      }
    }
  }
  ```
- 后端返回 `pdf:list:updated` 消息

### 端到端测试

#### 测试1: 编辑评分

**步骤**：
1. 启动开发服务器
2. 选择评分为 0 的 PDF
3. 点击编辑，设置为 5 星
4. 保存

**验收标准**：
- 表格中评分显示为 ★★★★★
- 刷新页面后评分仍为 5 星
- JSON 文件中 `rating` 字段为 5

#### 测试2: 编辑标签

**步骤**：
1. 选择无标签的 PDF
2. 点击编辑，添加标签 "学习"、"重要"
3. 保存

**验收标准**：
- 表格中标签列显示两个标签徽章
- 刷新页面后标签仍存在
- JSON 文件中 `tags` 字段为 `["学习", "重要"]`

#### 测试3: 设置截止日期

**步骤**：
1. 选择无截止日期的 PDF
2. 点击编辑，设置截止日期为明天
3. 保存

**验收标准**：
- 表格中截止日期列显示相对时间（如 "1天后"）
- JSON 文件中 `due_date` 字段为正确的 Unix 秒时间戳

#### 测试4: 切换可见性

**步骤**：
1. 选择可见的 PDF
2. 点击编辑，关闭可见性开关
3. 保存

**验收标准**：
- JSON 文件中 `is_visible` 字段为 `false`
- 表格行可能显示不同样式（如灰色，取决于筛选系统实现）

## 接口实现

### 接口1: ModalManager.show

**函数**: `ModalManager.show(config: ModalConfig) -> void`

**描述**: 显示模态框

**参数**:
- `config` (ModalConfig): 模态框配置对象
  - `title` (string): 模态框标题
  - `content` (HTMLElement | string): 模态框内容
  - `onConfirm` (Function): 确定按钮回调
  - `onCancel` (Function): 取消按钮回调

**返回值**: 无

**副作用**:
- 在 DOM 中插入模态框元素
- 添加遮罩层
- 阻止页面滚动

---

### 接口2: ModalManager.hide

**函数**: `ModalManager.hide() -> void`

**描述**: 隐藏并销毁当前模态框

**参数**: 无

**返回值**: 无

**副作用**:
- 从 DOM 中移除模态框元素
- 移除遮罩层
- 恢复页面滚动

---

### 接口3: PDFService.update_record

**函数**: `PDFService.update_record(pdf_id: str, updates: dict) -> None`

**描述**: 批量更新 PDF 记录的多个字段

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `updates` (dict): 要更新的字段字典，支持的键：
  - `rating` (int): 评分（0-5）
  - `tags` (List[str]): 标签列表
  - `due_date` (int): 截止日期（Unix 秒）
  - `is_visible` (bool): 可见性

**返回值**: 无

**异常**:
- `ValueError`: 如果字段值不合法（如 rating 不在 0-5 范围）

**副作用**:
- 更新 JSON 文件
- 广播 `pdf:list:updated` 事件

## 类实现

### 类1: ModalManager

**类**: `ModalManager`

**描述**: 模态框管理器，管理模态框的创建、显示、隐藏

**文件**: `src/frontend/pdf-home/ui/modal-manager.js`

**属性**:
```javascript
#currentModal: HTMLElement | null   // 当前显示的模态框元素
#overlay: HTMLElement | null        // 遮罩层元素
#isOpen: boolean                    // 是否打开状态
```

**方法**:
- `show(config: ModalConfig) -> void` - 显示模态框
- `hide() -> void` - 隐藏模态框
- `#createOverlay() -> HTMLElement` - 创建遮罩层（私有）
- `#createModal(config) -> HTMLElement` - 创建模态框元素（私有）
- `#bindEvents() -> void` - 绑定事件监听器（私有）
- `#handleEscKey(event) -> void` - 处理 ESC 键（私有）

---

### 类2: StarRatingInput

**类**: `StarRatingInput`

**描述**: 星级选择器组件（0-5星）

**文件**: `src/frontend/pdf-home/ui/components/star-rating-input.js`

**属性**:
```javascript
#value: number          // 当前评分（0-5）
#container: HTMLElement // 容器元素
#stars: HTMLElement[]   // 星星元素数组
```

**方法**:
- `constructor(initialValue: number)` - 初始化组件
- `getValue() -> number` - 获取当前评分
- `setValue(value: number) -> void` - 设置评分
- `render() -> HTMLElement` - 渲染组件
- `#handleClick(index: number) -> void` - 处理星星点击（私有）
- `#updateDisplay() -> void` - 更新星星显示状态（私有）

---

### 类3: TagsInput

**类**: `TagsInput`

**描述**: 多标签输入组件

**文件**: `src/frontend/pdf-home/ui/components/tags-input.js`

**属性**:
```javascript
#tags: string[]         // 当前标签列表
#container: HTMLElement // 容器元素
#input: HTMLInputElement// 输入框元素
```

**方法**:
- `constructor(initialTags: string[])` - 初始化组件
- `getTags() -> string[]` - 获取当前标签列表
- `setTags(tags: string[]) -> void` - 设置标签列表
- `render() -> HTMLElement` - 渲染组件
- `#addTag(tag: string) -> void` - 添加标签（私有）
- `#removeTag(tag: string) -> void` - 移除标签（私有）
- `#renderTag(tag: string) -> HTMLElement` - 渲染单个标签（私有）

---

### 类4: EditFormBuilder

**类**: `EditFormBuilder`

**描述**: 编辑表单构建器，生成完整的编辑表单

**文件**: `src/frontend/pdf-home/ui/edit-form-builder.js`

**属性**:
```javascript
#record: Object         // PDF 记录对象
#components: Object     // 表单组件集合
```

**方法**:
- `constructor(record: Object)` - 初始化表单构建器
- `build() -> HTMLElement` - 构建完整表单
- `getFormData() -> Object` - 获取表单数据
- `#buildReadOnlySection() -> HTMLElement` - 构建只读信息区（私有）
- `#buildEditableSection() -> HTMLElement` - 构建可编辑区（私有）

## 事件规范

### 事件1: pdf:edit:requested

**描述**: 用户请求编辑 PDF 记录

**方向**: 表格 → ModalManager

**触发时机**: 用户点击表格中的编辑按钮

**事件格式**:
```javascript
{
  type: 'pdf:edit:requested',
  data: {
    record: {
      id: string,
      filename: string,
      page_count: number,
      file_size: number,
      rating: number,
      tags: string[],
      due_date: number,
      is_visible: boolean,
      // ... 其他字段
    }
  }
}
```

---

### 事件2: pdf:update:requested

**描述**: 用户提交编辑表单，请求更新记录

**方向**: 表单 → PDFManager

**触发时机**: 用户点击模态框中的"确定"按钮

**事件格式**:
```javascript
{
  type: 'pdf:update:requested',
  data: {
    pdf_id: string,
    updates: {
      rating: number,       // 可选
      tags: string[],       // 可选
      due_date: number,     // 可选
      is_visible: boolean   // 可选
    }
  }
}
```

---

### 事件3: pdf:update (WebSocket)

**描述**: 前端发送更新请求到后端

**方向**: 前端 → 后端（WebSocket）

**触发时机**: PDFManager 监听到 `pdf:update:requested` 事件

**消息格式**:
```javascript
{
  type: 'pdf:update',
  data: {
    pdf_id: string,
    updates: {
      rating: number,
      tags: string[],
      due_date: number,
      is_visible: boolean
    }
  }
}
```

**响应**: 后端会广播 `pdf:list:updated` 消息

## 单元测试

### 测试1: test_modal_show_hide

**描述**: 测试模态框的显示和隐藏

**文件**: `src/frontend/pdf-home/ui/__tests__/modal-manager.test.js`

**断言**:
- 调用 `show()` 后，模态框元素存在于 DOM 中
- 调用 `hide()` 后，模态框元素从 DOM 中移除
- 遮罩层正确创建和移除

---

### 测试2: test_star_rating_component

**描述**: 测试星级选择器组件

**文件**: `src/frontend/pdf-home/ui/components/__tests__/star-rating-input.test.js`

**断言**:
- 初始值正确显示（如 3 星）
- 点击星星后值正确更新
- `getValue()` 返回正确的评分

---

### 测试3: test_tags_input_component

**描述**: 测试多标签输入组件

**文件**: `src/frontend/pdf-home/ui/components/__tests__/tags-input.test.js`

**断言**:
- 初始标签正确显示
- 添加标签后标签列表更新
- 删除标签后标签列表更新
- `getTags()` 返回正确的标签数组

---

### 测试4: test_pdf_update_websocket

**描述**: 测试 PDF 更新的 WebSocket 消息

**文件**: `src/backend/tests/test_websocket_update.py`

**断言**:
- 后端接收到 `pdf:update` 消息
- 后端正确解析 `updates` 字段
- 后端更新 JSON 文件
- 后端广播 `pdf:list:updated` 消息

## 风险和注意事项

1. **模态框层级管理**：确保模态框的 z-index 高于其他元素，避免被遮挡
2. **表单验证**：评分必须在 0-5 范围内，标签不能为空字符串
3. **并发编辑**：当前不考虑多用户并发编辑，后端采用"后写入覆盖"策略
4. **ESC 键冲突**：如果页面有其他组件监听 ESC 键，需要处理事件冒泡
5. **内存泄漏**：模态框关闭后必须解绑事件监听器，避免内存泄漏
6. **日期时区**：日期选择器使用本地时区，后端存储 Unix 时间戳需正确转换
7. **原子性更新**：后端 `update_record` 方法应实现原子性更新（全部成功或全部失败）
8. **WebSocket 断线**：前端应处理 WebSocket 断线时的表单提交失败场景

## 后续优化方向

1. **表单验证增强**：添加实时验证和错误提示
2. **撤销功能**：支持撤销最近一次编辑
3. **批量编辑**：支持选中多行进行批量编辑
4. **快捷键**：支持快捷键快速打开编辑（如双击行）
5. **自定义字段**：支持用户自定义字段（需要后端扩展）

---

**文档完成时间**: 2025-10-02 12:30:00
**文档状态**: ✅ 完整自洽，可直接用于开发
