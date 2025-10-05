import { jest } from '@jest/globals';
import { TextHighlightTool } from './index.js';

let mockHighlightRendererInstance;
let mockHighlightActionMenuInstance;

jest.mock('./highlight-renderer.js', () => ({
  HighlightRenderer: jest.fn().mockImplementation(() => mockHighlightRendererInstance)
}));

jest.mock('./floating-color-toolbar.js', () => ({
  FloatingColorToolbar: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    hide: jest.fn()
  }))
}));

jest.mock('./highlight-action-menu.js', () => ({
  HighlightActionMenu: jest.fn().mockImplementation((options) => {
    mockHighlightActionMenuInstance = {
      attach: jest.fn(),
      detach: jest.fn(),
      updateColor: jest.fn(),
      destroy: jest.fn(),
      options
    };
    return mockHighlightActionMenuInstance;
  })
}));

describe('TextHighlightTool integration with action menu', () => {
  let tool;
  let eventBus;
  let handlers;
  let logger;

  beforeEach(async () => {
    handlers = {};
    eventBus = {
      emit: jest.fn(),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      }),
      off: jest.fn()
    };

    mockHighlightRendererInstance = {
      renderHighlight: jest.fn().mockReturnValue({
        container: document.createElement('div'),
        boundingBox: { left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 }
      }),
      removeHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      clearPageHighlights: jest.fn(),
      clearAllHighlights: jest.fn(),
      destroy: jest.fn()
    };

    mockHighlightActionMenuInstance = null;

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    tool = new TextHighlightTool();
    await tool.initialize({ eventBus, logger, pdfViewerManager: {} });
  });

  afterEach(() => {
    tool.destroy();
    jest.clearAllMocks();
  });

  const createAnnotation = () => ({
    id: 'ann-1',
    type: 'text-highlight',
    pageNumber: 1,
    data: {
      selectedText: 'Sample text',
      highlightColor: '#ffeb3b',
      textRanges: [],
      lineRects: []
    }
  });

  it('attaches highlight action menu when annotation is created', () => {
    const annotation = createAnnotation();
    handlers['annotation:create:success']({ annotation });

    expect(mockHighlightRendererInstance.renderHighlight).toHaveBeenCalledWith(
      annotation.pageNumber,
      annotation.data.textRanges,
      annotation.data.highlightColor,
      annotation.id,
      annotation.data.lineRects
    );
    expect(mockHighlightActionMenuInstance).not.toBeNull();
    expect(mockHighlightActionMenuInstance.attach).toHaveBeenCalled();
  });

  it('emits update request when color change handler triggered', () => {
    const annotation = createAnnotation();
    handlers['annotation:create:success']({ annotation });

    const { onColorChange } = mockHighlightActionMenuInstance.options;
    onColorChange(annotation, '#4caf50');

    expect(mockHighlightRendererInstance.updateHighlightColor).toHaveBeenCalledWith(annotation.id, '#4caf50');
    expect(mockHighlightActionMenuInstance.updateColor).toHaveBeenCalledWith(annotation.id, '#4caf50');
    expect(eventBus.emit).toHaveBeenCalledWith(
      'annotation:update:requested',
      expect.objectContaining({
        id: annotation.id,
        changes: {
          data: {
            highlightColor: '#4caf50'
          }
        }
      })
    );
  });

  it('emits navigation and sidebar events when jump handler triggered', () => {
    const annotation = createAnnotation();
    handlers['annotation:create:success']({ annotation });

    const { onJump } = mockHighlightActionMenuInstance.options;
    eventBus.emit.mockClear();
    onJump(annotation);

    expect(eventBus.emit).toHaveBeenCalledWith(
      'sidebar:open:requested',
      { sidebarId: 'annotation' }
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'annotation:select:requested',
      { id: annotation.id }
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'annotation-navigation:jump:requested',
      { annotation }
    );
  });

  it('emits translator event when translate handler triggered', () => {
    const annotation = createAnnotation();
    handlers['annotation:create:success']({ annotation });

    const { onTranslate } = mockHighlightActionMenuInstance.options;
    eventBus.emit.mockClear();
    onTranslate(annotation);

    expect(eventBus.emit).toHaveBeenCalledWith(
      'sidebar:open:requested',
      { sidebarId: 'translate' }
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'pdf-translator:text:selected',
      expect.objectContaining({
        text: annotation.data.selectedText,
        annotationId: annotation.id
      })
    );
  });
});
