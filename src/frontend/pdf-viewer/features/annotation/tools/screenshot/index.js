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
    card.querySelector('.jump-btn').addEventListener('click', () => {
      this.#handleJumpToAnnotation(annotation.id);
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
      'pointer-events: auto'
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
    const overlay = this.#selectionOverlay;

    const onMouseDown = (e) => this.#handleMouseDown(e);
    const onMouseMove = (e) => this.#handleMouseMove(e);
    const onMouseUp = (e) => this.#handleMouseUp(e);
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#isActive) {
        this.deactivate();
      }
    };

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);

    // 保存引用以便清理
    this.#mouseListeners = { onMouseDown, onMouseMove, onMouseUp, onKeyDown };
  }

  /**
   * 处理鼠标按下
   * @private
   */
  #handleMouseDown(e) {
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
    if (!this.#startPos) return;

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
    if (!this.#startPos) return;

    this.#endPos = { x: e.clientX, y: e.clientY };
    const rect = this.#getRectFromPoints(this.#startPos, this.#endPos);

    // 最小尺寸检查
    if (rect.width < 10 || rect.height < 10) {
      this.#logger.warn('[ScreenshotTool] Selection too small, ignoring');
      this.#resetSelection();
      return;
    }

    // 捕获并保存截图
    await this.#captureAndSave(rect);

    // 重置选择框（保持工具激活状态，支持连续截图）
    this.#resetSelection();
  }

  /**
   * 捕获截图并保存
   * @private
   */
  async #captureAndSave(rect) {
    try {
      const pageNumber = this.#getCurrentPageNumber();

      this.#logger.info(`[ScreenshotTool] Capturing screenshot at page ${pageNumber}`, rect);

      // 1. 使用Canvas捕获截图（base64）
      const base64Image = await this.#capturer.capture(pageNumber, rect);

      // 2. 显示预览对话框
      const description = await this.#showPreviewDialog(base64Image);
      if (description === null) {
        this.#logger.info('[ScreenshotTool] User cancelled');
        return;
      }

      // 3. 通过QWebChannel保存到PyQt
      const saveResult = await this.#saveImageToPyQt(base64Image);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save image');
      }

      this.#logger.info('[ScreenshotTool] Image saved', saveResult);

      // 4. 创建标注数据
      // 注意: Mock模式下imagePath是虚拟路径,需要同时保存base64以便显示
      const annotationData = {
        type: AnnotationType.SCREENSHOT,
        pageNumber,
        data: {
          rect,  // rect应该在data中
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
    this.#eventBus.emit('annotation:jump:requested', { id: annotationId });
  }

  /**
   * 添加评论
   * @private
   */
  #handleAddComment(annotationId) {
    this.#eventBus.emit('annotation-comment:add:requested', { annotationId });
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
   * 清理资源
   * @private
   */
  #cleanup() {
    if (this.#selectionOverlay) {
      // 移除事件监听
      if (this.#mouseListeners) {
        this.#selectionOverlay.removeEventListener('mousedown', this.#mouseListeners.onMouseDown);
        this.#selectionOverlay.removeEventListener('mousemove', this.#mouseListeners.onMouseMove);
        this.#selectionOverlay.removeEventListener('mouseup', this.#mouseListeners.onMouseUp);
        document.removeEventListener('keydown', this.#mouseListeners.onKeyDown);
        this.#mouseListeners = null;
      }

      // 移除DOM
      this.#selectionOverlay.remove();
      this.#selectionOverlay = null;
    }

    this.#startPos = null;
    this.#endPos = null;
  }
}
