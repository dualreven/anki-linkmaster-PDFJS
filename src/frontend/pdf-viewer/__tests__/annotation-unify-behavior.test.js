/* eslint-env node */
/**
 * Annotation unify behavior - static conformance tests
 * 目标：确保三类标注在“补画/入队回放/统一调用”方面具备一致的基础能力。
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

function readUtf8(p) {
  return readFileSync(p, { encoding: "utf8" });
}

describe("annotation unify behavior (static checks)", () => {
  const base = resolve(process.cwd(), "src/frontend/pdf-viewer");

  test("AnnotationFeature ensures overlays for screenshot/highlight/comment", () => {
    const p = resolve(base, "features/pdf-annotation/index.js");
    const text = readUtf8(p);
    expect(text.includes("toolRegistry.get?.(\"screenshot\")")).toBe(true);
    expect(text.includes("toolRegistry.get?.(\"text-highlight\")")).toBe(true);
    expect(text.includes("toolRegistry.get?.(\"comment\")")).toBe(true);
    expect(/commentTool\?\.\s*ensureOverlayFor/.test(text)).toBe(true);
  });

  test("AnnotationFeature sets log level override for CommentTool", () => {
    const p = resolve(base, "features/pdf-annotation/index.js");
    const text = readUtf8(p);
    expect(text.includes("setModuleLogLevel(\"CommentTool\"")).toBe(true);
  });

  test("CommentTool implements ensureOverlayFor + pending queue + DATA.LOADED listener", () => {
    const p = resolve(base, "features/pdf-annotation/tools/comment/index.js");
    const text = readUtf8(p);
    expect(text.includes("ensureOverlayFor(annotation)")).toBe(true);
    expect(text.includes("#pendingMarkersByPage")).toBe(true);
    expect(text.includes("ANNOTATION.DATA.LOADED")).toBe(true);
    // pagerendered flush + restore
    expect(text.includes("#flushPendingForPage(")).toBe(true);
  });
});
