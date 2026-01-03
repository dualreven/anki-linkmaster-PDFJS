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
    _count() {
      return subs.size;
    }
  };
}

function createStubPdfjsEventBus() {
  const listeners = new Map();
  return {
    on(name, handler) {
      const key = `${name}:${String(handler)}`;
      listeners.set(key, { name, handler });
    },
    off(name, handler) {
      const key = `${name}:${String(handler)}`;
      listeners.delete(key);
    },
    _count() {
      return listeners.size;
    }
  };
}

describe("CommentTool.destroy()", () => {
  test("destroy() 不抛异常，且会清理 eventBus 订阅", async () => {
    const eventBus = createStubEventBus();
    const pdfjsEventBus = createStubPdfjsEventBus();

    const tool = new CommentTool();
    await tool.initialize({
      eventBus,
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      pdfViewerManager: {
        eventBus: pdfjsEventBus,
        currentPageNumber: 1,
        getPageView() {
          return { div: document.createElement("div") };
        }
      },
      container: {
        get(name) {
          if (name === "annotationManager") {
            return { getAnnotationsByPage() { return []; } };
          }
          return null;
        }
      }
    });

    expect(eventBus._count()).toBeGreaterThan(0);

    expect(() => tool.destroy()).not.toThrow();

    expect(eventBus._count()).toBe(0);
  });
});
