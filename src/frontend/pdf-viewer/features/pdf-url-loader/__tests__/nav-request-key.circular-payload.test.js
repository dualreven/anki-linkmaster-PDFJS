/* @jest-environment jsdom */
import { buildNavigationRequestKey } from "../components/nav-request-key.js";

describe("pdf-url-loader/buildNavigationRequestKey (regression)", () => {
  test("circular payload should throw (fail-fast) instead of JSON.stringify crashing", () => {
    const params = { pageAt: 1 };
    params.position = params; // circular

    expect(() => buildNavigationRequestKey(params)).toThrow("invalid position");
  });
});

