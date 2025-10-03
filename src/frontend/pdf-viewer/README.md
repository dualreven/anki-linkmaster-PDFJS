# PDF-Viewer 前端模块

PDF-Viewer 是 Anki LinkMaster 项目的核心PDF查看和渲染模块，基于 PDF.js 和 Qt 集成的事件驱动架构，提供PDF查看、导航、缩放功能。

## 目录

1. [架构概述](#架构概述)
2. [文件结构](#文件结构)
3. [模块功能](#模块功能)
4. [使用方法](#使用方法)
5. [API接口](#api接口)
6. [配置说明](#配置说明)

## 架构概述

PDF-Viewer 采用事件驱动的组合式架构，通过容器化依赖注入实现松耦合的模块设计。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      PDF-Viewer 架构                              │
├─────────────────────────────────────────────────────────────────┤
│  应用层 (Application Layer)                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   PDFViewerApp  │────│  EventHandlers  │                     │
│  │   (主应用类)     │    │   (事件处理)     │                     │
│  └─────────────────┘    └─────────────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│  核心层 (Core Layer)                                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ PDFViewerAppCore│────│  AppContainer   │                     │
│  │   (核心协调器)   │    │  (依赖容器)      │                     │
│  └─────────────────┘    └─────────────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│  业务层 (Business Layer)                                         │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   PDFManager    │────│   UIManager     │                     │
│  │  (PDF管理器)     │    │  (界面管理器)    │                     │
│  └─────────────────┘    └─────────────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│  基础设施层 (Infrastructure Layer)                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │    EventBus     │ │     Logger      │ │    WSClient     │   │
│  │   (事件总线)     │ │    (日志)       │ │  (WebSocket)    │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 文件结构

### 核心文件

```
src/frontend/pdf-viewer/
├── main.js                     # 应用主入口点
├── app-core.js                 # 核心协调器，管理模块生命周期
├── launcher.py                 # Python启动器，支持Qt集成
├── index.html                  # HTML模板
└── style.css                   # 样式定义
```

### 业务模块

```
src/frontend/pdf-viewer/
├── pdf-manager.js              # PDF文档管理，加载、渲染、导航
├── ui-manager.js               # 用户界面管理，协调各UI组件
├── ui-manager-core.js          # UI管理器核心逻辑
├── event-handlers.js           # 事件处理器，定义应用级事件响应
├── ui-canvas-render.js         # 画布渲染组件，处理PDF页面绘制
├── ui-zoom-controls.js         # 缩放控制组件
└── ui-progress-error.js        # 进度和错误显示组件
```

### 数据传输

```
src/frontend/pdf-viewer/
├── page-transfer-core.js       # 页面传输核心，处理页面数据流
├── page-transfer-manager.js    # 页面传输管理器，协调传输流程
└── websocket-handler.js        # WebSocket处理器，管理实时通信
```

### Qt集成

```
src/frontend/pdf-viewer/
├── pdf_viewer_bridge.py        # Python-JavaScript桥接器
├── main_window.py              # Qt主窗口实现
├── js_console_logger.py        # JavaScript控制台日志捕获
└── js_console_logger_qt.py     # Qt环境下的日志处理
```

### 容器架构

```
src/frontend/pdf-viewer/container/
└── app-container.js            # 应用容器，管理依赖注入
```

### 测试套件

```
src/frontend/pdf-viewer/__tests__/
├── main.test.js                # 主模块测试
├── pdf-manager.test.js         # PDF管理器测试
├── ui-manager.test.js          # UI管理器测试
└── page-transfer-manager.test.js # 页面传输测试
```

## 模块功能

### 1. PDFManager - PDF管理器

负责PDF文档的加载、渲染和页面管理。

```javascript
// PDF加载示例
const pdfManager = new PDFManager(eventBus);
await pdfManager.initialize();

// 加载PDF文件
eventBus.emit('pdf:file:load:requested', {
  filename: 'document.pdf'
}, {
  actorId: 'UserAction'
});
```

**主要功能**:
- PDF文件加载和解析
- 页面渲染和缓存管理
- PDF.js集成和Worker管理
- 页面导航控制

### 2. UIManager - 界面管理器

管理用户界面组件和交互。

```javascript
// 页面导航示例
eventBus.emit('ui:navigation:page', {
  action: 'next'
}, {
  actorId: 'NavigationControl'
});

// 缩放控制示例
eventBus.emit('ui:zoom:set', {
  zoomLevel: 1.5
}, {
  actorId: 'ZoomControl'
});
```

**主要功能**:
- 缩放控制（放大、缩小、适应页面、适应宽度）
- 页面导航（上一页、下一页、跳转到指定页）
- 进度显示和错误处理
- 画布渲染管理

### 3. WebSocket通信

处理与后端的实时通信。

```javascript
// WebSocket消息示例
wsClient.send({
  type: 'pdf:page:request',
  data: {
    filename: 'document.pdf',
    pageNumber: 5
  }
});
```

**主要功能**:
- WebSocket连接管理
- 消息队列和重连机制
- PDF数据传输
- 状态同步

### 4. Qt集成

Python与JavaScript桥接通信。

```python
# Python侧示例
from pdf_viewer_bridge import PdfViewerBridge

bridge = PdfViewerBridge()
channel = QWebChannel()
channel.registerObject("pdfViewerBridge", bridge)
```

**主要功能**:
- QWebChannel桥接通信
- JavaScript日志捕获
- 原生窗口集成
- 文件路径注入

## 使用方法

### 1. 使用AI Launcher（推荐）

```bash
# 启动PDF查看器
python ai_launcher.py start --module pdf-viewer

# 指定PDF文件启动
python ai_launcher.py start --module pdf-viewer --pdf-id "document"

# 自定义端口启动
python ai_launcher.py start --module pdf-viewer --vite-port 3001 --msgServer-port 8766

# 查看服务状态
python ai_launcher.py status

# 停止所有服务
python ai_launcher.py stop
```

### 2. 独立启动

```bash
# 1. 启动Vite开发服务器
cd src/frontend/pdf-viewer
npm run dev

# 2. 启动后端服务（另一个终端）
cd src/backend
python launcher.py start --module pdf-viewer

# 3. 启动PDF查看器窗口（第三个终端）
cd src/frontend/pdf-viewer
python launcher.py --pdf-id sample              # 推荐：使用PDF ID
# python launcher.py --file-path path/to/document.pdf  # 已过时，不推荐
```

### 3. 开发模式

```bash
# 开发模式启动（包含热重载）
python ai_launcher.py start --module pdf-viewer --dev-mode

# 或手动启动开发服务器
cd src/frontend/pdf-viewer
npm run dev -- --host 0.0.0.0 --port 3000
```

### 环境要求

- **Node.js**: 16.0+ (推荐18.0+)
- **Python**: 3.8+ (推荐3.10+)
- **PyQt**: PyQt5 5.15+ 或 PyQt6 6.2+

## API接口

### WebSocket消息协议

#### 1. PDF加载请求

```javascript
const message = {
  type: 'pdf:load:request',
  data: {
    filename: 'document.pdf',
    pageNumber: 1  // 可选，默认第1页
  },
  metadata: {
    requestId: 'req_' + Date.now(),
    actorId: 'PDFViewer'
  }
};
```

#### 2. 页面数据响应

```javascript
const response = {
  type: 'pdf:page:data',
  data: {
    filename: 'document.pdf',
    pageNumber: 1,
    totalPages: 50,
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    pageSize: {
      width: 595,
      height: 842
    }
  }
};
```

#### 3. 页面导航

```javascript
const navigationMessage = {
  type: 'pdf:navigation:request',
  data: {
    filename: 'document.pdf',
    action: 'next' | 'prev' | 'first' | 'last' | 'goto',
    targetPage: 5  // 仅当action为'goto'时需要
  }
};
```

### QWebChannel API

#### Python侧

```python
class PdfViewerBridge(QObject):
    def send_to_js(self, message_type: str, data: dict):
        """发送消息到JavaScript端"""
        self.messageToJs.emit(message_type, json.dumps(data))

    @pyqtSlot(str, str)
    def receive_from_js(self, message_type: str, data_json: str):
        """接收来自JavaScript的消息"""
        data = json.loads(data_json)
        self.handle_js_message(message_type, data)
```

#### JavaScript侧

```javascript
// 检查桥接器可用性
if (typeof qt !== 'undefined' && qt.webChannelTransport) {
  new QWebChannel(qt.webChannelTransport, function (channel) {
    window.pdfViewerBridge = channel.objects.pdfViewerBridge;

    // 监听来自Python的消息
    window.pdfViewerBridge.messageToJs.connect(function(messageType, dataJson) {
      const data = JSON.parse(dataJson);
      handlePythonMessage(messageType, data);
    });
  });
}
```

## 配置说明

### 端口配置

```javascript
// 端口解析优先级
const portConfig = {
  vite: process.env.VITE_PORT || 3000,
  websocket: process.env.WS_PORT || 8765,
  fileServer: process.env.PDF_PORT || 8080
};
```

### 应用配置

```javascript
// 容器配置
const containerConfig = {
  // WebSocket配置
  wsUrl: 'ws://localhost:8765',
  enableValidation: true,

  // PDF渲染配置
  pdfWorkerSrc: '/pdf.worker.min.js',
  maxCanvasPixels: 16777216,

  // UI配置
  defaultZoomLevel: 1.0,
  zoomStep: 0.25,
  maxZoomLevel: 5.0,
  minZoomLevel: 0.1
};
```

### 日志配置

```python
# Python启动器配置
DEFAULT_CONFIG = {
    'window_title': 'PDF查看器',
    'window_size': (1200, 800),
    'log_level': logging.INFO,
    'pdf_id': 'default'
}

# 日志文件配置
LOG_CONFIG = {
    'python_log_file': 'logs/pdf-viewer-{pdf_id}.log',
    'js_log_file': 'logs/pdf-viewer-{pdf_id}-js.log'
}
```

---

**最后更新**: 2025-09-27
**文档版本**: 2.1.0
**维护者**: PDF-Viewer 开发团队