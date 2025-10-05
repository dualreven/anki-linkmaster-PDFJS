import { getCenterPercentFromRect } from '../position-utils.js';

describe('position-utils#getCenterPercentFromRect', () => {
  test('returns center percent when y and height provided', () => {
    const rect = { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 40 };
    expect(getCenterPercentFromRect(rect)).toBeCloseTo(40, 6);
  });

  test('handles missing height percent by returning top', () => {
    const rect = { yPercent: 12.5 };
    expect(getCenterPercentFromRect(rect)).toBeCloseTo(12.5, 6);
  });

  test('clamps values to valid range', () => {
    expect(getCenterPercentFromRect({ yPercent: -10, heightPercent: 5 })).toBe(0);
    expect(getCenterPercentFromRect({ yPercent: 95, heightPercent: 20 })).toBe(100);
  });

  test('returns null for invalid input', () => {
    expect(getCenterPercentFromRect(null)).toBeNull();
    expect(getCenterPercentFromRect({})).toBeNull();
    expect(getCenterPercentFromRect({ yPercent: 'abc' })).toBeNull();
  });
});
