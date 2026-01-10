/* @jest-environment jsdom */

jest.mock("../../../../../../common/utils/logger.js", () => {
  return {
    getLogger: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    setModuleLogLevel: jest.fn(),
    LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
  };
});

import { ObservableState } from "../../../../../../common/utils/observable.js";
import { Annotation, AnnotationType } from "../../../../../../common/models/annotation.js";
import { CommentTool } from "../index.js";

function createStubEventBus() {
  const subs = new Map();
  let seq = 0;
  return {
    on(eventName, handler) {
      const id = String(++seq);
      subs.set(id, { eventName, handler, kind: "local" });
      return () => subs.delete(id);
    },
    onGlobal(eventName, handler) {
      const id = String(++seq);
      subs.set(id, { eventName, handler, kind: "global" });
      return () => subs.delete(id);
    },
    emit() {},
    emitGlobal() {},
    _count() { return subs.size; },
  };
}

function createStubPdfjsEventBus() {
  return { on() {}, off() {} };
}

function createCommentAnnotation({ id = "ann-comment-1", pageNumber = 1, xPercent = 10, yPercent = 20, content = "c1" } = {}) {
  return new Annotation({
    id,
    type: AnnotationType.COMMENT,
    pageNumber,
    data: {
      content,
      position: { x: xPercent, y: yPercent },
      positionPercent: { xPercent, yPercent },
    },
  });
}

describe("CommentTool（store-reactive）", () => {
  test("不依赖 DATA.LOADED：store 更新即可渲染并可删除 marker", async () => {
    document.body.innerHTML = "";

    const page = document.createElement("div");
    page.className = "page";
    page.dataset.pageNumber = "1";
    page.style.width = "100px";
    page.style.height = "100px";
    document.body.appendChild(page);

    const store = new ObservableState({ annotations: [] }, { name: "TestAnnotationStore" });
    const annotationManager = {
      store,
      getAnnotationsByPage(pageNumber) {
        return store.get().annotations.filter((a) => a.pageNumber === pageNumber);
      }
    };

    const tool = new CommentTool();
    await tool.initialize({
      eventBus: createStubEventBus(),
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      pdfViewerManager: {
        eventBus: createStubPdfjsEventBus(),
        currentPageNumber: 1,
        getPageView() { return { div: page }; }
      },
      container: {
        get(name) {
          if (name === "annotationManager") { return annotationManager; }
          return null;
        }
      }
    });

    expect(document.querySelectorAll(".comment-marker").length).toBe(0);

    const a1 = createCommentAnnotation({ id: "ann-comment-1" });
    store.set({ annotations: [a1] });

    expect(document.querySelectorAll(".comment-marker").length).toBe(1);
    expect(document.querySelector(".comment-marker")?.dataset?.annotationId).toBe("ann-comment-1");

    store.set({ annotations: [] });
    expect(document.querySelectorAll(".comment-marker").length).toBe(0);

    tool.destroy();
  });
});

