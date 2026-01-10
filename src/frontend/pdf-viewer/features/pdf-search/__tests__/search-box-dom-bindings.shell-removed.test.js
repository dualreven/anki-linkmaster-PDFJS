import fs from "node:fs";
import path from "node:path";

function readAllFilesRecursively(rootDir) {
  /** @type {string[]} */
  const files = [];

  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };

  walk(rootDir);
  return files;
}

describe("pdf-search — dom-bindings shell removed regression", () => {
  test("no source file references search-box-dom-bindings.js", () => {
    const pdfSearchRoot = path.resolve(__dirname, "..");
    const files = readAllFilesRecursively(pdfSearchRoot);

    /** @type {string[]} */
    const violations = [];
    for (const filePath of files) {
      const normalized = filePath.replaceAll("\\", "/");
      if (normalized.includes("/node_modules/")) {
        continue;
      }
      // Only guard source files; tests are allowed to mention the old filename for assertions.
      if (normalized.includes("/__tests__/")) {
        continue;
      }
      const content = fs.readFileSync(filePath, { encoding: "utf8" });
      if (content.includes("search-box-dom-bindings")) {
        violations.push(normalized);
      }
    }

    expect(violations).toEqual([]);
  });
});
