/**
 * 截图工具插件
 * @implements {IAnnotationTool}
 *
 * 功能:
 * - 允许用户框选PDF区域进行截图
 * - 通过QWebChannel保存图片到PyQt端
 * - 创建截图标注并添加到侧边栏
 */
import { IAnnotationTool } from '../../interfaces/IAnnotationTool.js';
import { ScreenshotCapturer } from './screenshot-capturer.js';
import { QWebChannelScreenshotBridge } from './qwebchannel-bridge.js';
import { AnnotationType } from '../../models/annotation.js';
import { getLogger } from '../../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

const MARKER_COLOR_PRESETS = [
  { name: 'orange', label: '橙色', value: '#ff9800' },
  { name: 'teal', label: '青色', value: '#26a69a' },
  { name: 'blue', label: '蓝色', value: '#2196f3' },
  { name: 'purple', label: '紫色', value: '#ab47bc' }
];

const DEFAULT_MARKER_COLOR = MARKER_COLOR_PRESETS[0].value;


export class ScreenshotTool extends IAnnotationTool {
  // ===== 元数据 (getter方法) =====
  get name() { return 'screenshot'; }
  get displayName() { return '截图'; }
  get icon() { return '📷'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['pdfViewerManager', 'eventBus', 'logger']; }

  // ===== 私有字段 =====
  #eventBus;
  #logger;
  #pdfViewerManager;
  #qwebChannelBridge;
  #capturer;
  #isActive = false;
  #selectionOverlay = null;
  #startPos = null;
  #endPos = null;
  #mouseListeners = null;
  #renderedMarkers = new Map();  // 存储已渲染的截图标记框 (annotationId -> markerElement)

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @param {Object} context.eventBus - 事件总线
   * @param {Object} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   */
  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger || getLogger('ScreenshotTool');
    this.#pdfViewerManager = context.pdfViewerManager;

    // 初始化截图捕获器
    this.#capturer = new ScreenshotCapturer(this.#pdfViewerManager);

    // 初始化QWebChannel桥接器
    this.#qwebChannelBridge = new QWebChannelScreenshotBridge();

    // 监听标注跳转成功事件，用于渲染截图标记框
    this.#setupJumpEventListener();

    this.#logger.info('[ScreenshotTool] Initialized', {
      qwebChannelMode: this.#qwebChannelBridge.getMode()
    });
  }

  /**
   * 激活截图模式
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn('[ScreenshotTool] Already active');
      return;
    }

    this.#isActive = true;

    // 1. 创建选择遮罩层
    this.#createSelectionOverlay();

    // 2. 设置鼠标事件
    this.#setupMouseEvents();

    // 3. 改变鼠标样式
    document.body.style.cursor = 'crosshair';

    // 4. 发布激活事件
    this.#eventBus.emit('annotation-tool:activate:success', {
      tool: this.name
    });

    this.#logger.info('[ScreenshotTool] Activated');
  }

  /**
   * 停用截图模式
   */
  deactivate() {
    if (!this.#isActive) return;

    this.#cleanup();
    this.#isActive = false;
    document.body.style.cursor = 'default';

    this.#eventBus.emit('annotation-tool:deactivate:success', {
      tool: this.name
    });

    this.#logger.info('[ScreenshotTool] Deactivated');
  }

  /**
   * 检查是否激活
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * 创建工具按钮
   */
  createToolButton() {
    const button = document.createElement('button');
    button.className = 'annotation-tool-btn screenshot-tool-btn';
    button.dataset.tool = this.name;
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;

    button.style.cssText = [
      'padding: 8px 12px',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'background: white',
      'cursor: pointer',
      'font-size: 13px',
      'transition: all 0.2s'
    ].join(';');

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f5f5f5';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
    });

    return button;
  }

  /**
   * 创建标注卡片
   */
  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card screenshot-card';
    card.dataset.annotationId = annotation.id;
    card.dataset.annotationType = annotation.type;

    // 优先使用imageData(base64),如果没有再用imagePath(HTTP路径)
    const imageUrl = annotation.data.imageData
      ? annotation.data.imageData
      : this.#getImageUrl(annotation.data.imagePath);

    card.innerHTML = `
      <div class="annotation-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="annotation-icon" style="font-size: 18px;">${this.icon}</span>
          <span class="annotation-type" style="font-weight: 600; color: #333;">${this.displayName}标注</span>
        </div>
        <button class="card-menu-btn" style="border: none; background: transparent; cursor: pointer; font-size: 16px;">⋮</button>
      </div>
      <div class="annotation-card-body" style="padding: 12px;">
        <img
          src="${imageUrl}"
          alt="截图"
          class="screenshot-thumbnail"
          style="max-width: 100%; border-radius: 4px; margin-bottom: 8px; display: block;"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22>加载失败</text></svg>'"
        >
        ${annotation.data.description ? `<p class="annotation-description" style="color: #666; font-size: 14px; margin: 8px 0;">${this.#escapeHtml(annotation.data.description)}</p>` : ''}
        <div class="annotation-meta" style="display: flex; gap: 12px; font-size: 12px; color: #999; margin-top: 8px;">
          <span>📄 P.${annotation.pageNumber}</span>
          <span>🕒 ${this.#formatDate(annotation.createdAt)}</span>
        </div>
      </div>
      <div class="annotation-card-footer" style="display: flex; gap: 8px; padding: 8px; border-top: 1px solid #eee;">
        <button class="jump-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #2196f3; background: white; color: #2196f3; border-radius: 4px; cursor: pointer;">→ 跳转</button>
        <button class="comment-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer;">💬 ${annotation.comments.length}条评论</button>
      </div>
    `;

    // 绑定事件
    // 注意：实际使用中，AnnotationSidebarUI 有自己的 #createAnnotationCard 方法
    // 这个方法保留是为了实现 IAnnotationTool 接口，但可能不会被实际调用
    card.querySelector('.jump-btn').addEventListener('click', () => {
      this.#handleJumpToAnnotation(annotation.id);
      // 标记框的渲染现在由事件监听器处理 (#setupJumpEventListener)
    });

    card.querySelector('.comment-btn').addEventListener('click', () => {
      this.#handleAddComment(annotation.id);
    });

    return card;
  }

  /**
   * 销毁工具
   */
  destroy() {
    this.deactivate();
    this.#capturer = null;
    this.#qwebChannelBridge = null;
    this.#logger.info('[ScreenshotTool] Destroyed');
  }

  // ===== 私有方法：事件监听 =====

  /**
   * 设置标注相关事件监听器
   * - 跳转成功时显示标记框
   * - 标注创建成功时立即显示标记框
   * - 标注删除成功时移除标记框
   * @private
   */
  #setupJumpEventListener() {
    // 监听标注跳转成功事件
    this.#eventBus.on('annotation-navigation:jump:success', ({ annotation }) => {
      this.#logger.info('[ScreenshotTool] ===== Jump success event received =====');
      this.#logger.info('[ScreenshotTool] Annotation type:', annotation?.type);

      // 只处理截图类型的标注
      if (annotation && annotation.type === AnnotationType.SCREENSHOT) {
        this.#logger.info('[ScreenshotTool] This is a screenshot annotation, rendering marker...');

        // 延迟渲染，确保页面已经跳转并渲染完成
        setTimeout(() => {
          this.renderScreenshotMarker(annotation);
        }, 300);
      }
    });

    // 监听标注创建成功事件（初次截图完成后立即显示标记框）
    this.#eventBus.on('annotation:create:success', ({ annotation }) => {
      // 只处理截图类型的标注
      if (annotation && annotation.type === AnnotationType.SCREENSHOT) {
        this.#logger.info('[ScreenshotTool] Screenshot annotation created, rendering marker immediately');

        // 立即渲染标记框（无需延迟，因为页面没有跳转）
        setTimeout(() => {
          this.renderScreenshotMarker(annotation);
        }, 100);
      }
    });

    // 监听标注删除成功事件（自动移除标记框）
    this.#eventBus.on('annotation:delete:success', ({ id }) => {
      this.#logger.info(`[ScreenshotTool] Annotation deleted, removing marker: ${id}`);
      this.removeScreenshotMarker(id);
    });

    this.#logger.info('[ScreenshotTool] Annotation event listeners registered');
  }

  // ===== 私有方法：截图流程 =====

  /**
   * 创建选择遮罩层
   * @private
   */
  #createSelectionOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-selection-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'z-index: 9999',
      'pointer-events: none'  // 默认不拦截事件，允许页面滚动
    ].join(';');

    // 选择矩形
    const rect = document.createElement('div');
    rect.className = 'selection-rect';
    rect.style.cssText = [
      'position: absolute',
      'border: 2px dashed #2196f3',
      'background: rgba(33, 150, 243, 0.1)',
      'display: none',
      'pointer-events: none'
    ].join(';');

    overlay.appendChild(rect);
    document.body.appendChild(overlay);
    this.#selectionOverlay = overlay;
  }

  /**
   * 设置鼠标事件监听
   * @private
   */
  #setupMouseEvents() {
    const onMouseDown = (e) => this.#handleMouseDown(e);
    const onMouseMove = (e) => this.#handleMouseMove(e);
    const onMouseUp = (e) => this.#handleMouseUp(e);
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#isActive) {
        this.deactivate();
      }
    };

    // 在document上监听，这样可以捕获所有鼠标事件
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);

    // 保存引用以便清理
    this.#mouseListeners = { onMouseDown, onMouseMove, onMouseUp, onKeyDown };
  }

  /**
   * 处理鼠标按下
   * @private
   */
  #handleMouseDown(e) {
    // 如果不是激活状态，不处理
    if (!this.#isActive) return;

    // 检查点击位置是否在PDF页面元素内
    const pageElement = e.target.closest('.page');
    if (!pageElement) {
      this.#logger.debug('[ScreenshotTool] Click not within a PDF page element, ignoring');
      return;
    }

    // 阻止默认行为和事件传播（防止拖拽选择文本等）
    e.preventDefault();
    e.stopPropagation();

    // 保存viewport坐标（用于UI显示）
    this.#startPos = { x: e.clientX, y: e.clientY };
    this.#endPos = null;

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    rect.style.display = 'block';
    rect.style.left = `${e.clientX}px`;
    rect.style.top = `${e.clientY}px`;
    rect.style.width = '0px';
    rect.style.height = '0px';
  }

  /**
   * 处理鼠标移动
   * @private
   */
  #handleMouseMove(e) {
    // 只有在正在绘制时（startPos存在）才处理移动事件
    if (!this.#startPos || !this.#isActive) return;

    // 阻止默认行为（防止触发其他交互）
    e.preventDefault();

    this.#endPos = { x: e.clientX, y: e.clientY };

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    const bounds = this.#getRectFromPoints(this.#startPos, this.#endPos);

    rect.style.left = `${bounds.x}px`;
    rect.style.top = `${bounds.y}px`;
    rect.style.width = `${bounds.width}px`;
    rect.style.height = `${bounds.height}px`;
  }

  /**
   * 处理鼠标释放
   * @private
   */
  async #handleMouseUp(e) {
    if (!this.#startPos || !this.#isActive) return;

    this.#endPos = { x: e.clientX, y: e.clientY };
    const rect = this.#getRectFromPoints(this.#startPos, this.#endPos);

    // 最小尺寸检查
    if (rect.width < 10 || rect.height < 10) {
      this.#logger.warn('[ScreenshotTool] Selection too small, ignoring');
      this.#resetSelection();
      return;
    }

    // 立即重置选择框，防止对话框弹出时继续绘制
    this.#resetSelection();

    // 捕获并保存截图（异步操作，但选择框已重置）
    await this.#captureAndSave(rect);
  }

  /**
   * 捕获截图并保存
   * @private
   * @param {Object} viewportRect - viewport坐标的矩形
   */
  async #captureAndSave(viewportRect) {
    try {
      const pageNumber = this.#getCurrentPageNumber();

      this.#logger.info(`[ScreenshotTool] Capturing screenshot at page ${pageNumber}`, viewportRect);

      // 1. 将viewport坐标转换为Canvas坐标
      const canvasRect = this.#convertViewportToCanvasRect(pageNumber, viewportRect);
      if (!canvasRect) {
        throw new Error('Failed to convert viewport coordinates to canvas coordinates');
      }

      this.#logger.info('[ScreenshotTool] Converted to canvas coordinates', canvasRect);

      // 2. 使用Canvas捕获截图（base64）
      const base64Image = await this.#capturer.capture(pageNumber, canvasRect);
      this.#logger.info('[ScreenshotTool] base64Image captured, length:', base64Image?.length);

      // 2. 显示预览对话框
      this.#logger.info('[ScreenshotTool] Showing preview dialog...');
      const description = await this.#showPreviewDialog(base64Image);
      this.#logger.info('[ScreenshotTool] Preview dialog closed, description:', description);

      if (description === null) {
        this.#logger.info('[ScreenshotTool] User cancelled');
        return;
      }

      // 3. 通过QWebChannel保存到PyQt
      this.#logger.info('[ScreenshotTool] Calling saveImageToPyQt...');
      const saveResult = await this.#saveImageToPyQt(base64Image);
      this.#logger.info('[ScreenshotTool] saveImageToPyQt returned:', saveResult);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save image');
      }

      this.#logger.info('[ScreenshotTool] Image saved', saveResult);

      // 4. 转换为百分比坐标
      const percentRect = this.#convertCanvasToPercent(pageNumber, canvasRect);
      if (!percentRect) {
        throw new Error('Failed to convert canvas coordinates to percentage');
      }

      // 5. 创建标注数据
      // 注意: Mock模式下imagePath是虚拟路径,需要同时保存base64以便显示
      const annotationData = {
        type: AnnotationType.SCREENSHOT,
        pageNumber,
        data: {
          // 主要使用百分比坐标（缩放无关）
          rectPercent: percentRect,
          // 保留绝对坐标用于兼容和调试
          rect: canvasRect,
          markerColor: DEFAULT_MARKER_COLOR,
          imagePath: saveResult.path,
          imageHash: saveResult.hash,
          imageData: base64Image,  // Mock模式下需要base64数据才能显示图片
          description
        }
      };

      // 5. 发布创建事件 (包装成{annotation: ...}格式)
      this.#eventBus.emit('annotation:create:requested', {
        annotation: annotationData
      });

      this.#logger.info('[ScreenshotTool] Annotation created', annotationData);

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Capture failed:', error);
      this.#logger.error('[ScreenshotTool] Error details:', {
        message: error.message,
        stack: error.stack
      });

      // 显示错误提示 (修复事件名称格式)
      this.#eventBus.emit('notification:error:triggered', {
        message: '截图失败: ' + error.message
      });
    }
  }

  /**
   * 通过QWebChannel保存图片到PyQt
   * @private
   */
  async #saveImageToPyQt(base64Image) {
    return this.#qwebChannelBridge.saveScreenshot(base64Image);
  }

  /**
   * 显示预览对话框
   * @private
   */
  async #showPreviewDialog(imageData) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'screenshot-preview-dialog';
      dialog.style.cssText = [
        'position: fixed',
        'top: 50%',
        'left: 50%',
        'transform: translate(-50%, -50%)',
        'background: white',
        'border-radius: 8px',
        'box-shadow: 0 4px 20px rgba(0,0,0,0.3)',
        'padding: 20px',
        'z-index: 10000',
        'max-width: 600px',
        'max-height: 80vh',
        'overflow: auto'
      ].join(';');

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">截图预览</h3>
        <img src="${imageData}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; display: block;">
        <div style="margin-top: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
            标注描述（可选）:
          </label>
          <textarea
            id="screenshot-description"
            placeholder="为这个截图添加描述..."
            style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; box-sizing: border-box; font-family: inherit;"
          ></textarea>
        </div>
        <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
          <button id="screenshot-cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
          <button id="screenshot-save-btn" style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
        </div>
      `;

      document.body.appendChild(dialog);

      const textarea = dialog.querySelector('#screenshot-description');
      const saveBtn = dialog.querySelector('#screenshot-save-btn');
      const cancelBtn = dialog.querySelector('#screenshot-cancel-btn');

      textarea.focus();

      saveBtn.addEventListener('click', () => {
        const description = textarea.value.trim();
        dialog.remove();
        resolve(description);
      });

      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(null);
      });

      // ESC关闭
      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          dialog.remove();
          document.removeEventListener('keydown', onKeyDown);
          resolve(null);
        }
      };
      document.addEventListener('keydown', onKeyDown);
    });
  }

  // ===== 辅助方法 =====

  /**
   * 计算矩形区域
   * @private
   */
  #getRectFromPoints(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    return { x, y, width, height };
  }

  /**
   * 获取当前页码
   * @private
   */
  #getCurrentPageNumber() {
    // PDFViewerManager.currentPageNumber是属性，不是方法
    return this.#pdfViewerManager?.currentPageNumber || 1;
  }

  /**
   * 获取图片URL
   * @private
   */
  #getImageUrl(imagePath) {
    const port = window.APP_CONFIG?.fileServerPort || 8080;
    return `http://localhost:${port}${imagePath}`;
  }

  /**
   * HTML转义
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 格式化日期
   * @private
   */
  #formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 跳转到标注
   * @private
   */
  #handleJumpToAnnotation(annotationId) {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO, {
      id: annotationId,
      toolName: this.name  // 标识是截图工具的跳转请求
    });
  }

  /**
   * 添加评论
   * @private
   */
  #handleAddComment(annotationId) {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADD, { annotationId });
  }

  /**
   * 将Canvas绝对坐标转换为百分比坐标
   * @private
   * @param {number} pageNumber - 页码
   * @param {Object} canvasRect - Canvas坐标系的矩形 { x, y, width, height }
   * @returns {Object|null} 百分比坐标 { xPercent, yPercent, widthPercent, heightPercent }
   */
  #convertCanvasToPercent(pageNumber, canvasRect) {
    try {
      // 获取Canvas元素
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView) {
        this.#logger.error(`[ScreenshotTool] Cannot find PageView for page ${pageNumber}`);
        return null;
      }

      const canvas = pageView.div?.querySelector('canvas');
      if (!canvas) {
        this.#logger.error(`[ScreenshotTool] Cannot find canvas for page ${pageNumber}`);
        return null;
      }

      // 计算百分比
      const percentRect = {
        xPercent: (canvasRect.x / canvas.width) * 100,
        yPercent: (canvasRect.y / canvas.height) * 100,
        widthPercent: (canvasRect.width / canvas.width) * 100,
        heightPercent: (canvasRect.height / canvas.height) * 100
      };

      this.#logger.info('[ScreenshotTool] Canvas to Percent conversion:', {
        canvas: canvasRect,
        canvasSize: { width: canvas.width, height: canvas.height },
        percent: percentRect
      });

      return percentRect;

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Canvas to Percent conversion failed:', error);
      return null;
    }
  }

  /**
   * 将百分比坐标转换为Canvas绝对坐标
   * @private
   * @param {number} pageNumber - 页码
   * @param {Object} percentRect - 百分比坐标 { xPercent, yPercent, widthPercent, heightPercent }
   * @returns {Object|null} Canvas坐标系的矩形 { x, y, width, height }
   */
  #convertPercentToCanvas(pageNumber, percentRect) {
    try {
      // 获取Canvas元素
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView) {
        this.#logger.error(`[ScreenshotTool] Cannot find PageView for page ${pageNumber}`);
        return null;
      }

      const canvas = pageView.div?.querySelector('canvas');
      if (!canvas) {
        this.#logger.error(`[ScreenshotTool] Cannot find canvas for page ${pageNumber}`);
        return null;
      }

      // 计算Canvas坐标
      const canvasRect = {
        x: Math.round((percentRect.xPercent / 100) * canvas.width),
        y: Math.round((percentRect.yPercent / 100) * canvas.height),
        width: Math.round((percentRect.widthPercent / 100) * canvas.width),
        height: Math.round((percentRect.heightPercent / 100) * canvas.height)
      };

      this.#logger.info('[ScreenshotTool] Percent to Canvas conversion:', {
        percent: percentRect,
        canvasSize: { width: canvas.width, height: canvas.height },
        canvas: canvasRect
      });

      return canvasRect;

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Percent to Canvas conversion failed:', error);
      return null;
    }
  }

  /**
   * 将viewport坐标转换为Canvas坐标
   * @private
   * @param {number} pageNumber - 页码
   * @param {Object} viewportRect - viewport坐标系的矩形 { x, y, width, height }
   * @returns {Object|null} Canvas坐标系的矩形 { x, y, width, height }
   */
  #convertViewportToCanvasRect(pageNumber, viewportRect) {
    try {
      // 1. 获取PageView对象
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView) {
        this.#logger.error(`[ScreenshotTool] Cannot find PageView for page ${pageNumber}`);
        return null;
      }

      // 2. 获取页面容器的位置信息
      const pageDiv = pageView.div;
      if (!pageDiv) {
        this.#logger.error(`[ScreenshotTool] Cannot find page div for page ${pageNumber}`);
        return null;
      }

      // 3. 获取页面相对于viewport的偏移量
      const pageBounds = pageDiv.getBoundingClientRect();

      // 4. 计算相对于页面的坐标
      const relativeX = viewportRect.x - pageBounds.left;
      const relativeY = viewportRect.y - pageBounds.top;

      // 5. 获取Canvas元素
      const canvas = pageDiv.querySelector('canvas');
      if (!canvas) {
        this.#logger.error(`[ScreenshotTool] Cannot find canvas for page ${pageNumber}`);
        return null;
      }

      // 6. 计算缩放比例
      // Canvas的实际像素尺寸 / 页面div的显示尺寸
      const scaleX = canvas.width / pageBounds.width;
      const scaleY = canvas.height / pageBounds.height;

      // 7. 转换为Canvas坐标
      const canvasRect = {
        x: Math.round(relativeX * scaleX),
        y: Math.round(relativeY * scaleY),
        width: Math.round(viewportRect.width * scaleX),
        height: Math.round(viewportRect.height * scaleY)
      };

      this.#logger.info('[ScreenshotTool] Coordinate conversion:', {
        viewport: viewportRect,
        pageBounds: { left: pageBounds.left, top: pageBounds.top, width: pageBounds.width, height: pageBounds.height },
        canvasSize: { width: canvas.width, height: canvas.height },
        scale: { x: scaleX, y: scaleY },
        canvas: canvasRect
      });

      return canvasRect;

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Coordinate conversion failed:', error);
      return null;
    }
  }

  /**
   * 重置选择框（保持工具激活）
   * 用于截图完成后，清除当前选择框但保持截图模式，支持连续截图
   * @private
   */
  #resetSelection() {
    // 重置位置
    this.#startPos = null;
    this.#endPos = null;

    // 隐藏选择框
    if (this.#selectionOverlay) {
      const rect = this.#selectionOverlay.querySelector('.selection-rect');
      if (rect) {
        rect.style.display = 'none';
      }
    }

    this.#logger.info('[ScreenshotTool] Selection reset, ready for next capture');
  }

  /**
   * 渲染截图标记框（在PDF页面上显示截图区域）
   * @param {Object} annotation - 截图标注对象
   */
  renderScreenshotMarker(annotation) {
    try {
      this.#logger.info('[ScreenshotTool] ========== renderScreenshotMarker called ==========');
      this.#logger.info('[ScreenshotTool] Annotation:', annotation);

      // 检查是否已经渲染过
      if (this.#renderedMarkers.has(annotation.id)) {
        this.#logger.info(`[ScreenshotTool] Marker already rendered for ${annotation.id}`);
        return;
      }

      const { pageNumber, data } = annotation;
      this.#logger.info('[ScreenshotTool] PageNumber:', pageNumber);
      this.#logger.info('[ScreenshotTool] Data:', data);

      const { rectPercent } = data;

      if (!rectPercent) {
        this.#logger.warn(`[ScreenshotTool] ❌ No rectPercent data for annotation ${annotation.id}`);
        this.#logger.warn('[ScreenshotTool] Available data keys:', Object.keys(data));
        return;
      }

      this.#logger.info('[ScreenshotTool] RectPercent:', rectPercent);

      // 获取页面容器
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView || !pageView.div) {
        this.#logger.error(`[ScreenshotTool] Cannot find page ${pageNumber}`);
        return;
      }

      const pageDiv = pageView.div;
      const pageBounds = pageDiv.getBoundingClientRect();

      // 计算标记框的位置（基于百分比）
      const markerRect = {
        left: (rectPercent.xPercent / 100) * pageBounds.width,
        top: (rectPercent.yPercent / 100) * pageBounds.height,
        width: (rectPercent.widthPercent / 100) * pageBounds.width,
        height: (rectPercent.heightPercent / 100) * pageBounds.height
      };

      // 创建标记框元素
      const marker = document.createElement('div');
      marker.className = 'screenshot-marker';
      marker.dataset.annotationId = annotation.id;
      marker.style.cssText = [
        'position: absolute',
        `left: ${markerRect.left}px`,
        `top: ${markerRect.top}px`,
        `width: ${markerRect.width}px`,
        `height: ${markerRect.height}px`,
        'pointer-events: none',
        'box-sizing: border-box',
        'z-index: 10',
        'transition: border-color 0.2s ease, background-color 0.2s ease'
      ].join(';');

      const initialColor = data.markerColor || DEFAULT_MARKER_COLOR;
      data.markerColor = initialColor;
      this.#applyMarkerColor(marker, initialColor);

      const baseCircleStyle = [
        'position: absolute',
        'top: -10px',
        'right: -10px',
        'width: 24px',
        'height: 24px',
        'border: 2px solid white',
        'border-radius: 50%',
        'cursor: pointer',
        'pointer-events: auto',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'font-size: 14px',
        'font-weight: bold',
        'transition: all 0.2s',
        'z-index: 12',
        'box-shadow: 0 2px 6px rgba(0,0,0,0.2)'
      ];

      // 删除按钮（右上角）
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'screenshot-marker-delete';
      deleteBtn.style.cssText = baseCircleStyle.concat([
        'background: #f44336',
        'color: white'
      ]).join(';');
      deleteBtn.innerHTML = '×';
      deleteBtn.title = '删除此截图标注';

      // 控制面板容器（初始收起）
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'screenshot-marker-controls';
      controlsContainer.style.cssText = [
        'position: absolute',
        'top: -10px',
        'right: 18px',
        'display: flex',
        'gap: 6px',
        'pointer-events: none',
        'opacity: 0',
        'transform: translateX(8px)',
        'transition: opacity 0.2s ease, transform 0.2s ease',
        'z-index: 11'
      ].join(';');

      const colorButtons = [];
      const updateActiveColorButton = (color) => {
        colorButtons.forEach((btn) => {
          if (btn.dataset.color === color) {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.3)';
          } else {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
          }
        });
      };

      const applyColor = (color) => {
        this.#applyMarkerColor(marker, color);
        data.markerColor = color;
        updateActiveColorButton(color);
      };

      MARKER_COLOR_PRESETS.forEach((preset) => {
        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.dataset.color = preset.value;
        colorBtn.title = `切换为${preset.label}`;
        colorBtn.style.cssText = [
          'width: 24px',
          'height: 24px',
          'border-radius: 50%',
          'border: 2px solid white',
          `background: ${preset.value}`,
          'cursor: pointer',
          'pointer-events: auto',
          'display: flex',
          'align-items: center',
          'justify-content: center',
          'transition: transform 0.2s ease, box-shadow 0.2s ease'
        ].join(';');
        colorBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          applyColor(preset.value);
        });
        controlsContainer.appendChild(colorBtn);
        colorButtons.push(colorBtn);
      });

      updateActiveColorButton(initialColor);

      // 跳转按钮
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.title = '查看标注卡片';
      jumpBtn.innerHTML = '↗';
      jumpBtn.style.cssText = [
        'width: 24px',
        'height: 24px',
        'border-radius: 50%',
        'border: 2px solid white',
        'background: #2196f3',
        'color: white',
        'cursor: pointer',
        'pointer-events: auto',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'font-size: 14px',
        'transition: transform 0.2s ease, box-shadow 0.2s ease'
      ].join(';');
      jumpBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#handleJumpToAnnotation(annotation.id);
        this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: 'annotation' });
        setTimeout(() => {
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, { id: annotation.id });
        }, 150);
      });
      controlsContainer.appendChild(jumpBtn);

      // 删除按钮悬停效果与控制显示逻辑
      let hideTimer = null;
      const showControls = () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        controlsContainer.style.opacity = '1';
        controlsContainer.style.pointerEvents = 'auto';
        controlsContainer.style.transform = 'translateX(0)';
        deleteBtn.style.transform = 'scale(1.1)';
        deleteBtn.style.background = '#d32f2f';
      };
      const scheduleHide = () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(() => {
          controlsContainer.style.opacity = '0';
          controlsContainer.style.pointerEvents = 'none';
          controlsContainer.style.transform = 'translateX(8px)';
          deleteBtn.style.transform = 'scale(1)';
          deleteBtn.style.background = '#f44336';
        }, 120);
      };

      deleteBtn.addEventListener('mouseenter', showControls);
      deleteBtn.addEventListener('mouseleave', scheduleHide);
      controlsContainer.addEventListener('mouseenter', showControls);
      controlsContainer.addEventListener('mouseleave', scheduleHide);

      // 点击删除 - 删除标注（需要确认）
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定要删除此截图标注吗？')) {
          this.#logger.info(`[ScreenshotTool] Requesting deletion of annotation ${annotation.id}`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotation.id });
        }
      });

      // 组装
      marker.appendChild(deleteBtn);
      marker.appendChild(controlsContainer);
      pageDiv.appendChild(marker);

      // 保存引用
      this.#renderedMarkers.set(annotation.id, marker);

      this.#logger.info(`[ScreenshotTool] Marker rendered for annotation ${annotation.id} on page ${pageNumber}`);

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Failed to render marker:', error);
    }
  }

  #applyMarkerColor(marker, color) {
    const rgb = this.#hexToRgb(color);
    if (!rgb) {
      return;
    }
    marker.style.border = `2px solid ${color}`;
    marker.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
    marker.dataset.markerColor = color;
  }

  #hexToRgb(hex) {
    if (typeof hex !== 'string') {
      return null;
    }
    let normalized = hex.trim().replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map((ch) => ch + ch).join('');
    }
    if (normalized.length !== 6) {
      return null;
    }
    const intValue = Number.parseInt(normalized, 16);
    if (Number.isNaN(intValue)) {
      return null;
    }
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  }

  /**
   * 移除截图标记框
   * @param {string} annotationId - 标注ID
   */
  removeScreenshotMarker(annotationId) {
    const marker = this.#renderedMarkers.get(annotationId);
    if (!marker) {
      this.#logger.debug(`[ScreenshotTool] No marker found for ${annotationId}`);
      return;
    }

    // 移除DOM
    if (marker.parentNode) {
      marker.remove();
    }

    // 移除引用
    this.#renderedMarkers.delete(annotationId);

    this.#logger.info(`[ScreenshotTool] Marker removed for annotation ${annotationId}`);
  }

  /**
   * 清除所有截图标记框
   */
  clearAllMarkers() {
    this.#renderedMarkers.forEach((marker, id) => {
      if (marker.parentNode) {
        marker.remove();
      }
    });
    this.#renderedMarkers.clear();
    this.#logger.info('[ScreenshotTool] All markers cleared');
  }

  /**
   * 清理资源
   * @private
   */
  #cleanup() {
    // ⚠️ 注意：不清理标记框，因为标记框应该持久显示
    // 即使退出截图模式，已经创建的截图标注的标记框也应该保留
    // 只清理截图模式相关的UI元素（选择框和事件监听）

    // 移除事件监听（现在都在document上）
    if (this.#mouseListeners) {
      document.removeEventListener('mousedown', this.#mouseListeners.onMouseDown);
      document.removeEventListener('mousemove', this.#mouseListeners.onMouseMove);
      document.removeEventListener('mouseup', this.#mouseListeners.onMouseUp);
      document.removeEventListener('keydown', this.#mouseListeners.onKeyDown);
      this.#mouseListeners = null;
    }

    // 移除遮罩层DOM（选择框）
    if (this.#selectionOverlay) {
      this.#selectionOverlay.remove();
      this.#selectionOverlay = null;
    }

    this.#startPos = null;
    this.#endPos = null;
  }
}
