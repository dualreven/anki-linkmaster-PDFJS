/**
 * @file pdf-id-provider.test.js
 * @description Test for pdf-id-provider.js
 */

import { createPdfIdProvider } from "../pdf-id-provider.js";

describe("createPdfIdProvider", () => {
  beforeEach(() => {
  });

  afterEach(() => {
  });

  test("should throw if getter is not provided", () => {
    expect(() => createPdfIdProvider()).toThrow("[PdfIdProvider] getter is required");
  });

  test("should return pdfId from custom getter", () => {
    const customGetter = jest.fn(() => "test-pdf-123");
    const provider = createPdfIdProvider(customGetter);
    expect(provider()).toBe("test-pdf-123");
    expect(customGetter).toHaveBeenCalledTimes(1);
  });

  test("should throw when getter returns empty string", () => {
    const customGetter = jest.fn(() => "");
    const provider = createPdfIdProvider(customGetter);
    expect(() => provider()).toThrow("[PdfIdProvider] pdfId is required");
  });

  test("should throw when getter returns whitespace", () => {
    const customGetter = jest.fn(() => "   ");
    const provider = createPdfIdProvider(customGetter);
    expect(() => provider()).toThrow("[PdfIdProvider] pdfId is required");
  });

  test("should throw when getter returns null", () => {
    const customGetter = jest.fn(() => null);
    const provider = createPdfIdProvider(customGetter);
    expect(() => provider()).toThrow("[PdfIdProvider] pdfId is required");
  });
});
