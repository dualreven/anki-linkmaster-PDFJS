# Anki LinkMaster PDFJS - 技术栈与开发指南

## 概述

Anki LinkMaster PDFJS 是一个现代化的桌面应用，集成了PDF文件管理、PDF阅读器和Anki卡片生成功能。采用模块化架构设计，支持跨平台运行。

## 技术栈

### 后端技术栈

- **Python 3.9+**: 核心后端语言
- **PyQt6**: 图形用户界面框架
- **WebSocket**: 内置WebSocket服务器实现实时通信
- **文件处理**: shutil, os, json, pathlib
- **异步处理**: 基于PyQt信号的异步架构

### 前端技术栈

- **JavaScript ES6+**: Vanilla JavaScript，无框架依赖
- **PDF.js 3.4.120**: PDF渲染和处理库
  - Worker配置: CDN加载 `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`
  - 兼容性处理: `webgl-detector.js` 自动检测WebGL支持，失败时回退至Canvas渲染
  - 内存管理: `page-transfer-manager.js` 实现LRU缓存策略，最大缓存10页
- **Tabulator Tables 5.4.4**: 企业级表格组件，支持虚拟滚动、多列排序、高级过滤
- **Vite 5.0.0**: 现代化构建工具，支持热重载
- **ES6模块**: 现代JavaScript模块系统

### 开发工具

- **ESLint 9.34.0**: 代码质量检查
- **JSDoc**: 代码文档生成
- **Jest 30.1.1**: 前端测试框架
- **Babel 7.x**: JavaScript转译器
- **pytest**: 后端测试框架

## 核心模块使用指南

### 事件总线 (EventBus)

事件总线是前端模块间通信的核心组件，采用发布-订阅模式。

#### 主要接口

```javascript
import { EventBus } from '../common/event/event-bus.js';

// 订阅事件
const unsubscribe = EventBus.on('module:action:status', (data) => {
  console.log('收到事件:', data);
});

// 发布事件
EventBus.emit('module:action:status', { key: 'value' });

// 取消订阅
unsubscribe();

// 一次性订阅
EventBus.once('module:action:status', (data) => {
  console.log('一次性事件:', data);
});
```

#### 事件命名规范
事件名称必须遵循 `{module}:{action}:{status}` 格式：
- `pdf:add:requested` - PDF添加请求
- `websocket:connection:established` - WebSocket连接建立
- `ui:error:show` - UI错误显示

### WebSocket客户端 (WSClient)

WebSocket客户端负责前后端实时通信。

#### 主要接口

```javascript
import WSClient from '../common/ws/ws-client.js';

// 创建客户端实例
const wsClient = new WSClient('ws://localhost:8765', EventBus);

// 连接服务器
wsClient.connect();

// 发送消息
wsClient.send({
  type: 'get_pdf_list',
  data: {}
});

// 发送带响应的请求
const pdfDetail = await wsClient.sendPDFDetailRequest('pdf-id', 5000, 3);

// 断开连接
wsClient.disconnect();
```

#### 消息类型常量
```javascript
import { WEBSOCKET_MESSAGE_TYPES } from '../common/event/event-constants.js';

// 使用预定义的消息类型
wsClient.send({
  type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST,
  data: {}
});
```

### PDF管理器 (PDFManager)

PDF管理器负责PDF文件的添加、删除和列表管理。

#### 前端PDFManager

```javascript
import PDFManager from '../common/pdf/pdf-manager.js';

// 创建管理器实例
const pdfManager = new PDFManager(EventBus);

// 初始化
pdfManager.initialize();

// 获取PDF列表
const pdfList = pdfManager.getPDFs();

// 销毁清理
pdfManager.destroy();
```

#### 后端PDFManager (Python)

```python
from src.backend.pdf_manager.manager import PDFManager

# 创建管理器实例
pdf_manager = PDFManager(data_dir="data")

# 添加PDF文件
success = pdf_manager.add_file("/path/to/file.pdf")

# 删除PDF文件
success = pdf_manager.remove_file("file_id")

# 获取文件列表
pdf_files = pdf_manager.get_files()

# 信号连接
pdf_manager.file_added.connect(lambda file_info: print(f"文件添加: {file_info}"))
pdf_manager.file_removed.connect(lambda file_id: print(f"文件删除: {file_id}"))
```

### UI管理器 (UIManager)

UI管理器负责界面控制和用户交互。

```javascript
import { UIManager } from './ui-manager.js';

// 初始化UI管理器
const uiManager = new UIManager(EventBus);

// 显示错误消息
uiManager.showError("操作失败", "详细错误信息");

// 显示成功消息
uiManager.showSuccess("操作成功");

// 更新界面状态
uiManager.updateLoadingState(true);
```

### PDF查看器模块

PDF查看器基于PDF.js构建，提供完整的PDF阅读功能。

#### 主要组件

```javascript
// PDF管理器 - 核心PDF加载和管理
import PDFManager from '../pdf-viewer/pdf-manager.js';

// 页面传输管理器 - LRU缓存和内存管理
import PageTransferManager from '../pdf-viewer/page-transfer-manager.js';

// UI管理器 - 界面控制和事件处理
import UIManager from '../pdf-viewer/ui-manager.js';
```

#### 使用示例

```javascript
// 加载PDF文档
PDFManager.loadPDF(pdfUrl, {
  onProgress: (progress) => console.log(`加载进度: ${progress}%`),
  onSuccess: (pdfDocument) => console.log('PDF加载成功'),
  onError: (error) => console.error('PDF加载失败', error)
});

// 渲染指定页面
PDFManager.renderPage(pageNumber, canvasElement, {
  scale: 1.5,
  rotation: 0
});
```

## 事件系统说明

### 事件常量定义

项目使用统一的事件常量系统，所有事件都在 `src/frontend/common/event/` 目录下定义。

#### 主要事件分类

**应用事件 (APP_EVENTS)**
```javascript
APP_EVENTS.INITIALIZATION.STARTED    // 应用初始化开始
APP_EVENTS.INITIALIZATION.COMPLETED  // 应用初始化完成
```

**WebSocket事件 (WEBSOCKET_EVENTS)**
```javascript
WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED  // 连接建立
WEBSOCKET_EVENTS.MESSAGE.RECEIVED        // 消息接收
```

**PDF管理事件 (PDF_MANAGEMENT_EVENTS)**
```javascript
PDF_MANAGEMENT_EVENTS.ADD.REQUESTED      // PDF添加请求
PDF_MANAGEMENT_EVENTS.REMOVE.COMPLETED   // PDF删除完成
```

**PDF查看器事件 (PDF_VIEWER_EVENTS)**
```javascript
PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED    // 文件加载请求
PDF_VIEWER_EVENTS.NAVIGATION.NEXT        // 下一页
PDF_VIEWER_EVENTS.ZOOM.IN                // 放大
```

### 事件使用最佳实践

1. **始终使用命名导入**
```javascript
// 正确
import { PDF_MANAGEMENT_EVENTS } from '../event/event-constants.js';

// 错误
import EVENT_CONSTANTS from '../event/event-constants.js';
```

2. **事件数据规范**
```javascript
// 发布事件时提供完整数据
EventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, {
  fileId: 'unique-id',
  fileName: 'document.pdf',
  fileSize: 1024,
  timestamp: new Date().toISOString()
});
```

3. **错误处理**
```javascript
EventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.FAILED, {
  error: error.message,
  filePath: '/path/to/file.pdf',
  retryable: true
});
```

## 开发环境设置

### 系统要求

- **操作系统**: Windows 10+/macOS 10.15+/Linux
- **Python**: 3.9 或更高版本
- **Node.js**: 16.0 或更高版本
- **内存**: 至少4GB RAM
- **磁盘空间**: 至少1GB可用空间

### 安装步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd anki-linkmaster-PDFJS
```

#### 2. 后端环境设置
```bash
cd src/backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

#### 3. 前端环境设置
```bash
npm install
```

#### 4. 使用AI启动器（推荐）
```bash
# 启动所有服务
.\ai-launcher.ps1 start

# 启动特定模块
.\ai-launcher.ps1 start -Module pdf-home -Port 3001
.\ai-launcher.ps1 start -Module pdf-viewer -Port 3002

# 查看服务状态
.\ai-launcher.ps1 status

# 查看日志
.\ai-launcher.ps1 logs

# 停止所有服务
.\ai-launcher.ps1 stop
```

#### 5. 手动启动（不推荐）
```bash
# 前端开发服务器
npm run dev

# 后端应用
python src/backend/main.py

# Python调试控制台
python debug.py --port 9222
```

## 调试和故障排除

### 前端调试

**浏览器开发者工具**
- 使用Chrome DevTools进行调试
- 查看EventBus事件日志
- 监控内存使用和性能

**日志系统**
```javascript
import Logger from '../common/utils/logger.js';

const logger = new Logger('MyModule');
logger.debug('调试信息');
logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息');
```

**事件调试**
```javascript
// 启用详细事件日志
const eventBus = new EventBus({
  enableValidation: true,
  logLevel: LogLevel.DEBUG
});
```

### 后端调试

**PyQt6信号调试**
```python
# 连接信号进行调试
pdf_manager.file_added.connect(lambda file_info: print(f"File added: {file_info}"))
pdf_manager.error_occurred.connect(lambda error: print(f"Error: {error}"))
```

**WebSocket调试**
```python
# 查看WebSocket连接状态
print(f"WebSocket状态: {websocket_server.get_connection_count()}个连接")
```

### 常见问题解决

**PDF.js加载问题**
- 检查CDN连接状态
- 验证WebGL支持
- 查看控制台错误信息

**WebSocket连接失败**
- 确认后端服务正在运行
- 检查防火墙设置
- 验证端口配置

**内存泄漏**
- 及时清理事件监听器
- 使用destroy()方法释放资源
- 监控内存使用情况

## 二次开发最佳实践

### 模块开发指南

1. **创建新模块**
```javascript
// src/frontend/my-module/index.js
import { EventBus } from '../common/event/event-bus.js';
import Logger from '../common/utils/logger.js';

class MyModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = new Logger('MyModule');
    this.initialize();
  }

  initialize() {
    this.setupEventListeners();
    this.logger.info('MyModule initialized');
  }

  setupEventListeners() {
    this.eventBus.on('my-module:action:requested', this.handleAction.bind(this));
  }

  handleAction(data) {
    this.logger.debug('Handling action', data);
    // 处理逻辑
  }

  destroy() {
    this.logger.info('MyModule destroyed');
  }
}

export default MyModule;
```

2. **定义事件常量**
```javascript
// src/frontend/my-module/event-constants.js
export const MY_MODULE_EVENTS = {
  ACTION: {
    REQUESTED: 'my-module:action:requested',
    COMPLETED: 'my-module:action:completed',
    FAILED: 'my-module:action:failed'
  }
};
```

3. **集成到主应用**
```javascript
// 在PDFHomeApp或PDFViewerApp中集成
import MyModule from './my-module/index.js';

class PDFHomeApp {
  constructor() {
    // ...其他初始化
    this.myModule = new MyModule(this.eventBus);
  }
}
```

### 代码规范

**JavaScript规范**
- 使用camelCase命名变量和函数
- 使用PascalCase命名类和构造函数
- 使用JSDoc格式注释
- 导入顺序：标准库 → 第三方库 → 本地模块

**Python规范**
- 使用snake_case命名变量和函数
- 使用PascalCase命名类
- 遵循PEP8编码规范
- 使用类型注解

### 测试策略

**前端测试**
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- src/frontend/my-module/__tests__/my-module.test.js

# 测试覆盖率
npm test -- --coverage
```

**后端测试**
```bash
# 运行Python测试
pytest src/backend/tests/

# 带覆盖率
pytest --cov=src.backend src/backend/tests/
```

### 性能优化

**前端优化**
- 使用虚拟滚动处理大数据集
- 实现事件防抖减少频繁操作
- 及时清理事件监听器防止内存泄漏
- 使用LRU缓存管理PDF页面

**后端优化**
- 使用异步文件操作
- 实现连接池管理WebSocket连接
- 缓存文件元数据减少IO操作
- 监控内存使用防止泄漏

## 扩展性设计

### 插件架构

项目支持插件式扩展，可以通过事件总线集成新功能。

**创建插件示例**
```javascript
class MyPlugin {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setup();
  }

  setup() {
    // 订阅相关事件
    this.eventBus.on('pdf:list:updated', this.onPDFListUpdated.bind(this));
  }

  onPDFListUpdated(pdfList) {
    // 处理PDF列表更新
    console.log('PDF列表已更新', pdfList);
  }

  // 插件方法
  doSomething() {
    this.eventBus.emit('my-plugin:action:requested', { data: 'value' });
  }
}
```

### API设计

**WebSocket API**
- 使用标准消息格式
- 统一的错误响应格式
- 版本控制支持
- 向后兼容性保证

**事件API**
- 清晰的事件命名规范
- 完整的事件数据格式
- 错误处理和恢复机制
- 调试和日志支持

## 版本信息

- **项目版本**: 1.0.0
- **最后更新**: 2025-09-14
- **兼容性**: Python 3.9+, Node.js 16+

## 技术支持

- 查看项目README.md获取基本使用指南
- 参考各模块的SPEC文档了解详细规范
- 使用AI启动器进行自动化开发和调试
- 通过事件总线日志进行问题诊断

---

*本文档持续更新，请定期查看最新版本以获取最新技术信息。*