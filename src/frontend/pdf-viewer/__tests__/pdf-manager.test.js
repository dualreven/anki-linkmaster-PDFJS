/**
 * @jest-environment jsdom
 *
 * 说明：
 * - 该文件对齐当前重构版 PDFManager（src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js）的公开行为；
 * - 不断言具体 logger 文案（logger 在测试环境下会被统一 mock/映射）。
 */
import { describe, beforeEach, test, expect, jest } from "@jest/globals";

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { PDFManager } from "../pdf-manager.js";

jest.mock("pdfjs-dist/build/pdf", () => {
  const mockDocument = {
    numPages: 10,
    getPage: jest.fn().mockResolvedValue({ cleanup: jest.fn() }),
    destroy: jest.fn().mockResolvedValue(undefined)
  };

  return {
    version: "0-test",
    build: "test",
    GlobalWorkerOptions: {
      workerSrc: "",
      standardFontDataUrl: "",
      disableWebGL: false,
      enableWebGL: true
    },
    setPreferences: jest.fn(),
    getDocument: jest.fn().mockImplementation(() => ({
      promise: Promise.resolve(mockDocument)
    }))
  };
});

describe("PDFManager（重构版）", () => {
  let eventBus;
  let pdfManager;

  beforeEach(() => {
    eventBus = {
      on: jest.fn(),
      emit: jest.fn()
    };
    pdfManager = new PDFManager(eventBus);
    jest.clearAllMocks();
  });

  test("initialize() 完成后会注册 FILE.LOAD.REQUESTED 监听", async () => {
    await pdfManager.initialize();
    expect(eventBus.on).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      expect.any(Function),
      expect.objectContaining({ subscriberId: "PDFManager" })
    );
  });

  test("loadPDF(url) 成功后发射 FILE.LOAD.SUCCESS 并返回文档", async () => {
    await pdfManager.initialize();
    const fileData = { filename: "test.pdf", url: "https://example.com/test.pdf", pdfId: "test-id" };

    const doc = await pdfManager.loadPDF(fileData);

    expect(doc).toBeTruthy();
    expect(doc.numPages).toBe(10);
    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      expect.objectContaining({
        pdfDocument: doc,
        pdfId: "test-id",
        filename: "test.pdf"
      }),
      expect.any(Object)
    );
  });

  test("getPage() 会缓存页面，重复请求不会再次调用 pdfDocument.getPage", async () => {
    await pdfManager.initialize();
    const doc = await pdfManager.loadPDF({ filename: "test.pdf", url: "https://example.com/test.pdf" });

    await pdfManager.getPage(1);
    await pdfManager.getPage(1);

    const callsForPage1 = doc.getPage.mock.calls.filter((c) => c?.[0] === 1).length;
    expect(callsForPage1).toBe(1);
  });

  test("closePDF() 会清空缓存（getCacheStats.totalCached 归零）", async () => {
    await pdfManager.initialize();
    await pdfManager.loadPDF({ filename: "test.pdf", url: "https://example.com/test.pdf" });
    await pdfManager.getPage(1);

    expect(pdfManager.getCacheStats().totalCached).toBe(1);
    pdfManager.closePDF();
    expect(pdfManager.getCacheStats().totalCached).toBe(0);
  });
});
