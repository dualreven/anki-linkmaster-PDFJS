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

  it('returns container and bounding box when rendering percent rects', () => {
    const renderer = new HighlightRenderer(null, logger);
    const lineRects = [
      { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 5 },
      { xPercent: 12, yPercent: 26, widthPercent: 28, heightPercent: 5 }
    ];

    const result = renderer.renderHighlight(1, [], '#ffeb3b', 'ann-test', lineRects);

    expect(result).not.toBeNull();
    expect(result.container).toBeInstanceOf(HTMLElement);
    expect(result.boundingBox.left).toBeCloseTo(60);
    expect(result.boundingBox.top).toBeCloseTo(160);
    expect(result.boundingBox.right).toBeCloseTo(240);
    expect(result.boundingBox.bottom).toBeCloseTo(248);
    expect(result.boundingBox.width).toBeCloseTo(180);
    expect(result.boundingBox.height).toBeCloseTo(88);

    const highlightLayer = document.querySelector('.highlight-layer');
    expect(highlightLayer).not.toBeNull();

    const highlightElements = result.container.querySelectorAll('.text-highlight');
    expect(highlightElements).toHaveLength(2);
  });

  it('replaces existing highlight when rendering same annotation id', () => {
    const renderer = new HighlightRenderer(null, logger);
    const rects = [
      { xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 10 }
    ];

    const first = renderer.renderHighlight(1, [], '#ffeb3b', 'ann-duplicate', rects);
    const second = renderer.renderHighlight(1, [], '#4caf50', 'ann-duplicate', rects);

    expect(first.container.isConnected).toBe(false);
    expect(second.container.dataset.annotationId).toBe('ann-duplicate');

    const containers = document.querySelectorAll('[data-annotation-id="ann-duplicate"]');
    expect(containers).toHaveLength(1);

    const highlight = second.container.querySelector('.text-highlight');
    expect(highlight.style.backgroundColor).toBe('rgb(76, 175, 80)');
  });
});
