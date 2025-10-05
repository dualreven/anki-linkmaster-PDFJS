import {
  findPageElement,
  extractPageNumber,
  rectToPercent,
  calculateLineRects,
  buildSelectionSnapshot
} from './selection-utils.js';

describe('selection-utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('findPageElement returns closest .page element', () => {
    const page = document.createElement('div');
    page.className = 'page';
    page.dataset.pageNumber = '3';
    const span = document.createElement('span');
    page.appendChild(span);
    document.body.appendChild(page);

    expect(findPageElement(span)).toBe(page);
    expect(findPageElement(document.body)).toBe(null);
  });

  test('extractPageNumber parses data attribute', () => {
    const page = document.createElement('div');
    page.dataset.pageNumber = '5';
    expect(extractPageNumber(page)).toBe(5);
    page.dataset.pageNumber = 'abc';
    expect(extractPageNumber(page)).toBeNull();
  });

  test('rectToPercent converts viewport rect to percent and clamps', () => {
    const pageRect = { left: 0, top: 0, width: 200, height: 400 };
    const rect = { left: 100, top: 200, width: 50, height: 40 };
    const result = rectToPercent(rect, pageRect);
    expect(result).toEqual({
      xPercent: 50,
      yPercent: 50,
      widthPercent: 25,
      heightPercent: 10
    });
  });

  test('calculateLineRects uses client rects and fallback', () => {
    const range = {
      getClientRects: () => [{ left: 110, top: 210, width: 40, height: 20 }]
    };
    const pageRect = { left: 100, top: 200, width: 200, height: 400 };
    const rects = calculateLineRects(range, pageRect);
    expect(rects).toHaveLength(1);
    expect(rects[0].xPercent).toBeCloseTo(5, 5);

    const emptyRange = { getClientRects: () => [] };
    expect(calculateLineRects(emptyRange, pageRect)).toEqual([]);
  });

  test('buildSelectionSnapshot returns fallback rect when no client rects', () => {
    const page = document.createElement('div');
    page.className = 'page';
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 400 });

    const mockRange = {
      getBoundingClientRect: () => ({ left: 20, top: 40, width: 60, height: 30 }),
      getClientRects: () => []
    };

    const snapshot = buildSelectionSnapshot(mockRange, page);
    expect(snapshot).not.toBeNull();
    expect(snapshot.lineRects).toHaveLength(1);
    expect(snapshot.lineRects[0].widthPercent).toBeCloseTo(30, 5);
  });
});
