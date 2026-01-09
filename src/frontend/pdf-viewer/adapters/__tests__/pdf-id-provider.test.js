/**
 * @file pdf-id-provider.test.js
 * @description Test for pdf-id-provider.js
 */

import { createPdfIdProvider } from "../pdf-id-provider.js";

describe("createPdfIdProvider", () => {
  let URLSearchParamsSpy;

  beforeEach(() => {
    // Mock URLSearchParams to control what it returns for "pdf-id"
    URLSearchParamsSpy = jest.spyOn(global, "URLSearchParams").mockImplementation(
      (search) => {
        const original = new jest.requireActual("url").URLSearchParams(search);
        return {
          get: jest.fn((key) => {
            if (key === "pdf-id") {
              // Custom logic for "pdf-id"
              return original.get(key);
            }
            return original.get(key); // Delegate other calls to original
          }),
        };
      }
    );
  });

  afterEach(() => {
    URLSearchParamsSpy.mockRestore();
  });

  test("should return null if pdf-id is not in URL", () => {
    URLSearchParamsSpy.mockImplementationOnce(
      () => ({ get: jest.fn((key) => (key === "pdf-id" ? null : null)) })
    );
    const provider = createPdfIdProvider();
    expect(provider()).toBeNull();

    URLSearchParamsSpy.mockImplementationOnce(
      () => ({ get: jest.fn((key) => (key === "pdf-id" ? null : null)) })
    );
    const provider2 = createPdfIdProvider();
    expect(provider2()).toBeNull();
  });

  test("should return pdf-id from URL if present", () => {
    URLSearchParamsSpy.mockImplementationOnce(
      () => ({ get: jest.fn((key) => (key === "pdf-id" ? "test-pdf-123" : null)) })
    );
    const provider = createPdfIdProvider();
    expect(provider()).toBe("test-pdf-123");
  });

  test("should return pdf-id from URL with multiple params", () => {
    URLSearchParamsSpy.mockImplementationOnce(
      () => ({ get: jest.fn((key) => (key === "pdf-id" ? "another-pdf-id" : null)) })
    );
    const provider = createPdfIdProvider();
    expect(provider()).toBe("another-pdf-id");
  });

  test("should use custom getter if provided", () => {
    const customId = "custom-getter-id";
    const customGetter = jest.fn(() => customId);
    const provider = createPdfIdProvider(customGetter);
    expect(provider()).toBe(customId);
    expect(customGetter).toHaveBeenCalledTimes(1);

    // Ensure it doesn't fall back to URLSearchParams
    URLSearchParamsSpy.mockImplementationOnce(
      () => ({ get: jest.fn((key) => (key === "pdf-id" ? "should-be-ignored" : null)) })
    );
    const provider2 = createPdfIdProvider(customGetter);
    expect(provider2()).toBe(customId);
  });

  test("should handle empty string from custom getter", () => {
    const customGetter = jest.fn(() => "");
    const provider = createPdfIdProvider(customGetter);
    expect(provider()).toBe("");
  });

  test("should handle null from custom getter", () => {
    const customGetter = jest.fn(() => null);
    const provider = createPdfIdProvider(customGetter);
    expect(provider()).toBeNull();
  });
});
