import { describe, expect, test } from "@jest/globals";
import { analyzeAnnotationSingleSourceGuard } from "../pdfviewer-annotation-single-source-guard.js";

const targetRelPath = "src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js";

describe("pdfviewer-annotation-single-source-guard", () => {
  test("allows pure re-export from common", () => {
    const code = [
      "/** header */",
      "export { Annotation } from \"../../../../common/models/annotation.js\";",
      "export { default } from \"../../../../common/models/annotation.js\";",
      "",
    ].join("\n");

    const res = analyzeAnnotationSingleSourceGuard({ fileText: code, targetRelPath });
    expect(res.violations).toEqual([]);
  });

  test("blocks export-from to wrong path", () => {
    const code = [
      "export { Annotation } from \"../../../../common/models/annotation-v2.js\";",
      "",
    ].join("\n");

    const res = analyzeAnnotationSingleSourceGuard({ fileText: code, targetRelPath });
    expect(res.violations.some((v) => v.type === "invalid-export-source")).toBe(true);
  });

  test("blocks implementation symbols", () => {
    const code = [
      "export const AnnotationType = { SCREENSHOT: \"screenshot\" };",
      "export class Annotation {}",
      "export { Annotation } from \"../../../../common/models/annotation.js\";",
      "",
    ].join("\n");

    const res = analyzeAnnotationSingleSourceGuard({ fileText: code, targetRelPath });
    expect(res.violations.some((v) => v.type === "has-class-annotation" || v.type === "has-export-class-annotation")).toBe(true);
    expect(res.violations.some((v) => v.type === "has-annotation-type-const")).toBe(true);
  });

  test("blocks import statements", () => {
    const code = [
      "import x from \"y\";",
      "export { Annotation } from \"../../../../common/models/annotation.js\";",
      "",
    ].join("\n");

    const res = analyzeAnnotationSingleSourceGuard({ fileText: code, targetRelPath });
    expect(res.violations.some((v) => v.type === "has-import")).toBe(true);
  });

  test("blocks non-export code", () => {
    const code = [
      "export { Annotation } from \"../../../../common/models/annotation.js\";",
      "const x = 1;",
      "",
    ].join("\n");

    const res = analyzeAnnotationSingleSourceGuard({ fileText: code, targetRelPath });
    expect(res.violations.some((v) => v.type === "has-non-export-code")).toBe(true);
  });
});

