import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { PDF_TRANSLATOR_EVENTS } from '../pdf-translator/events.js';
// 统一使用小写路径，避免在部分打包/HTTP服务中因大小写不一致导致的模块解析问题
import { Annotation, AnnotationType } from '../annotation/models/annotation.js';
import { QuickActionsToolbar } from './quick-actions-toolbar.js';
import {
  findPageElement,
  extractPageNumber,
  buildSelectionSnapshot,
  computeTextRanges
} from './selection-utils.js';

const DEFAULT_HIGHLIGHT_COLOR = '#ffff00';

/**
 * 文本选择快捷操作插件
 */
export class TextSelectionQuickActionsFeature {
  #logger;
  #eventBus;
  #toolbar;
  #isAnnotationMode = false;
  #currentSelection = null;
  #mouseUpHandler;
  #mouseDownHandler;
  #selectionChangeHandler;
  #scrollHandler;
  #unsubscribes = [];
  #isToolbarInteraction = false;

  get name() {
    return 'text-selection-quick-actions';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return ['app-core', 'annotation', 'pdf-translator'];
  }

  async install(context) {
    const { globalEventBus, logger } = context;
    this.#eventBus = globalEventBus;
    this.#logger = logger || getLogger('TextSelectionQuickActions');

    this.#toolbar = new QuickActionsToolbar({
      copy: () => this.#handleCopyAction(),
      annotate: () => this.#handleAnnotateAction(),
      translate: () => this.#handleTranslateAction(),
      ai: () => this.#handleAIAction()
    });

    this.#mouseUpHandler = (event) => this.#handleMouseUp(event);
    this.#mouseDownHandler = (event) => this.#handleMouseDown(event);
    this.#selectionChangeHandler = () => this.#handleSelectionChange();
    this.#scrollHandler = () => this.#hideToolbar();

    document.addEventListener('mouseup', this.#mouseUpHandler);
    document.addEventListener('mousedown', this.#mouseDownHandler);
    document.addEventListener('selectionchange', this.#selectionChangeHandler);
    document.addEventListener('scroll', this.#scrollHandler, true);

    const scopedToolActivatedEvent = `@annotation/${PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED}`;
    const scopedToolDeactivatedEvent = `@annotation/${PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED}`;

    this.#unsubscribes.push(
      this.#eventBus.on(scopedToolActivatedEvent, () => {
        this.#logger.debug('Annotation tool activated (scoped), disabling quick actions');
        this.#isAnnotationMode = true;
        this.#hideToolbar();
      })
    );

    this.#unsubscribes.push(
      this.#eventBus.on(scopedToolDeactivatedEvent, () => {
        this.#logger.debug('Annotation tool deactivated (scoped), enabling quick actions');
        this.#isAnnotationMode = false;
      })
    );

    this.#logger.info('[TextSelectionQuickActions] Installed');
  }

  async uninstall() {
    this.#hideToolbar();

    document.removeEventListener('mouseup', this.#mouseUpHandler);
    document.removeEventListener('mousedown', this.#mouseDownHandler);
    document.removeEventListener('selectionchange', this.#selectionChangeHandler);
    document.removeEventListener('scroll', this.#scrollHandler, true);

    this.#unsubscribes.forEach((unsub) => {
      try {
        unsub?.();
      } catch (error) {
        this.#logger?.warn?.('Failed to unsubscribe quick actions listener', error);
      }
    });
    this.#unsubscribes = [];

    this.#toolbar?.destroy();
    this.#toolbar = null;
    this.#eventBus = null;
    this.#logger = null;
  }

  #handleMouseUp(event) {
    if (this.#isAnnotationMode) {
      return;
    }

    if (this.#toolbar?.contains(event.target)) {
      this.#isToolbarInteraction = true;
      return;
    }

    this.#isToolbarInteraction = false;

    if (event?.button !== 0) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.#hideToolbar();
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    const text = range.toString().trim();
    if (!text) {
      this.#hideToolbar();
      return;
    }

    const pageElement = findPageElement(range.startContainer);
    if (!pageElement) {
      this.#logger.debug('Selection not inside PDF page, ignore quick actions');
      this.#hideToolbar();
      return;
    }

    const pageNumber = extractPageNumber(pageElement);
    if (!pageNumber) {
      this.#logger.warn('Failed to extract page number for quick actions');
      this.#hideToolbar();
      return;
    }

    const snapshot = buildSelectionSnapshot(range, pageElement);
    if (!snapshot) {
      this.#logger.warn('Unable to build selection snapshot for quick actions');
      this.#hideToolbar();
      return;
    }

    this.#currentSelection = {
      text,
      pageNumber,
      pageElement,
      range,
      lineRects: snapshot.lineRects,
      boundingBox: snapshot.boundingBox,
      selectionRect: snapshot.selectionRect
    };

    this.#toolbar.show({ x: event.clientX, y: event.clientY });
    this.#logger.debug('Quick actions toolbar shown');
  }

  #handleMouseDown(event) {
    if (!this.#toolbar?.contains(event.target)) {
      this.#hideToolbar();
    }
  }

  #handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.toString()) {
      if (this.#isToolbarInteraction) {
        return;
      }
      this.#hideToolbar();
    }
  }

  #hideToolbar() {
    this.#toolbar?.hide();
    this.#currentSelection = null;
    this.#isToolbarInteraction = false;
  }

  async #handleCopyAction() {
    if (!this.#currentSelection?.text) {
      return;
    }

    const text = this.#currentSelection.text;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.#logger.info('Copied selected text via clipboard API');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        this.#logger.info('Copied selected text via execCommand');
      }
    } catch (error) {
      this.#logger.error('Failed to copy selected text', error);
    }

    this.#clearSelection();
    this.#hideToolbar();
  }

  #handleAnnotateAction() {
    const selection = this.#currentSelection;
    if (!selection) {
      return;
    }

    if (!Array.isArray(selection.lineRects) || selection.lineRects.length === 0) {
      this.#logger.warn('Quick actions missing line rects, abort annotate action');
      return;
    }

    try {
      // 计算后端契约要求的 textRanges（非空）
      const textRanges = computeTextRanges(selection.range, selection.pageElement);

      const annotation = new Annotation({
        type: AnnotationType.TEXT_HIGHLIGHT,
        pageNumber: selection.pageNumber,
        data: {
          selectedText: selection.text,
          highlightColor: DEFAULT_HIGHLIGHT_COLOR,
          // 后端要求非空数组；若无法精确计算，则退化为 [0, text.length]
          textRanges: Array.isArray(textRanges) && textRanges.length > 0 ? textRanges : [{ start: 0, end: selection.text.length }],
          lineRects: selection.lineRects,
          boundingBox: selection.boundingBox
        }
      });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, {
        annotation
      });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, {
        sidebarId: 'annotation'
      });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, {
        id: annotation.id
      });

      this.#logger.info('Quick actions created highlight annotation', {
        id: annotation.id,
        pageNumber: annotation.pageNumber
      });
    } catch (error) {
      this.#logger.error('Quick actions failed to create annotation', error);
    }

    this.#clearSelection();
    this.#hideToolbar();
  }

  #handleTranslateAction() {
    const selection = this.#currentSelection;
    if (!selection) {
      return;
    }

    this.#eventBus.emit(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, {
      text: selection.text,
      pageNumber: selection.pageNumber,
      position: {
        x: selection.selectionRect?.left || 0,
        y: selection.selectionRect?.top || 0
      },
      source: 'quick-actions',
      timestamp: Date.now()
    });

    this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, {
      sidebarId: 'translate'
    });

    this.#clearSelection();
    this.#hideToolbar();
  }

  #handleAIAction() {
    this.#logger.info('AI quick action clicked - awaiting implementation');
    this.#hideToolbar();
  }

  #clearSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      this.#logger?.warn?.('Failed to clear selection ranges', error);
    }
  }
}

export default TextSelectionQuickActionsFeature;
