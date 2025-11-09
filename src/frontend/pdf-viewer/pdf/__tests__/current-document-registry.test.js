/**
 * 目的：pdf current-document-registry 核心行为
 */
import { setCurrentPDFDocument, getCurrentPDFDocument, clearCurrentPDFDocument } from "../current-document-registry.js";

describe("current-document-registry", () => {
  test("set/get/clear 正常工作", () => {
    expect(getCurrentPDFDocument()).toBeNull();
    const doc = { id: "pdf-1", getOutline: async () => [] };
    setCurrentPDFDocument(doc);
    expect(getCurrentPDFDocument()).toBe(doc);
    clearCurrentPDFDocument();
    expect(getCurrentPDFDocument()).toBeNull();
  });
});

