import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";

describe("PDF_VIEWER_EVENTS constants", () => {
  it("keeps key event strings stable", () => {
    expect(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED).toBe("pdf-viewer:file:load-requested");
    expect(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS).toBe("pdf-viewer:file:load-success");
    expect(PDF_VIEWER_EVENTS.NAVIGATION.GOTO).toBe("pdf-viewer:navigation:goto");
    expect(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED).toBe("pdf-viewer:render-page:completed");
    expect(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED).toBe("annotation-data:load:success");
    expect(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS).toBe("annotation-navigation:jump:success");
    expect(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.TEXT_LAYER_RENDERED).toBe("textlayerrendered");
    expect(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE).toBe("resume:flow:done");
    expect(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED).toBe("anchor-data:load:success");
  });
});

