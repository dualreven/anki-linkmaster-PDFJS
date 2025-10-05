import { HighlightActionMenu } from './highlight-action-menu.js';

describe('HighlightActionMenu', () => {
  let callbacks;
  let menu;
  let container;
  let annotation;

  beforeEach(() => {
    callbacks = {
      onDelete: jest.fn(),
      onCopy: jest.fn(),
      onColorChange: jest.fn(),
      onJump: jest.fn(),
      onTranslate: jest.fn()
    };

    menu = new HighlightActionMenu({
      colorPresets: ['#ffeb3b', '#4caf50'],
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      ...callbacks
    });

    container = document.createElement('div');
    container.className = 'text-highlight-container';
    document.body.appendChild(container);

    annotation = {
      id: 'ann-test',
      pageNumber: 1,
      data: {
        selectedText: 'Hello World',
        highlightColor: '#ffeb3b'
      }
    };
  });

  afterEach(() => {
    menu.destroy();
    document.body.innerHTML = '';
  });

  it('renders action buttons and triggers callbacks', () => {
    const meta = {
      boundingBox: { left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 }
    };

    const actionElements = menu.attach(container, annotation, meta);

    expect(actionElements.wrapper).toBeInstanceOf(HTMLElement);
    expect(actionElements.toolbar.querySelectorAll('[data-action]').length).toBe(5);

    actionElements.toolbar.querySelector('[data-action="delete"]').click();
    expect(callbacks.onDelete).toHaveBeenCalledWith(annotation);

    actionElements.toolbar.querySelector('[data-action="copy"]').click();
    expect(callbacks.onCopy).toHaveBeenCalledWith(annotation);

    // 打开调色板并点击第二个颜色
    const colorToggle = actionElements.toolbar.querySelector('[data-action="color"]');
    colorToggle.click();

    const colorOption = actionElements.toolbar.querySelector('[data-color="#4caf50"]');
    expect(colorOption).not.toBeNull();
    colorOption.click();
    expect(callbacks.onColorChange).toHaveBeenCalledWith(annotation, '#4caf50');

    actionElements.toolbar.querySelector('[data-action="jump"]').click();
    expect(callbacks.onJump).toHaveBeenCalledWith(annotation);

    actionElements.toolbar.querySelector('[data-action="translate"]').click();
    expect(callbacks.onTranslate).toHaveBeenCalledWith(annotation);
  });
});
