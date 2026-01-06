# PDF-Viewer 架构重构 - 详细实施步骤和代码示例

**所属规格**: 20251002040217-pdf-viewer-architecture-refactoring
**版本**: v002-appendix
**创建时间**: 2025-10-02 12:32:17
**文档类型**: 附录 - 实施指南

---

## 文档说明

本文档是 `v002-spec.md` 的附录，提供详细的实施步骤、脚本和代码示例。

---

## 阶段1: 目录重组脚本

### 1.1 自动化重组脚本

```bash
#!/bin/bash
# reorganize-structure.sh - PDF-Viewer 目录重组脚本

set -e  # 遇到错误立即退出

echo "=== PDF-Viewer 目录重组脚本 ==="
echo "开始时间: $(date)"

# 定义项目根目录
PROJECT_ROOT="src/frontend/pdf-viewer"
cd "$PROJECT_ROOT" || exit 1

echo ""
echo "步骤 1: 创建新目录结构..."

# 创建新目录
mkdir -p core
mkdir -p features/pdf/handlers
mkdir -p features/ui/components
mkdir -p features/ui/handlers
mkdir -p features/bookmark
mkdir -p features/page-transfer
mkdir -p adapters
mkdir -p bootstrap
mkdir -p qt-integration
mkdir -p assets
mkdir -p types

echo "✓ 目录创建完成"

echo ""
echo "步骤 2: 移动核心文件到 core/..."

# 移动核心文件（暂时保留 app-core.js，后续拆分）
if [ -f "app.js" ]; then
  mv app.js core/app.js.old
  echo "✓ app.js → core/app.js.old"
fi

if [ -f "app-core.js" ]; then
  mv app-core.js core/app-core.js.old
  echo "✓ app-core.js → core/app-core.js.old"
fi

echo ""
echo "步骤 3: 移动 PDF 功能模块到 features/pdf/..."

# 移动 pdf/ 目录下的文件
if [ -d "pdf" ]; then
  # 移动主要文件
  [ -f "pdf/pdf-manager-refactored.js" ] && mv pdf/pdf-manager-refactored.js features/pdf/manager.js.temp
  [ -f "pdf/pdf-loader.js" ] && mv pdf/pdf-loader.js features/pdf/loader.js
  [ -f "pdf/pdf-document-manager.js" ] && mv pdf/pdf-document-manager.js features/pdf/document-manager.js
  [ -f "pdf/pdf-cache-manager.js" ] && mv pdf/pdf-cache-manager.js features/pdf/cache-manager.js
  [ -f "pdf/pdf-config.js" ] && mv pdf/pdf-config.js features/pdf/config.js

  # 移动其他文件
  mv pdf/* features/pdf/ 2>/dev/null || true

  # 删除空目录
  rmdir pdf 2>/dev/null || true
  echo "✓ pdf/ → features/pdf/"
fi

echo ""
echo "步骤 4: 移动 UI 功能模块到 features/ui/..."

# 移动 ui/ 目录下的文件
if [ -d "ui" ]; then
  [ -f "ui/ui-manager-core-refactored.js" ] && mv ui/ui-manager-core-refactored.js features/ui/manager.js.temp

  # 移动组件
  [ -f "ui/ui-zoom-controls.js" ] && mv ui/ui-zoom-controls.js features/ui/components/zoom-controls.js
  [ -f "ui/ui-progress-error.js" ] && mv ui/ui-progress-error.js features/ui/components/progress-error.js
  [ -f "ui/ui-layout-controls.js" ] && mv ui/ui-layout-controls.js features/ui/components/layout-controls.js
  [ -f "ui/ui-keyboard-handler.js" ] && mv ui/ui-keyboard-handler.js features/ui/components/keyboard-handler.js
  [ -f "ui/ui-text-layer-manager.js" ] && mv ui/ui-text-layer-manager.js features/ui/components/text-layer-manager.js

  # 移动其他文件
  mv ui/* features/ui/ 2>/dev/null || true

  rmdir ui 2>/dev/null || true
  echo "✓ ui/ → features/ui/"
fi

echo ""
echo "步骤 5: 移动书签模块到 features/bookmark/..."

if [ -d "bookmark" ]; then
  mv bookmark/* features/bookmark/ 2>/dev/null || true
  rmdir bookmark 2>/dev/null || true
  echo "✓ bookmark/ → features/bookmark/"
fi

echo ""
echo "步骤 6: 移动页面传输模块到 features/page-transfer/..."

# 移动页面传输相关文件
[ -f "page-transfer-core.js" ] && mv page-transfer-core.js features/page-transfer/core.js
[ -f "page-transfer-manager.js" ] && mv page-transfer-manager.js features/page-transfer/manager.js
echo "✓ page-transfer-*.js → features/page-transfer/"

echo ""
echo "步骤 7: 移动 Python 文件到 qt-integration/..."

# 移动 Python 文件
[ -f "launcher.py" ] && mv launcher.py qt-integration/launcher.py
[ -f "main_window.py" ] && mv main_window.py qt-integration/main_window.py
[ -f "pdf_viewer_bridge.py" ] && mv pdf_viewer_bridge.py qt-integration/pdf_viewer_bridge.py
[ -f "js_console_logger.py" ] && mv js_console_logger.py qt-integration/js_console_logger.py
[ -f "js_console_logger_qt.py" ] && mv js_console_logger_qt.py qt-integration/js_console_logger_qt.py
echo "✓ *.py → qt-integration/"

echo ""
echo "步骤 8: 移动静态资源到 assets/..."

# 移动静态资源
[ -f "index.html" ] && mv index.html assets/index.html
[ -f "style.css" ] && mv style.css assets/style.css
echo "✓ index.html, style.css → assets/"

echo ""
echo "步骤 9: 删除冗余文件..."

# 删除桥接文件
rm -f pdf-manager.js
rm -f event-handlers.js
rm -f ui-manager.js
rm -f eventbus.js
rm -f websocket-handler.js
echo "✓ 已删除桥接文件和无价值封装"

# 删除备份文件
rm -f ui-manager.js.backup
rm -f *.backup*
rm -f *.temp.html
echo "✓ 已删除备份和临时文件"

# 删除 handlers/ 目录（将在后续步骤拆分到各 feature）
if [ -d "handlers" ]; then
  mkdir -p handlers.backup
  mv handlers/* handlers.backup/ 2>/dev/null || true
  echo "✓ handlers/ 已备份到 handlers.backup/（后续需要拆分）"
fi

echo ""
echo "步骤 10: 创建模块导出文件..."

# 创建 features/pdf/index.js
cat > features/pdf/index.js << 'EOF'
/**
 * PDF 模块公共接口
 * @module features/pdf
 */

export { PDFManager } from './manager.js';
export { PDFLoader } from './loader.js';

// 内部模块不导出
EOF

# 创建 features/ui/index.js
cat > features/ui/index.js << 'EOF'
/**
 * UI 模块公共接口
 * @module features/ui
 */

export { UIManager } from './manager.js';

// 组件不直接导出（内部使用）
EOF

# 创建 features/bookmark/index.js
cat > features/bookmark/index.js << 'EOF'
/**
 * 书签模块公共接口
 * @module features/bookmark
 */

export { BookmarkManager } from './manager.js';
EOF

# 创建 features/page-transfer/index.js
cat > features/page-transfer/index.js << 'EOF'
/**
 * 页面传输模块公共接口
 * @module features/page-transfer
 */

export { PageTransferCore } from './core.js';
export { PageTransferManager } from './manager.js';
EOF

echo "✓ 模块导出文件创建完成"

echo ""
echo "=== 目录重组完成 ==="
echo "完成时间: $(date)"
echo ""
echo "⚠️ 下一步操作:"
echo "1. 运行路径更新脚本: ./update-import-paths.sh"
echo "2. 运行 ESLint 检查: npm run lint"
echo "3. 运行测试: npm run test"
echo "4. 手动检查关键文件的导入路径"
```

### 1.2 路径更新脚本

```bash
#!/bin/bash
# update-import-paths.sh - 更新所有导入路径

set -e

echo "=== 更新导入路径 ==="
echo "开始时间: $(date)"

PROJECT_ROOT="src/frontend/pdf-viewer"
cd "$PROJECT_ROOT" || exit 1

echo ""
echo "步骤 1: 更新 PDF 模块导入路径..."

# 查找所有 JS 文件并替换导入路径
find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./dist/*" -exec sed -i.bak \
  -e "s|from ['\"]\.\/pdf\/pdf-manager-refactored\.js['\"]|from './features/pdf/manager.js'|g" \
  -e "s|from ['\"]\.\.\/pdf\/pdf-manager-refactored\.js['\"]|from '../features/pdf/manager.js'|g" \
  -e "s|from ['\"]\.\/pdf-manager\.js['\"]|from './features/pdf/manager.js'|g" \
  {} \;

echo "✓ PDF 模块路径更新完成"

echo ""
echo "步骤 2: 更新 UI 模块导入路径..."

find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./dist/*" -exec sed -i.bak \
  -e "s|from ['\"]\.\/ui\/ui-manager-core-refactored\.js['\"]|from './features/ui/manager.js'|g" \
  -e "s|from ['\"]\.\.\/ui\/ui-manager-core-refactored\.js['\"]|from '../features/ui/manager.js'|g" \
  -e "s|from ['\"]\.\/ui-manager\.js['\"]|from './features/ui/manager.js'|g" \
  {} \;

echo "✓ UI 模块路径更新完成"

echo ""
echo "步骤 3: 更新 handlers 导入路径..."

find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./dist/*" -exec sed -i.bak \
  -e "s|from ['\"]\.\/handlers\/event-handlers-refactored\.js['\"]|from './handlers/coordinator.js'|g" \
  -e "s|from ['\"]\.\/event-handlers\.js['\"]|from './handlers/coordinator.js'|g" \
  {} \;

echo "✓ Handlers 路径更新完成"

echo ""
echo "步骤 4: 更新 eventbus 导入路径..."

find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./dist/*" -exec sed -i.bak \
  -e "s|from ['\"]\.\/eventbus\.js['\"]|from '../common/event/event-bus.js'|g" \
  -e "s|from ['\"]\.\.\/eventbus\.js['\"]|from '../../common/event/event-bus.js'|g" \
  -e "s|PDFViewerEventBus|EventBus|g" \
  {} \;

echo "✓ EventBus 路径更新完成"

echo ""
echo "步骤 5: 清理备份文件..."

find . -type f -name "*.js.bak" -delete
echo "✓ 备份文件清理完成"

echo ""
echo "=== 路径更新完成 ==="
echo "完成时间: $(date)"
echo ""
echo "⚠️ 下一步操作:"
echo "1. 运行 ESLint: npm run lint"
echo "2. 运行测试: npm run test"
echo "3. 手动检查导入路径是否正确"
```

### 1.3 Windows PowerShell 版本

对于 Windows 用户，提供 PowerShell 脚本：

```powershell
# reorganize-structure.ps1

$PROJECT_ROOT = "src\frontend\pdf-viewer"
Set-Location $PROJECT_ROOT

Write-Host "=== PDF-Viewer 目录重组脚本 ===" -ForegroundColor Green
Write-Host "开始时间: $(Get-Date)" -ForegroundColor Yellow

# 创建目录
Write-Host "`n步骤 1: 创建新目录结构..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path core, features\pdf\handlers, features\ui\components, features\ui\handlers, features\bookmark, features\page-transfer, adapters, bootstrap, qt-integration, assets, types | Out-Null
Write-Host "✓ 目录创建完成" -ForegroundColor Green

# 移动文件
Write-Host "`n步骤 2: 移动核心文件..." -ForegroundColor Cyan
if (Test-Path "app.js") { Move-Item "app.js" "core\app.js.old" -Force }
if (Test-Path "app-core.js") { Move-Item "app-core.js" "core\app-core.js.old" -Force }
Write-Host "✓ 核心文件移动完成" -ForegroundColor Green

# 移动 PDF 模块
Write-Host "`n步骤 3: 移动 PDF 模块..." -ForegroundColor Cyan
if (Test-Path "pdf\pdf-manager-refactored.js") { Move-Item "pdf\pdf-manager-refactored.js" "features\pdf\manager.js.temp" -Force }
if (Test-Path "pdf\pdf-loader.js") { Move-Item "pdf\pdf-loader.js" "features\pdf\loader.js" -Force }
# ... 继续其他移动操作

Write-Host "`n✓ 所有文件移动完成" -ForegroundColor Green

Write-Host "`n=== 目录重组完成 ===" -ForegroundColor Green
```

---

## 阶段2: 创建 BaseEventHandler 基类

### 2.1 BaseEventHandler 实现

```javascript
// core/base-event-handler.js

import { getLogger } from '../common/logger/logger.js';

/**
 * 事件处理器基类
 * 所有功能模块的 handler 都应继承此类
 *
 * @abstract
 * @class BaseEventHandler
 *
 * @example
 * class PDFEventHandler extends BaseEventHandler {
 *   constructor(pdfManager, eventBus) {
 *     super(pdfManager, eventBus, 'PDFEventHandler');
 *   }
 *
 *   setup() {
 *     this._on(PDF_EVENTS.FILE.LOAD.REQUESTED, this.handleLoadRequest);
 *   }
 *
 *   handleLoadRequest = async (data) => {
 *     // 处理逻辑
 *   }
 * }
 */
export class BaseEventHandler {
  /** @type {import('../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {Array<{event: string, unsubscribe: Function}>} */
  #listeners = [];

  /**
   * @param {Object} context - 上下文对象（通常是功能模块的 manager）
   * @param {import('../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
   * @param {string} [name] - Handler 名称（用于日志）
   */
  constructor(context, eventBus, name) {
    if (new.target === BaseEventHandler) {
      throw new Error('BaseEventHandler is abstract and cannot be instantiated directly');
    }

    this.context = context;
    this.#eventBus = eventBus;
    this.#logger = getLogger(name || this.constructor.name);

    this.#logger.debug(`${name || this.constructor.name} created`);
  }

  /**
   * 设置事件监听
   * 子类必须实现此方法
   *
   * @abstract
   * @throws {Error} 如果子类未实现
   */
  setup() {
    throw new Error(`${this.constructor.name} must implement setup() method`);
  }

  /**
   * 注册事件监听（带自动清理和错误捕获）
   *
   * @protected
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} [options={}] - 选项
   * @param {boolean} [options.once=false] - 是否只监听一次
   * @param {number} [options.priority=0] - 优先级
   * @returns {Function} 取消订阅函数
   *
   * @example
   * this._on(PDF_EVENTS.FILE.LOADED, this.handleFileLoaded, { once: true });
   */
  _on(event, callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    // 包装回调函数以捕获异常
    const wrappedCallback = (...args) => {
      try {
        const result = callback.apply(this, args);

        // 如果返回 Promise，捕获 rejection
        if (result instanceof Promise) {
          result.catch((error) => {
            this.#logger.error(`Async error in ${event} handler:`, error);
          });
        }

        return result;
      } catch (error) {
        this.#logger.error(`Error in ${event} handler:`, error);
        // 不重新抛出错误，避免中断其他监听器
      }
    };

    // 注册监听
    const unsubscribe = this.#eventBus.on(event, wrappedCallback, options);

    // 记录以便清理
    this.#listeners.push({ event, unsubscribe });

    this.#logger.debug(`Registered listener for: ${event}`);

    return unsubscribe;
  }

  /**
   * 发射事件
   *
   * @protected
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   *
   * @example
   * this._emit(PDF_EVENTS.FILE.LOADED, { document, totalPages });
   */
  _emit(event, data) {
    this.#logger.debug(`Emitting event: ${event}`, data);
    this.#eventBus.emit(event, data);
  }

  /**
   * 清理所有监听器
   *
   * @example
   * pdfHandler.destroy();
   */
  destroy() {
    this.#logger.debug(`Destroying ${this.constructor.name}, cleaning up ${this.#listeners.length} listeners`);

    this.#listeners.forEach(({ event, unsubscribe }) => {
      try {
        unsubscribe();
        this.#logger.debug(`Unsubscribed from: ${event}`);
      } catch (error) {
        this.#logger.error(`Error unsubscribing from ${event}:`, error);
      }
    });

    this.#listeners = [];
    this.#logger.debug(`${this.constructor.name} destroyed`);
  }

  /**
   * 获取已注册的监听器数量
   *
   * @returns {number}
   */
  getListenerCount() {
    return this.#listeners.length;
  }

  /**
   * 获取已注册的事件列表
   *
   * @returns {string[]}
   */
  getRegisteredEvents() {
    return this.#listeners.map(({ event }) => event);
  }
}
```

### 2.2 PDF 模块 Handler 实现

```javascript
// features/pdf/handlers/pdf-event-handler.js

import { BaseEventHandler } from '../../../core/base-event-handler.js';
import { PDF_EVENTS } from '../../../common/event/constants.js';

/**
 * @typedef {import('../../../types/events').PDFLoadRequestData} PDFLoadRequestData
 * @typedef {import('../../../types/events').PDFLoadedData} PDFLoadedData
 * @typedef {import('../../../types/events').PDFLoadFailedData} PDFLoadFailedData
 */

/**
 * PDF 模块事件处理器
 * 负责处理 PDF 相关的所有事件
 *
 * @class PDFEventHandler
 * @extends {BaseEventHandler}
 */
export class PDFEventHandler extends BaseEventHandler {
  /**
   * @param {import('../manager.js').PDFManager} pdfManager - PDF管理器实例
   * @param {import('../../../common/event/event-bus.js').EventBus} eventBus - 事件总线
   */
  constructor(pdfManager, eventBus) {
    super(pdfManager, eventBus, 'PDFEventHandler');
  }

  /**
   * 设置事件监听
   * @override
   */
  setup() {
    // 📥 监听事件: pdf:file:load:requested
    // 数据格式: PDFLoadRequestData
    // 发射者: adapters/websocket-adapter, features/ui
    // 作用: 加载 PDF 文件
    this._on(PDF_EVENTS.FILE.LOAD.REQUESTED, this.handleLoadRequest);

    // 📥 监听事件: pdf:page:navigate
    // 数据格式: { pageNumber: number }
    // 发射者: features/ui
    // 作用: 导航到指定页码
    this._on(PDF_EVENTS.PAGE.NAVIGATE, this.handlePageNavigate);

    // 📥 监听事件: pdf:zoom:change
    // 数据格式: { level: number }
    // 发射者: features/ui
    // 作用: 改变缩放级别
    this._on(PDF_EVENTS.ZOOM.CHANGE, this.handleZoomChange);
  }

  /**
   * 处理 PDF 加载请求
   *
   * @private
   * @param {PDFLoadRequestData} data - 加载请求数据
   */
  handleLoadRequest = async ({ filePath, initialPage, zoom }) => {
    try {
      // 调用 PDFManager 加载文件
      const pdfDoc = await this.context.loadPDF(filePath);

      // 📤 发射事件: pdf:file:loaded
      // 数据格式: PDFLoadedData
      // 监听者: features/ui (更新UI), adapters/websocket-adapter (通知后端)
      this._emit(PDF_EVENTS.FILE.LOADED, {
        document: pdfDoc,
        filePath,
        totalPages: pdfDoc.numPages,
        metadata: await pdfDoc.getMetadata().catch(() => null),
      });

      // 如果指定了初始页码，导航到该页
      if (initialPage) {
        this._emit(PDF_EVENTS.PAGE.NAVIGATE, { pageNumber: initialPage });
      }

      // 如果指定了缩放级别，设置缩放
      if (zoom) {
        this._emit(PDF_EVENTS.ZOOM.CHANGE, { level: zoom });
      }

    } catch (error) {
      // 📤 发射事件: pdf:file:load:failed
      // 数据格式: PDFLoadFailedData
      // 监听者: features/ui (显示错误)
      this._emit(PDF_EVENTS.FILE.LOAD_FAILED, {
        filePath,
        error,
        message: error.message || 'Failed to load PDF',
      });
    }
  }

  /**
   * 处理页面导航
   *
   * @private
   * @param {{ pageNumber: number }} data - 页码数据
   */
  handlePageNavigate = ({ pageNumber }) => {
    // 调用 PDFManager 设置当前页
    this.context.setCurrentPage(pageNumber);

    // 📤 发射事件: pdf:page:changed
    // 监听者: features/ui (更新页码显示), adapters/websocket-adapter
    this._emit(PDF_EVENTS.PAGE.CHANGED, {
      pageNumber,
      totalPages: this.context.getTotalPages(),
    });
  }

  /**
   * 处理缩放变更
   *
   * @private
   * @param {{ level: number }} data - 缩放级别
   */
  handleZoomChange = ({ level }) => {
    // 调用 PDFManager 设置缩放级别
    this.context.setZoomLevel(level);

    // 📤 发射事件: pdf:zoom:changed
    // 监听者: features/ui (更新缩放显示)
    this._emit(PDF_EVENTS.ZOOM.CHANGED, { level });
  }
}
```

### 2.3 PDF Manager 使用 Handler

```javascript
// features/pdf/manager.js

import { PDFEventHandler } from './handlers/pdf-event-handler.js';
import { PDFLoader } from './loader.js';
import { getLogger } from '../../common/logger/logger.js';
import { globalEventBus } from '../../common/event/event-bus.js';

/**
 * @typedef {import('../../types/pdf').IPDFManager} IPDFManager
 */

/**
 * PDF 管理器
 * 负责 PDF 文档的加载、状态管理等核心功能
 *
 * @implements {IPDFManager}
 */
export class PDFManager {
  /** @type {import('../../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {PDFEventHandler} */
  #handler;

  /** @type {PDFLoader} */
  #loader;

  /** @type {number} */
  #currentPage = 1;

  /** @type {number} */
  #totalPages = 0;

  /** @type {number} */
  #zoomLevel = 1.0;

  /** @type {PDFDocumentProxy|null} */
  #currentDocument = null;

  constructor() {
    this.#logger = getLogger('PDFManager');
    this.#eventBus = globalEventBus;
    this.#loader = new PDFLoader();

    // 创建 Handler
    this.#handler = new PDFEventHandler(this, this.#eventBus);
  }

  /**
   * 初始化 PDF 管理器
   */
  async initialize() {
    this.#logger.info('Initializing PDFManager');

    // 设置事件监听
    this.#handler.setup();

    this.#logger.info('PDFManager initialized');
  }

  /**
   * 加载 PDF 文件
   *
   * @param {string} filePath - 文件路径
   * @returns {Promise<PDFDocumentProxy>}
   */
  async loadPDF(filePath) {
    this.#logger.info(`Loading PDF: ${filePath}`);

    const doc = await this.#loader.load(filePath);

    this.#currentDocument = doc;
    this.#totalPages = doc.numPages;
    this.#currentPage = 1;

    this.#logger.info(`PDF loaded: ${filePath}, total pages: ${doc.numPages}`);

    return doc;
  }

  /**
   * 设置当前页码
   *
   * @param {number} pageNumber - 页码（从1开始）
   */
  setCurrentPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > this.#totalPages) {
      this.#logger.warn(`Invalid page number: ${pageNumber}`);
      return;
    }

    this.#currentPage = pageNumber;
    this.#logger.debug(`Current page set to: ${pageNumber}`);
  }

  /**
   * 获取当前页码
   *
   * @returns {number}
   */
  getCurrentPage() {
    return this.#currentPage;
  }

  /**
   * 获取总页数
   *
   * @returns {number}
   */
  getTotalPages() {
    return this.#totalPages;
  }

  /**
   * 设置缩放级别
   *
   * @param {number} level - 缩放级别
   */
  setZoomLevel(level) {
    this.#zoomLevel = level;
    this.#logger.debug(`Zoom level set to: ${level}`);
  }

  /**
   * 获取缩放级别
   *
   * @returns {number}
   */
  getZoomLevel() {
    return this.#zoomLevel;
  }

  /**
   * 销毁 PDF 管理器
   */
  destroy() {
    this.#logger.info('Destroying PDFManager');

    // 清理 Handler
    this.#handler.destroy();

    // 清理文档
    this.#currentDocument = null;

    this.#logger.info('PDFManager destroyed');
  }
}
```

---

## 阶段3: 拆分 app-core.js

### 3.1 AppCoordinator 实现

```javascript
// core/coordinator.js

import { getLogger } from '../common/logger/logger.js';

/**
 * 应用协调器
 * 负责协调各功能模块的初始化和生命周期
 *
 * @class AppCoordinator
 */
export class AppCoordinator {
  /** @type {import('../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../container/app-container.js').PDFViewerContainer} */
  #container;

  /** @type {import('../features/pdf/manager.js').PDFManager} */
  #pdfManager;

  /** @type {import('../features/ui/manager.js').UIManager} */
  #uiManager;

  /** @type {import('../features/bookmark/manager.js').BookmarkManager} */
  #bookmarkManager;

  /**
   * @param {import('../container/app-container.js').PDFViewerContainer} container - 依赖注入容器
   */
  constructor(container) {
    this.#logger = getLogger('AppCoordinator');
    this.#container = container;

    // 获取各模块实例
    this.#pdfManager = container.getPDFManager();
    this.#uiManager = container.getUIManager();
    this.#bookmarkManager = container.getBookmarkManager();
  }

  /**
   * 初始化所有模块
   */
  async initialize() {
    this.#logger.info('Initializing all modules...');

    try {
      // 按顺序初始化各模块
      await this.#pdfManager.initialize();
      this.#logger.debug('✓ PDFManager initialized');

      await this.#uiManager.initialize();
      this.#logger.debug('✓ UIManager initialized');

      await this.#bookmarkManager.initialize();
      this.#logger.debug('✓ BookmarkManager initialized');

      this.#logger.info('All modules initialized successfully');

    } catch (error) {
      this.#logger.error('Module initialization failed:', error);
      throw error;
    }
  }

  /**
   * 销毁所有模块
   */
  destroy() {
    this.#logger.info('Destroying all modules...');

    try {
      this.#bookmarkManager.destroy();
      this.#uiManager.destroy();
      this.#pdfManager.destroy();

      this.#logger.info('All modules destroyed');

    } catch (error) {
      this.#logger.error('Module destruction failed:', error);
    }
  }

  /**
   * 获取事件总线
   *
   * @returns {import('../common/event/event-bus.js').EventBus}
   */
  getEventBus() {
    return this.#container.getEventBus();
  }

  /**
   * 获取 PDF 管理器
   *
   * @returns {import('../features/pdf/manager.js').PDFManager}
   */
  getPDFManager() {
    return this.#pdfManager;
  }

  /**
   * 获取 UI 管理器
   *
   * @returns {import('../features/ui/manager.js').UIManager}
   */
  getUIManager() {
    return this.#uiManager;
  }
}
```

### 3.2 StateManager 实现

```javascript
// core/state-manager.js

import { getLogger } from '../common/logger/logger.js';
import { globalEventBus } from '../common/event/event-bus.js';
import { APP_EVENTS } from '../common/event/constants.js';

/**
 * 应用状态管理器
 * 负责管理应用的全局状态
 *
 * @class StateManager
 */
export class StateManager {
  /** @type {import('../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {boolean} */
  #initialized = false;

  /** @type {string|null} */
  #currentFile = null;

  /** @type {number} */
  #currentPage = 1;

  /** @type {number} */
  #totalPages = 0;

  /** @type {number} */
  #zoomLevel = 1.0;

  constructor() {
    this.#logger = getLogger('StateManager');
    this.#eventBus = globalEventBus;
  }

  /**
   * 获取完整状态快照
   *
   * @returns {Object}
   */
  getState() {
    return {
      initialized: this.#initialized,
      currentFile: this.#currentFile,
      currentPage: this.#currentPage,
      totalPages: this.#totalPages,
      zoomLevel: this.#zoomLevel,
    };
  }

  /**
   * 设置初始化状态
   *
   * @param {boolean} value
   */
  setInitialized(value) {
    const oldValue = this.#initialized;
    this.#initialized = value;

    if (oldValue !== value) {
      this.#emitStateChange('initialized', oldValue, value);
    }
  }

  /**
   * 获取初始化状态
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * 设置当前文件
   *
   * @param {string|null} filePath
   */
  setCurrentFile(filePath) {
    const oldValue = this.#currentFile;
    this.#currentFile = filePath;

    if (oldValue !== filePath) {
      this.#emitStateChange('currentFile', oldValue, filePath);
    }
  }

  /**
   * 获取当前文件
   *
   * @returns {string|null}
   */
  getCurrentFile() {
    return this.#currentFile;
  }

  /**
   * 设置当前页码
   *
   * @param {number} pageNumber
   */
  setCurrentPage(pageNumber) {
    const oldValue = this.#currentPage;
    this.#currentPage = pageNumber;

    if (oldValue !== pageNumber) {
      this.#emitStateChange('currentPage', oldValue, pageNumber);
    }
  }

  /**
   * 设置总页数
   *
   * @param {number} totalPages
   */
  setTotalPages(totalPages) {
    this.#totalPages = totalPages;
  }

  /**
   * 设置缩放级别
   *
   * @param {number} level
   */
  setZoomLevel(level) {
    const oldValue = this.#zoomLevel;
    this.#zoomLevel = level;

    if (oldValue !== level) {
      this.#emitStateChange('zoomLevel', oldValue, level);
    }
  }

  /**
   * 发射状态变更事件
   *
   * @private
   * @param {string} field - 变更的字段
   * @param {*} oldValue - 旧值
   * @param {*} newValue - 新值
   */
  #emitStateChange(field, oldValue, newValue) {
    this.#logger.debug(`State changed: ${field}`, { oldValue, newValue });

    this.#eventBus.emit(APP_EVENTS.STATE.CHANGED, {
      field,
      oldValue,
      newValue,
      state: this.getState(),
    });
  }
}
```

### 3.3 LifecycleManager 实现

```javascript
// core/lifecycle-manager.js

import { getLogger } from '../common/logger/logger.js';

/**
 * 生命周期管理器
 * 负责管理应用的生命周期，包括全局错误处理等
 *
 * @class LifecycleManager
 */
export class LifecycleManager {
  /** @type {import('../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../common/event/event-bus.js').EventBus} */
  #eventBus;

  constructor(eventBus) {
    this.#logger = getLogger('LifecycleManager');
    this.#eventBus = eventBus;
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    this.#logger.info('Setting up global error handling');

    // 捕获未处理的 Promise rejection
    window.addEventListener('unhandledrejection', this.#handleUnhandledRejection);

    // 捕获全局错误
    window.addEventListener('error', this.#handleGlobalError);

    this.#logger.debug('Global error handlers registered');
  }

  /**
   * 处理未捕获的 Promise rejection
   *
   * @private
   * @param {PromiseRejectionEvent} event
   */
  #handleUnhandledRejection = (event) => {
    this.#logger.error('Unhandled Promise Rejection:', {
      reason: event.reason,
      promise: event.promise,
    });

    // 可以在这里发射错误事件，供 UI 显示
    this.#eventBus.emit('app:error:unhandled-rejection', {
      reason: event.reason,
      message: event.reason?.message || 'Unhandled promise rejection',
    });

    // 阻止默认行为（控制台错误）
    // event.preventDefault();
  }

  /**
   * 处理全局错误
   *
   * @private
   * @param {ErrorEvent} event
   */
  #handleGlobalError = (event) => {
    this.#logger.error('Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });

    // 发射错误事件
    this.#eventBus.emit('app:error:global', {
      message: event.message,
      error: event.error,
    });
  }

  /**
   * 处理初始化完成后的消息队列
   *
   * @param {Array} messageQueue - 消息队列
   * @param {Function} handleMessage - 消息处理函数
   */
  onInitialized(messageQueue, handleMessage) {
    if (messageQueue.length > 0) {
      this.#logger.info(`Processing ${messageQueue.length} queued messages`);

      messageQueue.forEach((message) => {
        try {
          handleMessage(message);
        } catch (error) {
          this.#logger.error('Error processing queued message:', error, message);
        }
      });

      // 清空队列
      messageQueue.length = 0;
    }
  }

  /**
   * 清理全局错误处理
   */
  cleanup() {
    this.#logger.info('Cleaning up global error handlers');

    window.removeEventListener('unhandledrejection', this.#handleUnhandledRejection);
    window.removeEventListener('error', this.#handleGlobalError);
  }
}
```

### 3.4 WebSocketAdapter 实现

```javascript
// adapters/websocket-adapter.js

import { getLogger } from '../common/logger/logger.js';
import { globalEventBus } from '../common/event/event-bus.js';
import { PDF_EVENTS, WS_EVENTS } from '../common/event/constants.js';

/**
 * WebSocket 适配器
 * 负责将 WebSocket 消息转换为应用内部事件
 *
 * @class WebSocketAdapter
 */
export class WebSocketAdapter {
  /** @type {import('../common/logger/logger.js').Logger} */
  #logger;

  /** @type {import('../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {import('../common/websocket/websocket-client.js').WebSocketClient} */
  #wsClient;

  /** @type {boolean} */
  #initialized = false;

  /** @type {Array} */
  #messageQueue = [];

  /**
   * @param {import('../common/websocket/websocket-client.js').WebSocketClient} wsClient
   */
  constructor(wsClient) {
    this.#logger = getLogger('WebSocketAdapter');
    this.#eventBus = globalEventBus;
    this.#wsClient = wsClient;
  }

  /**
   * 设置消息处理器
   */
  setupMessageHandlers() {
    this.#logger.info('Setting up WebSocket message handlers');

    // 监听 WebSocket 消息
    this.#wsClient.onMessage((message) => {
      this.handleMessage(message);
    });

    // 监听内部事件，转发到 WebSocket
    this.#setupEventToWSBridge();

    this.#logger.debug('WebSocket message handlers setup complete');
  }

  /**
   * 处理 WebSocket 消息
   *
   * @param {Object} message - WebSocket 消息
   */
  handleMessage(message) {
    if (!this.#initialized) {
      // 如果还未初始化，将消息加入队列
      this.#messageQueue.push(message);
      this.#logger.debug('Message queued (not initialized yet):', message.type);
      return;
    }

    this.#routeMessage(message);
  }

  /**
   * 路由消息到对应的处理方法
   *
   * @private
   * @param {Object} message
   */
  #routeMessage(message) {
    const { type, data } = message;

    this.#logger.debug(`Routing WebSocket message: ${type}`, data);

    switch (type) {
      case 'load_pdf_file':
        this.#handleLoadPdfFile(data);
        break;

      case 'navigate_page':
        this.#handleNavigatePage(data);
        break;

      case 'set_zoom':
        this.#handleSetZoom(data);
        break;

      default:
        this.#logger.warn(`Unhandled WebSocket message type: ${type}`);
    }
  }

  /**
   * 处理加载 PDF 文件消息
   *
   * @private
   * @param {Object} data
   */
  #handleLoadPdfFile(data) {
    const { file_path, initial_page, zoom } = data;

    // 📤 发射事件: pdf:file:load:requested
    // 监听者: features/pdf
    this.#eventBus.emit(PDF_EVENTS.FILE.LOAD.REQUESTED, {
      filePath: file_path,
      initialPage: initial_page,
      zoom,
    });
  }

  /**
   * 处理页面导航消息
   *
   * @private
   * @param {Object} data
   */
  #handleNavigatePage(data) {
    const { page_number } = data;

    // 📤 发射事件: pdf:page:navigate
    this.#eventBus.emit(PDF_EVENTS.PAGE.NAVIGATE, {
      pageNumber: page_number,
    });
  }

  /**
   * 处理设置缩放消息
   *
   * @private
   * @param {Object} data
   */
  #handleSetZoom(data) {
    const { level } = data;

    // 📤 发射事件: pdf:zoom:change
    this.#eventBus.emit(PDF_EVENTS.ZOOM.CHANGE, {
      level,
    });
  }

  /**
   * 设置事件到 WebSocket 的桥接
   * 监听内部事件，转发到 WebSocket
   *
   * @private
   */
  #setupEventToWSBridge() {
    // 📥 监听事件: pdf:file:loaded
    // 发射者: features/pdf
    // 作用: 通知后端 PDF 加载完成
    this.#eventBus.on(PDF_EVENTS.FILE.LOADED, ({ filePath, totalPages }) => {
      this.#wsClient.send({
        type: 'pdf_loaded',
        data: {
          file_path: filePath,
          total_pages: totalPages,
        },
      });
    });

    // 📥 监听事件: pdf:page:changed
    // 发射者: features/pdf
    // 作用: 通知后端页码变更
    this.#eventBus.on(PDF_EVENTS.PAGE.CHANGED, ({ pageNumber }) => {
      this.#wsClient.send({
        type: 'page_changed',
        data: {
          page_number: pageNumber,
        },
      });
    });
  }

  /**
   * 标记为已初始化，处理队列中的消息
   */
  onInitialized() {
    this.#initialized = true;

    if (this.#messageQueue.length > 0) {
      this.#logger.info(`Processing ${this.#messageQueue.length} queued messages`);

      this.#messageQueue.forEach((message) => {
        this.#routeMessage(message);
      });

      this.#messageQueue = [];
    }
  }
}
```

---

## 阶段4: 组合模式重构

### 4.1 应用启动器（Bootstrap）

```javascript
// bootstrap/app-bootstrap.js

import { createPDFViewerContainer } from '../container/app-container.js';
import { AppCoordinator } from '../core/coordinator.js';
import { StateManager } from '../core/state-manager.js';
import { LifecycleManager } from '../core/lifecycle-manager.js';
import { WebSocketAdapter } from '../adapters/websocket-adapter.js';
import { getLogger } from '../common/logger/logger.js';

/**
 * PDF Viewer 应用启动器
 * 负责组装所有组件并启动应用
 *
 * @param {Object} options - 启动选项
 * @param {Object} [options.container] - 自定义容器（可选）
 * @param {Object} [options.wsClient] - WebSocket客户端（可选）
 * @returns {Promise<Object>} 应用实例
 */
export async function bootstrap(options = {}) {
  const logger = getLogger('AppBootstrap');

  logger.info('Starting PDF Viewer application...');

  try {
    // 1. 创建或使用提供的容器
    const container = options.container || createPDFViewerContainer(options);
    logger.debug('✓ Container created');

    // 2. 获取基础依赖
    const eventBus = container.getEventBus();
    const wsClient = container.getWebSocketClient();

    // 3. 创建核心管理器（组合）
    const stateManager = new StateManager();
    const lifecycleManager = new LifecycleManager(eventBus);
    const coordinator = new AppCoordinator(container);
    const wsAdapter = new WebSocketAdapter(wsClient);

    logger.debug('✓ Core managers created');

    // 4. 设置生命周期
    lifecycleManager.setupGlobalErrorHandling();
    logger.debug('✓ Global error handling setup');

    // 5. 初始化容器
    if (!container.isInitialized()) {
      await container.initialize();
      logger.debug('✓ Container initialized');
    }

    // 6. 连接 WebSocket
    container.connect();
    logger.debug('✓ WebSocket connected');

    // 7. 设置 WebSocket 适配器
    wsAdapter.setupMessageHandlers();
    logger.debug('✓ WebSocket adapter setup');

    // 8. 初始化协调器（会初始化所有 feature）
    await coordinator.initialize();
    logger.debug('✓ Coordinator initialized');

    // 9. 标记状态为已初始化
    stateManager.setInitialized(true);
    wsAdapter.onInitialized();
    logger.debug('✓ Application marked as initialized');

    logger.info('PDF Viewer application started successfully');

    // 返回应用实例
    return {
      coordinator,
      stateManager,
      lifecycleManager,
      wsAdapter,
      container,

      // 便捷方法
      getState: () => stateManager.getState(),
      getEventBus: () => eventBus,
      destroy: () => {
        coordinator.destroy();
        lifecycleManager.cleanup();
        container.dispose();
        logger.info('Application destroyed');
      },
    };

  } catch (error) {
    logger.error('Application bootstrap failed:', error);
    throw error;
  }
}
```

### 4.2 主入口文件

```javascript
// main.js

import { bootstrap } from './bootstrap/app-bootstrap.js';
import { getLogger } from './common/logger/logger.js';

const logger = getLogger('Main');

/**
 * 应用主入口
 */
async function main() {
  try {
    logger.info('PDF Viewer starting...');

    // 启动应用
    const app = await bootstrap({
      // 可以在这里传入自定义选项
      // wsClient: customWSClient,
      // container: customContainer,
    });

    // 将应用实例挂载到全局（用于调试和外部调用）
    window.pdfViewerApp = app;

    logger.info('PDF Viewer ready');

  } catch (error) {
    logger.error('Failed to start PDF Viewer:', error);

    // 显示友好的错误提示
    document.body.innerHTML = `
      <div style="padding: 20px; color: #d32f2f; font-family: sans-serif;">
        <h2>应用启动失败</h2>
        <p>${error.message}</p>
        <p>请刷新页面重试或联系技术支持。</p>
      </div>
    `;
  }
}

// 等待 DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
```

---

## 阶段5: 类型定义创建

### 5.1 通用类型定义

```typescript
// types/common.d.ts

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志器接口
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * 事件选项
 */
export interface EventOptions {
  /** 是否只监听一次 */
  once?: boolean;
  /** 优先级（数字越大优先级越高） */
  priority?: number;
}

/**
 * 事件总线接口
 */
export interface EventBus {
  /**
   * 监听事件
   */
  on<T = any>(
    event: string,
    callback: (data: T) => void,
    options?: EventOptions
  ): () => void;

  /**
   * 发射事件
   */
  emit<T = any>(event: string, data: T): void;

  /**
   * 取消监听
   */
  off(event: string, callback?: Function): void;

  /**
   * 监听一次
   */
  once<T = any>(event: string, callback: (data: T) => void): () => void;
}
```

### 5.2 事件类型定义

```typescript
// types/events.d.ts

import { EventBus } from './common';

/**
 * PDF 文件加载请求事件数据
 * @event pdf:file:load:requested
 */
export interface PDFLoadRequestData {
  /** 文件路径 */
  filePath: string;
  /** 初始页码（可选，默认为 1） */
  initialPage?: number;
  /** 缩放级别（可选，默认为 1.0） */
  zoom?: number;
}

/**
 * PDF 文件加载成功事件数据
 * @event pdf:file:loaded
 */
export interface PDFLoadedData {
  /** PDF 文档对象 */
  document: PDFDocumentProxy;
  /** 文件路径 */
  filePath: string;
  /** 总页数 */
  totalPages: number;
  /** 文件元数据（可选） */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creationDate?: string;
    modDate?: string;
  };
}

/**
 * PDF 文件加载失败事件数据
 * @event pdf:file:load:failed
 */
export interface PDFLoadFailedData {
  /** 文件路径 */
  filePath: string;
  /** 错误对象 */
  error: Error;
  /** 错误消息 */
  message: string;
}

/**
 * 页面变更事件数据
 * @event pdf:page:changed
 */
export interface PDFPageChangedData {
  /** 当前页码 */
  pageNumber: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 缩放变更事件数据
 * @event pdf:zoom:changed
 */
export interface PDFZoomChangedData {
  /** 缩放级别 */
  level: number;
}

/**
 * 应用状态变更事件数据
 * @event app:state:changed
 */
export interface AppStateChangedData {
  /** 变更的字段名 */
  field: string;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 完整状态 */
  state: {
    initialized: boolean;
    currentFile: string | null;
    currentPage: number;
    totalPages: number;
    zoomLevel: number;
  };
}
```

### 5.3 PDF 模块类型定义

```typescript
// types/pdf.d.ts

import { EventBus } from './common';
import { PDFLoadRequestData, PDFLoadedData } from './events';

/**
 * PDF 管理器接口
 */
export interface IPDFManager {
  /**
   * 初始化 PDF 管理器
   */
  initialize(): Promise<void>;

  /**
   * 加载 PDF 文件
   * @param filePath - 文件路径
   * @returns PDF 文档对象
   */
  loadPDF(filePath: string): Promise<PDFDocumentProxy>;

  /**
   * 获取当前页码
   */
  getCurrentPage(): number;

  /**
   * 设置当前页码
   * @param pageNumber - 页码（从1开始）
   */
  setCurrentPage(pageNumber: number): void;

  /**
   * 获取总页数
   */
  getTotalPages(): number;

  /**
   * 设置缩放级别
   * @param level - 缩放级别
   */
  setZoomLevel(level: number): void;

  /**
   * 获取缩放级别
   */
  getZoomLevel(): number;

  /**
   * 销毁 PDF 管理器
   */
  destroy(): void;
}

/**
 * PDF 加载器接口
 */
export interface IPDFLoader {
  /**
   * 加载 PDF 文档
   * @param url - PDF 文件 URL
   * @param options - 加载选项
   */
  load(url: string, options?: LoadOptions): Promise<PDFDocumentProxy>;

  /**
   * 取消加载
   */
  cancel(): void;
}

/**
 * PDF 加载选项
 */
export interface LoadOptions {
  /** CMap URL */
  cMapUrl?: string;
  /** CMap 是否打包 */
  cMapPacked?: boolean;
  /** 是否携带凭证 */
  withCredentials?: boolean;
  /** 最大图片大小 */
  maxImageSize?: number;
}

/**
 * PDF.js 文档代理对象（简化）
 */
export interface PDFDocumentProxy {
  /** 总页数 */
  numPages: number;

  /**
   * 获取页面
   * @param pageNumber - 页码（从1开始）
   */
  getPage(pageNumber: number): Promise<PDFPageProxy>;

  /**
   * 获取元数据
   */
  getMetadata(): Promise<{ info: any; metadata: any }>;

  /**
   * 销毁文档
   */
  destroy(): Promise<void>;
}

/**
 * PDF.js 页面代理对象（简化）
 */
export interface PDFPageProxy {
  /** 页码 */
  pageNumber: number;

  /**
   * 渲染页面
   */
  render(params: any): { promise: Promise<void>; cancel: () => void };

  /**
   * 获取文本内容
   */
  getTextContent(): Promise<any>;
}
```

---

**文档版本**: v002-appendix-implementation
**最后更新**: 2025-10-02 12:32:17
**维护者**: 核心团队

---

## 后续步骤

继续查看：
- `v002-appendix-testing.md` - 详细的测试清单和验收标准
