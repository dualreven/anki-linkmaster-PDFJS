# PDF-Home模块规范文档

## 概述
本规范文档定义了PDF-Home模块(v3)的设计原则、架构约束和开发规范，确保代码一致性、可维护性和扩展性。

## 遵循的全局规范

### 核心规范映射
| 规范类别 | 全局规范文件 | 本模块具体实现 |
|---------|-------------|---------------|
| **命名规范** | `docs/SPEC/naming-convention.md` | 模块、类、事件命名统一格式 |
| **类规范** | `docs/SPEC/class-standard.md` | 单一职责、组合优于继承 |
| **函数规范** | `docs/SPEC/function-standard.md` | 异步处理、错误边界 |
| **事件设计** | `docs/SPEC/communication/frontend-event-design.md` | 事件命名、常量定义 |
| **注释规范** | `docs/SPEC/comment-standard.md` | JSDoc标准注释 |
| **文件结构** | `docs/SPEC/file-structure.md` | 模块化目录组织 |

## 架构设计规范

### 核心架构原则
- **组合优于继承**: 使用对象组合而非类继承，降低耦合度
- **事件驱动**: 所有组件通过事件总线进行通信，支持异步加载
- **单一职责**: 每个模块专注于特定功能领域
- **错误边界**: 模块级错误处理，确保系统稳定性

### 模块职责规范

#### 1. 主应用协调器
- **文件**: `index.js`
- **职责**: 应用初始化、模块协调、全局错误处理
- **约束**: 构造函数仅初始化，禁止复杂逻辑

#### 2. 事件总线模块
- **文件**: `modules/event-bus.js`
- **职责**: 模块间通信中枢
- **规范**: 支持事件验证、调试模式、多级日志

#### 3. 事件常量模块
- **文件**: `modules/event-constants.js`
- **职责**: 统一事件名称定义
- **格式**: `{模块}:{动作}:{状态}`

#### 4. 功能模块规范
| 模块 | 文件 | 核心职责 | 禁止行为 |
|------|------|----------|----------|
| **错误处理** | `error-handler.js` | 统一错误处理和报告 | 直接操作DOM |
| **UI管理** | `ui-manager.js` | 界面渲染和交互处理 | 业务逻辑处理 |
| **PDF管理** | `pdf-manager.js` | PDF文件业务逻辑 | 直接操作UI |
| **WebSocket** | `ws-client.js` | WebSocket通信管理 | 业务逻辑耦合 |

## 事件系统规范

### 事件命名规范
遵循 `{领域}:{动作}:{状态}` 格式：
- `pdf:load:start` - PDF加载开始
- `pdf:load:success` - PDF加载成功  
- `ui:button:click` - 按钮点击事件
- `sys:websocket:connected` - WebSocket连接建立

### 事件常量定义
所有事件必须在`event-constants.js`中统一定义：
```javascript
export const APP_EVENTS = {
  INIT: { START: 'app:init:start', COMPLETE: 'app:init:complete' }
};

export const PDF_MANAGEMENT_EVENTS = {
  LOAD: { START: 'pdf:load:start', SUCCESS: 'pdf:load:success' }
};
```

## 开发规范

### 模块创建规范
- **独立文件**: 每个功能模块单独创建文件，置于`modules/`或`utils/`目录
- **类封装**: 使用`class`语法，构造函数仅做初始化，避免复杂逻辑
- **事件驱动**: 所有对外通信通过事件总线，禁止直接调用其他模块方法

### 代码风格规范
```javascript
// ✅ 正确：使用常量事件名
this.eventBus.emit(EVENTS.PDF_SORT_START, {id, order});

// ❌ 错误：硬编码事件名
this.eventBus.emit('pdfSortStart', id, order);

// ✅ 正确：异步方法返回Promise
async loadPDFs() {
  this.eventBus.emit(EVENTS.PDF_LOAD_START);
  try {
    const pdfs = await this.fetchPDFs();
    this.eventBus.emit(EVENTS.PDF_LOAD_SUCCESS, pdfs);
  } catch (error) {
    this.eventBus.emit(EVENTS.PDF_LOAD_ERROR, error);
  }
}
```

### 测试规范
- **单元测试**: 每个模块独立测试，模拟事件总线
- **集成测试**: 测试模块间事件通信
- **日志验证**: 检查事件发布和状态变更

## 文件结构规范

```
src/frontend/pdf-home/
├── index.html          # 主页面HTML结构
├── index.js            # 应用入口和主协调器
├── style.css           # 样式文件
├── modules/            # 核心功能模块
│   ├── event-bus.js       # 事件总线实现
│   ├── event-constants.js # 事件常量定义
│   ├── error-handler.js   # 错误处理模块
│   ├── ui-manager.js      # UI管理模块
│   ├── pdf-manager.js     # PDF业务逻辑管理
│   └── ws-client.js       # WebSocket客户端
└── utils/              # 工具函数
    ├── logger.js          # 日志记录工具
    └── dom-utils.js       # DOM操作工具
```

## 兼容性规范

### 环境兼容性
- ✅ QtWebEngine 异步加载支持
- ✅ WebSocket 标准协议
- ✅ 响应式设计（桌面和移动端）

### 性能指标
- 🚀 首次加载时间 < 2秒（目标）
- 💾 内存使用优化
- ⚡ 事件响应延迟 < 100毫秒

## 新功能开发规范

### 开发流程规范

#### 1. 需求分析阶段
- **创建任务文档**: 在`AItask/`目录下创建任务分析文档
- **规范检查**: 对照本SPEC文档确认需求符合架构原则
- **事件设计**: 预先设计所需的事件流和事件名称

#### 2. 模块设计阶段
- **单一职责确认**: 新功能是否属于现有模块职责范围
- **事件集成**: 如何通过事件与现有模块协作
- **接口定义**: 对外暴露的事件接口和数据格式

#### 3. 编码实现阶段
- **文件创建**: 按照文件结构规范创建新模块文件
- **事件常量**: 在`event-constants.js`中添加新事件定义
- **类实现**: 遵循类规范和代码风格规范

### 新增功能类型规范

#### 1. 新增业务功能模块
**示例场景**: 添加PDF批注功能
```javascript
// 1. 在event-constants.js中添加
export const PDF_ANNOTATION_EVENTS = {
  CREATE: { START: 'pdf:annotation:create:start', SUCCESS: 'pdf:annotation:create:success' }
};

// 2. 创建新模块文件 modules/pdf-annotation-manager.js
class PDFAnnotationManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.annotations = new Map();
  }
  
  async createAnnotation(pdfId, annotationData) {
    this.eventBus.emit(EVENTS.PDF_ANNOTATION_CREATE_START, {pdfId, annotationData});
    // 实现逻辑
  }
}
```

#### 2. 新增UI功能模块
**示例场景**: 添加PDF预览功能
```javascript
// 1. 在event-constants.js中添加
export const UI_PREVIEW_EVENTS = {
  OPEN: 'ui:preview:open',
  CLOSE: 'ui:preview:close'
};

// 2. 创建新模块文件 modules/ui-preview-manager.js
class UIPreviewManager {
  constructor(eventBus, container) {
    this.eventBus = eventBus;
    this.container = container;
  }
  
  openPreview(pdfData) {
    this.eventBus.emit(EVENTS.UI_PREVIEW_OPEN, pdfData);
    // 渲染预览界面
  }
}
```

#### 3. 新增工具函数
**示例场景**: 添加PDF文件格式验证工具
```javascript
// 创建新工具文件 utils/pdf-validator.js
class PDFValidator {
  static validateFile(file) {
    // 验证逻辑
  }
  
  static getFileInfo(file) {
    // 获取文件信息
  }
}
```

### 集成测试规范

#### 1. 模块集成测试
```javascript
// 测试文件: test/modules/pdf-annotation.test.js
describe('PDFAnnotationManager', () => {
  let eventBus, annotationManager;
  
  beforeEach(() => {
    eventBus = new EventBus();
    annotationManager = new PDFAnnotationManager(eventBus);
  });
  
  test('should emit create event', async () => {
    const mockHandler = jest.fn();
    eventBus.on(EVENTS.PDF_ANNOTATION_CREATE_START, mockHandler);
    
    await annotationManager.createAnnotation('pdf-1', {text: 'test'});
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

#### 2. 事件流测试
```javascript
// 测试文件: test/integration/annotation-flow.test.js
describe('Annotation Flow Integration', () => {
  test('complete annotation creation flow', async () => {
    // 模拟完整的用户操作流程
  });
});
```

### 代码审查清单

#### 新增功能检查项
- [ ] 事件命名符合`{模块}:{动作}:{状态}`格式
- [ ] 事件常量在`event-constants.js`中定义
- [ ] 类构造函数仅做初始化
- [ ] 所有对外通信通过事件总线
- [ ] 包含完整的错误处理
- [ ] 添加了对应的测试文件
- [ ] 更新了相关文档

#### 回归测试检查项
- [ ] 现有功能不受影响
- [ ] 事件总线性能无下降
- [ ] 内存使用无泄漏
- [ ] 兼容性测试通过

### 文档更新规范

#### 1. SPEC.md更新
- 添加新模块到功能模块规范表
- 更新事件系统规范（如有新事件类型）
- 补充兼容性说明（如有新要求）

#### 2. README.md更新
- 如新增用户可见功能，更新使用用例
- 如影响性能指标，更新性能指标说明

#### 3. 代码注释
- 新模块需包含完整的JSDoc注释
- 复杂业务逻辑需添加详细注释

## 版本信息
- **规范版本**: v1.1
- **适用模块**: PDF-Home v3
- **更新日期**: 2025-01-24
- **维护者**: 前端开发团队