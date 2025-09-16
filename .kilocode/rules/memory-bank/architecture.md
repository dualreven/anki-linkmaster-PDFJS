# 系统架构

## 整体架构

### 技术栈
- **后端**: Python 3.9+ + PyQt6 + WebSocket
- **前端**: Vanilla JavaScript + PDF.js + Vite + Tabulator Tables
- **通信**: WebSocket实时通信
- **数据存储**: 本地文件系统 + JSON配置
- **构建工具**: Vite (前端) + pip (后端)

### 架构模式
- **事件驱动架构**: 使用事件总线实现模块间松耦合通信
- **模块化设计**: 清晰的模块边界和职责分离
- **文件副本机制**: 自动创建PDF副本确保数据安全
- **信号系统**: PyQt信号进行组件间通信

## 核心模块

### 后端架构

#### AnkiLinkMasterApp (src/backend/app/application.py)
- **职责**: 应用主控制器，协调各模块生命周期
- **核心功能**:
  - WebSocket服务器管理
  - 消息路由和处理
  - PDF管理器协调
  - 主窗口管理

#### PDFManager (src/backend/pdf_manager/manager.py)
- **职责**: PDF文件的核心管理逻辑
- **核心功能**:
  - 文件添加/删除操作
  - 文件副本管理
  - 元数据提取
  - 文件列表维护
  - 批量操作支持

#### WebSocketServer (src/backend/websocket/server.py)
- **职责**: WebSocket通信管理
- **核心功能**:
  - 连接管理
  - 消息收发
  - 客户端状态跟踪
  - 广播功能

### 前端架构

#### PDFHomeApp (src/frontend/pdf-home/index.js)
- **职责**: 前端应用主控制器
- **核心功能**:
  - 模块初始化协调
  - 事件总线管理
  - WebSocket连接管理
  - UI组件协调

#### PDFManager (src/frontend/common/pdf/pdf-manager.js)
- **职责**: 前端PDF管理器
- **核心功能**:
  - WebSocket消息处理
  - PDF列表状态管理
  - 批量操作协调
  - 事件路由

#### WSClient (src/frontend/common/ws/ws-client.js)
- **职责**: WebSocket客户端管理
- **核心功能**:
  - 连接建立和维护
  - 消息队列管理
  - 自动重连机制
  - 消息路由

#### EventBus (src/frontend/common/event/event-bus.js)
- **职责**: 前端事件总线
- **核心功能**:
  - 事件发布订阅
  - 事件验证
  - 内存泄漏防护
  - 调试日志

## 数据流架构

### 文件添加流程
```
用户操作 → 前端事件 → WebSocket消息 → 后端处理 → 文件副本创建 → 元数据提取 → 数据库更新 → 广播更新 → 前端更新
```

### 文件删除流程
```
用户操作 → 前端事件 → WebSocket消息 → 后端处理 → 文件删除 → 数据库更新 → 广播更新 → 前端更新
```

### PDF加载流程
```
用户选择PDF → 前端事件(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED) → PDFManager.loadPDF() → PDF.js初始化 → 文档加载 → 页面缓存 → 渲染第一页 → 事件广播(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS)
```

#### PDF.js集成机制
- **库版本**: PDF.js 3.4.120
- **Worker配置**: 使用CDN加载 `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`
- **兼容性处理**: `webgl-detector.js` 自动检测WebGL支持，失败时回退至Canvas渲染
- **内存管理**: `page-transfer-manager.js` 实现LRU缓存策略，最大缓存10页，定期清理非活跃页面
- **错误处理**: 分类错误类型（加载失败、解码错误、权限错误），支持自动重试（最多3次），通过 `pdf-manager.js` 的 `retryLoad()` 方法实现
- **测试验证**: `qtwebengine-compatibility.test.js` 和 `webgl-integration.test.js` 已覆盖跨平台渲染与硬件加速场景

#### 前端PDF处理
- **PDFManager**: 核心PDF加载和管理类
- **支持格式**: URL、ArrayBuffer、Blob
- **进度回调**: 实时加载进度反馈
- **缓存策略**: LRU页面缓存，内存使用监控

#### 后端PDF处理
- **PDFManager**: PyQt6集成的高级管理器
- **文件副本**: 自动创建PDF副本确保数据安全
- **元数据提取**: 自动提取PDF元数据（标题、作者等）
- **批量操作**: 支持批量添加、删除PDF文件

## 关键设计决策

### 1. 事件驱动设计
- **原因**: 实现模块间松耦合，提高可维护性
- **实现**: 前端使用EventBus，后端使用PyQt信号
- **优势**: 便于功能扩展和测试

### 2. 文件副本机制
- **原因**: 保护原始文件，确保数据安全
- **实现**: 自动复制到data/pdfs目录
- **优势**: 防止意外修改原始文件

### 3. WebSocket通信
- **原因**: 实现实时双向通信
- **实现**: 自定义消息格式和错误处理
- **优势**: 实时更新用户界面

### 4. 模块化架构
- **原因**: 提高代码可维护性和可扩展性
- **实现**: 清晰的模块边界和接口定义
- **优势**: 便于团队协作和功能迭代

## 目录结构

```
anki-linkmaster-PDFJS/
├── src/
│   ├── backend/              # PyQt6后端应用
│   │   ├── app/              # 主应用逻辑
│   │   ├── pdf_manager/      # PDF文件管理
│   │   ├── websocket/        # WebSocket通信
│   │   └── ui/               # 用户界面
│   └── frontend/             # 前端应用
│       ├── pdf-home/         # PDF主页模块
│       ├── pdf-viewer/       # PDF阅读器模块
│       └── common/           # 共享组件
├── data/                     # 数据存储
│   ├── pdfs/                # PDF文件副本
│   ├── thumbnails/          # 缩略图
│   └── pdf_files.json       # 文件索引
├── docs/                     # 项目文档
└── tests/                    # 测试文件
```

## 性能考虑

### 前端优化
- **虚拟滚动**: 处理大数据集表格渲染
- **事件防抖**: 减少频繁操作的性能开销
- **内存管理**: 及时清理事件监听器

### 后端优化
- **异步处理**: 非阻塞的文件操作
- **连接池**: WebSocket连接管理
- **缓存机制**: 文件元数据缓存

## 扩展性设计

### 插件系统
- **模块接口**: 标准化的模块接口定义
- **事件扩展**: 可扩展的事件类型
- **配置系统**: 灵活的配置管理

### API设计
- **RESTful原则**: 清晰的API设计
- **版本控制**: API版本管理
- **向后兼容**: 确保升级平滑