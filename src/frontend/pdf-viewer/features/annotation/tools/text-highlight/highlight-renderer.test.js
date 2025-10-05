import { HighlightRenderer } from './highlight-renderer.js';

describe('HighlightRenderer', () => {
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    document.body.innerHTML = `
      <div id="viewerContainer">
        <div class="page" data-page-number="1" style="position: relative; width: 600px; height: 800px;">
          <div class="textLayer"></div>
        </div>
      </div>
    `;

    const page = document.querySelector('.page');
    Object.defineProperty(page, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(page, 'clientHeight', { configurable: true, value: 800 });
    page.getBoundingClientRect = () => ({
      width: 600,
      height: 800,
      left: 0,
      top: 0
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders highlight using lineRects percent coordinates', () => {
    const renderer = new HighlightRenderer(null, logger);
    const lineRects = [
      { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 5 }
    ];

    const container = renderer.renderHighlight(1, [], '#ffeb3b', 'ann-test', lineRects);

    expect(container).not.toBeNull();

    const highlightLayer = document.querySelector('.highlight-layer');
    expect(highlightLayer).not.toBeNull();

    const highlight = container.querySelector('.text-highlight');
    expect(highlight).not.toBeNull();
    expect(highlight.style.left).toBe('60px');
    expect(highlight.style.top).toBe('160px');
    expect(highlight.style.width).toBe('180px');
    expect(highlight.style.height).toBe('40px');
  });
});
