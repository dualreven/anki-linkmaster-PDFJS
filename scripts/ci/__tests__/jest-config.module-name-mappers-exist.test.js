import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("jest.config.js moduleNameMapper targets", () => {
  test("mapped mock files exist and jest.config.js points to them", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../../");
    const configPath = path.resolve(repoRoot, "jest.config.js");
    const text = readFileSync(configPath, "utf8");

    const required = [
      "<rootDir>/src/frontend/__mocks__/logger.js",
      "<rootDir>/src/frontend/__mocks__/pdfjs-dist.js",
      "<rootDir>/src/frontend/__mocks__/pdfjs-web-viewer.js",
      "<rootDir>/src/frontend/__mocks__/styleMock.js",
    ];

    for (const mapped of required) {
      expect(text).toContain(mapped);
      const abs = path.resolve(repoRoot, mapped.replace("<rootDir>/", ""));
      expect(existsSync(abs)).toBe(true);
    }
  });
});
