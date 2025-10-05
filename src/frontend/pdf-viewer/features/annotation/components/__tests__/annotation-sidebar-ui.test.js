import { AnnotationSidebarUI } from '../annotation-sidebar-ui.js';
import { Annotation, AnnotationType } from '../../models/annotation.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

describe('AnnotationSidebarUI delete button', () => {
  let eventBus;
  let ui;
  let confirmSpy;

  beforeEach(() => {
    document.body.innerHTML = '';
    eventBus = {
      emit: jest.fn(),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };

    ui = new AnnotationSidebarUI(eventBus);
    ui.initialize();
    document.body.appendChild(ui.getContentElement());

    confirmSpy = jest.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    ui.destroy();
  });

  const createHighlightAnnotation = () => new Annotation({
    id: 'ann-test',
    type: AnnotationType.TEXT_HIGHLIGHT,
    pageNumber: 1,
    data: {
      selectedText: '测试文本',
      highlightColor: '#ffff00',
      lineRects: [{ xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 }],
    },
  });

  it('emits delete event when delete button confirmed', () => {
    confirmSpy.mockReturnValue(true);

    const annotation = createHighlightAnnotation();
    ui.addAnnotationCard(annotation);

    const deleteBtn = ui
      .getContentElement()
      .querySelector('.annotation-card .annotation-delete-btn');

    expect(deleteBtn).not.toBeNull();

    eventBus.emit.mockClear();
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      { id: annotation.id }
    );
  });

  it('does not emit delete event when user cancels', () => {
    confirmSpy.mockReturnValue(false);

    const annotation = createHighlightAnnotation();
    ui.addAnnotationCard(annotation);

    const deleteBtn = ui
      .getContentElement()
      .querySelector('.annotation-card .annotation-delete-btn');

    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      expect.anything()
    );
  });
});
