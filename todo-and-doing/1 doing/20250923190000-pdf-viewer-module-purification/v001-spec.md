# PDF-Viewer模块纯化改造规格说明

**功能ID**: 20250923190000-pdf-viewer-module-purification
**优先级**: 中
**版本**: v001
**创建时间**: 2025-09-23 19:00:00
**预计完成**: 2025-09-25
**状态**: 设计中

## 现状说明

### PDF-Viewer模块当前架构
- **模块组织**: 相对较好的模块化架构，使用容器依赖注入
- **前端公共模块**: 正确使用 `../common/` 下的通用组件
- **应用容器**: 已实现 `createPDFViewerContainer` 依赖注入容器
- **事件驱动**: 基于EventBus的组合式架构设计

### 与PDF-Home模块的差异
PDF-Home模块已经实现了较好的纯模块组织形式：
- 完全自包含的模块结构
- 无外部系统依赖的注入机制
- 统一的容器管理和生命周期控制
- 标准化的启动和初始化流程

## 存在问题

### 1. **PyQt环境依赖问题** [优先级: 高]

#### 问题1: window.PDF_PATH全局变量依赖
**位置**: `src/frontend/pdf-viewer/main.js:135-138`
```javascript
if (window.PDF_PATH) {
  logger.info(`Found injected PDF path: ${window.PDF_PATH}`);
  app.getEventBus().emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
    { filename: window.PDF_PATH }, { actorId: 'Launcher' });
}
```

**问题描述**:
- 依赖PyQt应用通过JavaScript注入的全局变量
- 违反了模块自包含的原则
- 在非PyQt环境下无法正常工作

**影响范围**: PDF文件自动加载功能

#### 问题2: window.RUNTIME_CONFIG配置依赖
**位置**: `src/frontend/pdf-viewer/utils/ws-port-resolver.js:34-35, 54-55`
```javascript
if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.pdf_server_port) {
  const portNum = parseInt(window.RUNTIME_CONFIG.pdf_server_port, 10);
}
if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.ws_port) {
  const portNum = parseInt(window.RUNTIME_CONFIG.ws_port, 10);
}
```

**问题描述**:
- 依赖外部运行时配置注入
- 配置获取方式不统一
- 缺少配置验证和错误处理

**影响范围**: WebSocket和PDF服务器端口解析

### 2. **外部UI组件依赖问题** [优先级: 中]

#### 问题3: window.progressManager依赖
**位置**: `src/frontend/pdf-viewer/ui-progress-error.js:41-43, 50, 62, 78-79`
```javascript
if (window.progressManager) {
  this.#currentProgressId = window.progressManager.show('pdf-viewer', statusText, {
    height: 4, color: '#007bff', showLabel: false, position: 'top'
  });
}
```

**问题描述**:
- 依赖外部进度条管理器
- 缺少内建的进度显示机制
- 降级处理不完善（只是日志输出）

**影响范围**: PDF加载进度显示

#### 问题4: window.notificationManager依赖
**位置**: `src/frontend/pdf-viewer/ui-progress-error.js:78-79, 191-192`
```javascript
if (window.notificationManager) {
  window.notificationManager.error('PDF加载失败', 5000);
}
```

**问题描述**:
- 依赖外部通知管理器
- 缺少内建的错误通知机制
- 用户体验在缺少外部管理器时降低

**影响范围**: 错误通知显示

### 3. **模块标准化问题** [优先级: 中]

#### 问题5: 缺少QWebChannel桥接器
**对比**: PDF-Home模块有完整的QWebChannel集成
```javascript
// PDF-Home有
import { initPdfHomeChannel } from './qwebchannel-bridge.js';

// PDF-Viewer缺少
// 没有对应的QWebChannel桥接机制
```

**问题描述**:
- 缺少与PyQt应用的直接通信桥梁
- 无法利用原生功能(文件对话框、系统通知等)
- 架构不完整，缺少重要的通信层

**影响范围**: 与PyQt应用的集成功能

#### 问题6: 启动流程不统一
**对比差异**:
- PDF-Home: 标准的DOMContentLoaded + 容器初始化流程
- PDF-Viewer: 相对简单，缺少一些标准化处理

**问题描述**:
- 启动流程缺少标准化的错误处理
- 缺少早期console桥接机制
- 初始化顺序可能存在竞态条件

## 提出需求

### 核心目标
**使PDF-Viewer模块达到与PDF-Home模块相同的纯模块组织水平**，消除对外部环境的硬依赖，实现完全自包含的模块架构。

### 具体需求

#### 1. **消除PyQt环境硬依赖**
- 移除对 `window.PDF_PATH` 的直接依赖
- 建立标准化的配置注入机制
- 实现运行时配置的统一管理

#### 2. **内建UI组件**
- 实现内建的进度条组件，替代外部progressManager
- 实现内建的通知组件，替代外部notificationManager
- 提供降级友好的用户体验

#### 3. **完善模块架构**
- 添加QWebChannel桥接器支持
- 统一启动和初始化流程
- 标准化错误处理和日志记录

#### 4. **配置管理标准化**
- 实现统一的配置管理器
- 支持多源配置(URL参数、环境变量、注入配置)
- 提供配置验证和默认值机制

## 解决方案

### 技术架构设计

#### 1. **配置管理器**
```javascript
class PDFViewerConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    // 优先级: URL参数 > 注入配置 > 默认值
    const urlParams = new URLSearchParams(window.location.search);
    const injectedConfig = window.RUNTIME_CONFIG || {};
    const defaultConfig = {
      wsPort: 8765,
      pdfServerPort: 8080,
      pdfPath: null,
      enableProgressBar: true,
      enableNotifications: true
    };

    return {
      wsPort: this.resolveConfig('ws_port', urlParams, injectedConfig, defaultConfig),
      pdfServerPort: this.resolveConfig('pdf_server_port', urlParams, injectedConfig, defaultConfig),
      pdfPath: this.resolveConfig('pdf_path', urlParams, injectedConfig, defaultConfig),
      enableProgressBar: this.resolveConfig('enable_progress_bar', urlParams, injectedConfig, defaultConfig),
      enableNotifications: this.resolveConfig('enable_notifications', urlParams, injectedConfig, defaultConfig)
    };
  }
}
```

#### 2. **内建进度条组件**
```javascript
class BuiltInProgressBar {
  constructor(container) {
    this.container = container;
    this.progressElement = null;
    this.isVisible = false;
  }

  show(title, options = {}) {
    if (!this.progressElement) {
      this.progressElement = this.createProgressElement();
      this.container.appendChild(this.progressElement);
    }

    this.updateProgress(0, title);
    this.progressElement.style.display = 'block';
    this.isVisible = true;

    return this.generateProgressId();
  }

  update(progressId, percent, statusText) {
    if (this.isVisible && this.progressElement) {
      this.updateProgress(percent, statusText);
    }
  }

  hide(progressId) {
    if (this.progressElement) {
      this.progressElement.style.display = 'none';
      this.isVisible = false;
    }
  }
}
```

#### 3. **内建通知组件**
```javascript
class BuiltInNotificationManager {
  constructor(container) {
    this.container = container;
    this.notifications = [];
    this.notificationContainer = null;
  }

  error(message, duration = 5000) {
    this.show({
      type: 'error',
      message,
      duration,
      icon: '⚠️'
    });
  }

  success(message, duration = 3000) {
    this.show({
      type: 'success',
      message,
      duration,
      icon: '✅'
    });
  }

  show(notification) {
    if (!this.notificationContainer) {
      this.notificationContainer = this.createNotificationContainer();
      this.container.appendChild(this.notificationContainer);
    }

    const notificationElement = this.createNotificationElement(notification);
    this.notificationContainer.appendChild(notificationElement);

    // 自动移除
    setTimeout(() => {
      if (notificationElement.parentNode) {
        notificationElement.parentNode.removeChild(notificationElement);
      }
    }, notification.duration);
  }
}
```

#### 4. **QWebChannel桥接器**
```javascript
// 新增文件: src/frontend/pdf-viewer/qwebchannel-bridge.js
export function initPdfViewerChannel() {
  return new Promise((resolve, reject) => {
    try {
      if (!window.qt || !window.qt.webChannelTransport) {
        return reject(new Error('Qt webChannelTransport not available'));
      }

      const channel = new QWebChannel(window.qt.webChannelTransport, (chan) => {
        const bridge = chan.objects && chan.objects.pdfViewerBridge;
        if (!bridge) return reject(new Error('pdfViewerBridge not found on channel'));

        resolve({ bridge });
      });

      window.__pdfViewerQWebChannel = channel;
    } catch (e) {
      reject(e);
    }
  });
}
```

#### 5. **统一启动流程**
```javascript
// 改造main.js，使其与PDF-Home保持一致
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) 早期console桥接器
    const earlyBridge = createConsoleWebSocketBridge('pdf-viewer', (message) => {
      // 在应用初始化前，暂不发送 console log
    });
    earlyBridge.enable();
    window.__earlyConsoleBridge = earlyBridge;

    // 2) 解析配置
    const configManager = new PDFViewerConfigManager();
    const config = configManager.getConfig();

    // 3) 创建应用实例
    const app = new PDFViewerApp({
      wsUrl: `ws://localhost:${config.wsPort}`,
      config: config
    });

    await app.initialize();

    // 4) 标准化的全局暴露
    window.pdfViewerApp = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app
    };

    const logger = getLogger('pdf-viewer/app');
    logger.info("PDF Viewer App started. Use window.pdfViewerApp.getState() for status.");

  } catch (error) {
    console.error("[DEBUG] App bootstrap/initialization failed:", error);
    const tempLogger = getLogger('pdf-viewer/bootstrap');
    tempLogger.error('Bootstrap failed', error);
  }
});
```

## 约束条件

### 仅修改PDF-Viewer模块代码
仅修改 `src/frontend/pdf-viewer/` 目录下的代码，不可修改其他模块的代码

### 严格遵循向后兼容性
必须保持现有功能的向后兼容，确保：
- PyQt注入的配置仍然有效
- 外部UI组件可用时优先使用
- 现有的事件和API接口不变

### 保持架构一致性
改造后的PDF-Viewer模块应与PDF-Home模块在架构上保持一致：
- 相同的依赖注入模式
- 相同的启动流程
- 相同的配置管理方式

## 可行验收标准

### 单元测试
- 配置管理器的多源配置解析测试
- 内建UI组件的功能测试
- QWebChannel桥接器的连接测试
- 降级机制的有效性测试

### 集成测试

#### 1. **纯净环境测试**
- 在没有PyQt注入的纯浏览器环境下正常启动
- 内建UI组件正常工作
- 配置使用默认值正常运行

#### 2. **PyQt集成测试**
- PyQt注入的配置正确识别和使用
- 外部UI组件可用时正确使用
- QWebChannel桥接正常工作

#### 3. **混合环境测试**
- 部分外部组件可用，部分使用内建组件
- 配置优先级正确处理
- 降级机制平滑切换

### 接口实现

#### 接口1: 配置管理器
**类**: `PDFViewerConfigManager`
**描述**: 统一的配置管理和解析
**方法**:
- `getConfig()`: 获取解析后的配置对象
- `resolveConfig(key, ...sources)`: 多源配置解析
- `validateConfig(config)`: 配置验证

#### 接口2: 内建进度条
**类**: `BuiltInProgressBar`
**描述**: 内建的进度条显示组件
**方法**:
- `show(title, options)`: 显示进度条
- `update(id, percent, text)`: 更新进度
- `hide(id)`: 隐藏进度条

#### 接口3: 内建通知
**类**: `BuiltInNotificationManager`
**描述**: 内建的通知显示组件
**方法**:
- `error(message, duration)`: 显示错误通知
- `success(message, duration)`: 显示成功通知
- `info(message, duration)`: 显示信息通知

### 类实现

#### 类1: UIComponentManager
**类**: `UIComponentManager`
**描述**: 统一管理内建和外部UI组件
**属性**:
- `progressBar`: 进度条实例 (内建或外部)
- `notificationManager`: 通知管理器实例 (内建或外部)
- `hasExternalComponents`: 外部组件可用性标记
**方法**:
- `initialize(container)`: 初始化UI组件
- `getProgressBar()`: 获取进度条实例
- `getNotificationManager()`: 获取通知管理器实例

### 事件规范

#### 事件1: 配置加载完成
**事件类型**: `config:loaded`
**描述**: 配置管理器加载配置完成时触发
**参数**:
- `config`: 解析后的配置对象
- `sources`: 配置来源信息

#### 事件2: UI组件就绪
**事件类型**: `ui:components:ready`
**描述**: 内建UI组件初始化完成时触发
**参数**:
- `components`: 可用组件列表
- `fallbackMode`: 是否使用降级模式

## 实施计划

### 阶段1: 配置管理重构 (1天)
1. 实现PDFViewerConfigManager配置管理器
2. 重构ws-port-resolver使用统一配置
3. 移除对window.PDF_PATH的直接依赖

### 阶段2: 内建UI组件 (1-2天)
1. 实现BuiltInProgressBar组件
2. 实现BuiltInNotificationManager组件
3. 重构ui-progress-error使用内建组件

### 阶段3: QWebChannel集成 (0.5天)
1. 创建qwebchannel-bridge.js
2. 集成到主应用流程
3. 添加错误处理和降级

### 阶段4: 启动流程标准化 (0.5天)
1. 重构main.js启动流程
2. 添加早期console桥接
3. 统一全局变量暴露

### 阶段5: 测试和优化 (1天)
1. 编写单元测试
2. 进行集成测试
3. 性能优化和代码清理

## 预期收益

### 1. **模块独立性**
- 完全自包含，无外部硬依赖
- 可在任何环境下正常运行
- 易于单独测试和部署

### 2. **用户体验统一**
- 内建UI组件保证基础体验
- 外部组件可用时提供增强体验
- 平滑的降级机制

### 3. **架构一致性**
- 与PDF-Home模块架构保持一致
- 统一的开发和维护模式
- 便于团队开发和知识传递

### 4. **可扩展性**
- 标准化的配置机制便于扩展
- 插件化的UI组件架构
- 为未来功能预留接口

## 风险评估

### 技术风险
- **UI组件兼容性**: 内建组件可能与现有样式冲突
- **性能开销**: 额外的组件可能增加内存使用
- **配置复杂度**: 多源配置可能增加调试难度

### 业务风险
- **功能回归**: 重构可能影响现有功能
- **用户体验变化**: UI组件变化可能影响用户习惯

### 缓解措施
- 保持向后兼容，外部组件优先
- 充分的测试覆盖和验证
- 分阶段发布，渐进式改进
- 完善的文档和使用示例