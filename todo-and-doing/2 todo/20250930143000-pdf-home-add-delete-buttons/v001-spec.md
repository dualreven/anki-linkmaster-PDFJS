# PDF-Home添加和删除按钮功能实现规格说明

**功能ID**: 20250930143000-pdf-home-add-delete-buttons
**优先级**: 高
**版本**: v001
**创建时间**: 2025-09-30 14:30:00
**预计完成**: 2025-10-02
**状态**: 设计中

## 现状说明
- 当前PDF-Home模块已实现基于Tabulator的表格展示
- 已有完整的事件总线架构和WebSocket通信机制
- 已集成QWebChannel桥接，支持JavaScript与Python通信
- 文件选择、添加、删除的后端逻辑已存在
- 当前UI包含按钮区域但功能实现不完整

## 存在问题
- **添加按钮功能不完善**: 点击添加按钮后的文件选择和上传流程不够流畅
- **删除按钮缺少确认**: 删除操作缺少用户确认对话框，存在误操作风险
- **按钮功能重复**: 单文件和批量操作分开导致UI复杂，用户困惑
- **用户反馈缺失**: 操作过程中缺少加载状态和成功/失败提示
- **错误处理不完整**: 操作失败时的错误信息不够友好

## 提出需求
### 核心功能
1. **添加PDF文件**（合并单文件和批量）:
   - 点击"添加PDF"按钮触发原生文件选择对话框
   - 自动支持单选和多选（通过对话框配置）
   - 支持.pdf格式文件过滤
   - 显示文件上传进度（单个/批量）
   - 上传完成后自动刷新列表

2. **删除PDF文件**（合并单文件和批量）:
   - 表格支持单选和多选
   - 点击"删除选中"按钮删除所有选中的文件
   - 删除前弹出确认对话框，显示将删除的文件数量
   - 显示删除进度和结果

### 交互体验
- 所有操作都有明确的视觉反馈（加载动画、进度条）
- 操作成功/失败都有友好的提示消息
- 删除按钮根据选中状态自动启用/禁用

## 解决方案

### 技术方案
1. **UI层改进**:
   - 简化按钮布局：仅保留"添加PDF"和"删除选中"两个按钮
   - 使用UIManager统一管理按钮状态和反馈
   - 集成确认对话框组件
   - 添加加载状态指示器

2. **事件流设计**:
   - 用户点击按钮 → 触发事件总线事件
   - PDFManager监听事件 → 通过QWebChannel或WebSocket与后端通信
   - 后端处理完成 → 广播更新事件
   - UIManager接收事件 → 更新界面显示

3. **事件命名规范**:
   - 添加请求: `pdf:add-files:request`
   - 添加响应: `pdf:add-files:response`
   - 删除请求: `pdf:remove-files:request`
   - 删除响应: `pdf:remove-files:response`
   - 列表更新: `pdf:list:updated`
   - 操作进度: `pdf:operation:progress`

### 实现细节
```javascript
// 添加按钮点击事件（自动支持单选和多选）
addPdfButton.addEventListener('click', async () => {
  try {
    // 1. 通过QWebChannel调用原生文件选择对话框（支持多选）
    const files = await window.pdfHomeBridge.selectFiles({ multiple: true });

    if (!files || files.length === 0) {
      return; // 用户取消选择
    }

    // 2. 显示上传进度
    showProgress({
      message: `正在添加 ${files.length} 个文件...`,
      total: files.length
    });

    // 3. 发送添加请求到后端
    eventBus.emit('pdf:add-files:request', {
      files: files,
      source: 'add-button'
    });

  } catch (error) {
    showErrorMessage('文件添加失败: ' + error.message);
  }
});

// 删除按钮点击事件（支持单个或多个选中项）
deleteButton.addEventListener('click', async () => {
  // 1. 获取选中的文件
  const selectedRows = tableWrapper.getSelectedRows();

  if (selectedRows.length === 0) {
    showWarningMessage('请先选择要删除的文件');
    return;
  }

  // 2. 显示确认对话框
  const fileCount = selectedRows.length;
  const fileNames = selectedRows.map(row => row.filename).join(', ');
  const message = fileCount === 1
    ? `确定要删除 "${fileNames}" 吗？`
    : `确定要删除选中的 ${fileCount} 个文件吗？`;

  const confirmed = await showConfirmDialog('确认删除', message);

  if (!confirmed) {
    return;
  }

  // 3. 发送删除请求
  const fileIds = selectedRows.map(row => row.id);
  eventBus.emit('pdf:remove-files:request', {
    file_ids: fileIds,
    source: 'delete-button'
  });

  // 4. 显示加载状态
  showProgress({
    message: `正在删除 ${fileCount} 个文件...`,
    total: fileCount
  });
});
```

## 约束条件

### 仅修改本模块代码
仅修改 pdf-home 模块中的代码，不可修改其他模块的代码。如有必要修改共享组件，需在工作日志中记录。

### 严格遵循代码规范和标准
必须优先阅读和理解 `pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json` 引用的所有规范，特别是：
- `PDFHOME-ARCH-DESIGN-001.md` - 架构设计规范
- `FRONTEND-EVENT-BUS-001.md` - 事件总线使用规范
- `PDFHOME-DESKTOP-DIALOG-CLIENT-001.md` - 桌面对话框客户端规范

### 渐进式开发，保护现有功能
**⚠️ 关键原则：新代码开发期间不能破坏现有功能！**

#### 开发策略
1. **新旧代码隔离**:
   - 新增功能使用独立的事件名称（`pdf:add-files:*`, `pdf:remove-files:*`），不影响旧事件
   - 新增组件使用独立的类和文件，避免修改现有类
   - 新增UI元素使用独立的ID和类名，避免CSS冲突

2. **渐进式替换**:
   - 第一阶段：新功能作为额外选项与旧功能并存
   - 第二阶段：充分测试新功能后，逐步迁移用户
   - 第三阶段：确认无问题后，最后移除旧代码

3. **功能开关控制**:
   ```javascript
   // 使用特性开关控制新旧功能
   const FEATURE_FLAGS = {
     USE_NEW_ADD_DELETE_UI: false  // 默认false，开发完成后再启用
   };

   // 根据开关决定使用新旧实现
   if (FEATURE_FLAGS.USE_NEW_ADD_DELETE_UI) {
     // 使用新的添加删除实现
     initNewFileOperations();
   } else {
     // 保持旧的实现
     initLegacyFileOperations();
   }
   ```

4. **事件兼容性**:
   - 新事件触发时，同时触发对应的旧事件（兼容模式）
   - 逐步迁移事件监听器到新事件名称
   - 保留旧事件的监听器，直到确认所有代码已迁移

5. **错误隔离**:
   ```javascript
   // 新功能的错误不应影响旧功能
   try {
     // 新功能代码
     handleNewAddFiles();
   } catch (error) {
     console.error('新功能出错，回退到旧功能:', error);
     handleLegacyAddFiles(); // 降级到旧实现
   }
   ```

6. **代码审查检查点**:
   - 提交前必须检查：旧功能的双击打开PDF是否正常
   - 提交前必须检查：表格显示是否正常
   - 提交前必须检查：WebSocket连接是否正常
   - 提交前必须检查：现有的事件流是否被破坏

#### 具体实施
```javascript
// 示例：新旧代码隔离的实现方式

// === 文件：file-operation-handler-new.js (新增) ===
export class FileOperationHandlerNew {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.bridge = dependencies.bridge;
    // 新功能独立实现
  }

  handleAddFiles() {
    // 新的添加逻辑
    this.eventBus.emit('pdf:add-files:request', data);

    // 兼容性：同时触发旧事件
    this.eventBus.emit('pdf:add:requested', data); // 旧事件名
  }
}

// === 文件：index.js (主文件修改) ===
import { FileOperationHandlerNew } from './file-operation-handler-new.js';

// 初始化时判断使用新旧实现
const initFileOperations = (app) => {
  if (window.FEATURE_FLAGS?.USE_NEW_ADD_DELETE_UI) {
    // 使用新实现
    app.fileOperationHandler = new FileOperationHandlerNew({
      eventBus: app.eventBus,
      bridge: app.bridge
    });
  } else {
    // 保持旧实现不变
    setupLegacyButtonHandlers(app);
  }
};
```

### 向后兼容性
- 保持现有事件总线接口不变
- 保持现有WebSocket消息协议兼容
- 不破坏现有的双击打开功能
- 不破坏现有的表格显示功能
- 不破坏现有的WebSocket连接

### 测试要求
**每次代码提交前必须验证以下现有功能：**
1. ✅ 双击表格行能正常打开PDF
2. ✅ 表格数据正常显示
3. ✅ WebSocket连接正常
4. ✅ 现有的添加/删除功能仍可用（如果存在）
5. ✅ 调试面板正常显示

## 可行验收标准

### 单元测试
- 按钮点击事件处理器测试
- 文件选择逻辑测试（单选和多选）
- 确认对话框功能测试
- 事件发布和监听测试
- 错误处理逻辑测试
- **向后兼容性测试**（新事件触发时旧事件也触发）

### 端到端测试
1. **新功能测试**:
   - 点击"添加PDF"按钮能正常弹出文件选择对话框
   - 选择单个PDF文件能成功上传并显示在列表中
   - 选择多个PDF文件能批量上传
   - 上传过程中显示进度指示器
   - 上传完成后显示成功提示
   - 选中单个/多个文件点击"删除选中"能正确处理
   - 删除失败时显示友好错误提示

2. **现有功能回归测试**（⚠️ 必须全部通过）:
   - 双击表格行仍能正常打开PDF查看器
   - 表格数据加载和显示正常
   - 表格排序、筛选功能正常
   - WebSocket连接状态正常
   - 调试面板信息显示正常
   - 页面刷新后功能正常

3. **异常情况测试**:
   - 选择非PDF文件时的错误提示
   - 网络断开时的错误处理
   - 文件已存在时的重复处理
   - 删除不存在的文件时的错误处理
   - 新功能出错时不影响旧功能

### 接口实现

#### 接口1: 文件添加处理
**函数**: `handleAddPdfClick()`
**描述**: 处理添加PDF按钮点击事件，触发文件选择和上传流程（自动支持单选和多选）
**参数**: 无
**返回值**: `Promise<void>`

#### 接口2: 文件删除处理
**函数**: `handleDeleteClick()`
**描述**: 处理删除按钮点击事件，删除所有选中的文件（支持单个或多个）
**参数**: 无
**返回值**: `Promise<void>`

#### 接口3: 确认对话框
**函数**: `showConfirmDialog(title, message, options)`
**描述**: 显示确认对话框
**参数**:
- `title`: string - 对话框标题
- `message`: string - 提示消息
- `options`: object - 可选配置（按钮文本、图标等）
**返回值**: `Promise<boolean>` - 用户是否确认

#### 接口4: 进度显示
**函数**: `showProgress(options)`
**描述**: 显示操作进度
**参数**:
- `options.message`: string - 进度消息
- `options.current`: number - 当前进度（可选）
- `options.total`: number - 总数（可选）
**返回值**: `void`

#### 接口5: 隐藏进度
**函数**: `hideProgress()`
**描述**: 隐藏进度指示器
**参数**: 无
**返回值**: `void`

### 类实现

#### 类1: FileOperationHandler
**类**: `FileOperationHandler`
**描述**: 处理文件添加和删除操作的统一处理器
**属性**:
- `eventBus`: EventBus - 事件总线实例
- `uiManager`: UIManager - UI管理器实例
- `bridge`: QWebChannelBridge - QWebChannel桥接实例
- `tableWrapper`: TableWrapper - 表格包装器实例
**方法**:
- `handleAddPdfClick()`: 处理添加PDF按钮
- `handleDeleteClick()`: 处理删除按钮
- `updateDeleteButtonState()`: 根据选中状态更新删除按钮状态

#### 类2: ConfirmDialog
**类**: `ConfirmDialog`
**描述**: 确认对话框组件
**属性**:
- `title`: string - 对话框标题
- `message`: string - 提示消息
- `options`: object - 配置选项
**方法**:
- `show()`: Promise<boolean> - 显示对话框并返回用户选择
- `hide()`: 隐藏对话框
- `destroy()`: 销毁对话框

#### 类3: ProgressIndicator
**类**: `ProgressIndicator`
**描述**: 进度指示器组件
**属性**:
- `current`: number - 当前进度
- `total`: number - 总数
- `message`: string - 进度消息
- `visible`: boolean - 是否可见
**方法**:
- `show(options)`: 显示进度指示器
- `update(current, message)`: 更新进度
- `hide()`: 隐藏进度指示器

### 事件规范

#### 事件1: PDF文件添加请求
**事件类型**: `pdf:add-files:request`
**描述**: 用户请求添加PDF文件时触发（支持单个或多个）
**参数**:
- `files`: string[] - 文件路径数组
- `source`: string - 请求来源标识
**返回值**: 无
**向后兼容**: 同时触发旧事件 `pdf:add:requested`（渐进式迁移期间）

#### 事件2: PDF文件添加响应
**事件类型**: `pdf:add-files:response`
**描述**: PDF文件添加完成后触发
**参数**:
- `success`: boolean - 是否全部成功
- `added_count`: number - 成功添加的文件数
- `failed_count`: number - 失败的文件数
- `file_ids`: string[] - 添加的文件ID列表
- `errors`: object[] - 错误信息列表（如有）
- `message`: string - 结果消息
**返回值**: 无
**向后兼容**: 同时触发旧事件 `pdf:add:completed`（渐进式迁移期间）

#### 事件3: PDF文件删除请求
**事件类型**: `pdf:remove-files:request`
**描述**: 用户请求删除PDF文件时触发（支持单个或多个）
**参数**:
- `file_ids`: string[] - 文件ID数组
- `source`: string - 请求来源标识
**返回值**: 无
**向后兼容**: 同时触发旧事件 `pdf:remove:requested`（渐进式迁移期间）

#### 事件4: PDF文件删除响应
**事件类型**: `pdf:remove-files:response`
**描述**: PDF文件删除完成后触发
**参数**:
- `success`: boolean - 是否全部成功
- `removed_count`: number - 成功删除的文件数
- `failed_count`: number - 失败的文件数
- `file_ids`: string[] - 删除的文件ID列表
- `errors`: object[] - 错误信息列表（如有）
- `message`: string - 结果消息
**返回值**: 无
**向后兼容**: 同时触发旧事件 `pdf:remove:completed`（渐进式迁移期间）

#### 事件5: 操作进度更新
**事件类型**: `pdf:operation:progress`
**描述**: 文件操作进度更新时触发
**参数**:
- `operation`: string - 操作类型（add-files/remove-files）
- `current`: number - 当前进度
- `total`: number - 总数
- `message`: string - 进度消息
**返回值**: 无

#### 事件6: PDF列表更新
**事件类型**: `pdf:list:updated`
**描述**: PDF文件列表发生变化时触发（由后端广播）
**参数**:
- `items`: object[] - 更新后的PDF列表
- `total`: number - 文件总数
**返回值**: 无

## UI改进

### 按钮布局简化
```html
<!-- 简化后的按钮区域 -->
<div class="button-container">
  <button id="add-pdf-btn" class="btn btn-primary">
    <i class="icon-add"></i> 添加PDF
  </button>
  <button id="delete-selected-btn" class="btn btn-danger" disabled>
    <i class="icon-delete"></i> 删除选中
  </button>
</div>
```

### 删除按钮状态管理
- 未选中任何文件时：按钮禁用（灰色）
- 选中1个文件时：按钮启用，文本"删除选中 (1)"
- 选中多个文件时：按钮启用，文本"删除选中 (N)"

## 性能要求
- 按钮点击响应时间 < 100ms
- 单文件上传时间 < 5s（取决于文件大小）
- 批量操作每个文件处理时间 < 2s
- UI更新流畅，无卡顿

## 用户体验要求
- 所有操作都有明确的视觉反馈
- 错误提示信息友好且具体
- 删除按钮根据选中状态动态更新
- 支持键盘快捷键（可选：Delete键删除选中）

## 安全性要求
- 删除操作必须有确认步骤
- 文件类型验证（仅允许.pdf）
- 文件大小限制（可配置）
- 防止重复提交