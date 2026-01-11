/**
 * @jest-environment jsdom
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SearchFeature } from "../index.js";

function createMockEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    on: jest.fn((event, handler) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
      return () => set.delete(handler);
    }),
    emit(event, payload, meta) {
      void payload;
      void meta;
      const set = listeners.get(event);
      if (!set) {
        return;
      }
      for (const handler of Array.from(set)) {
        handler(payload);
      }
    },
  };
}

function createMockContainer(pdfViewerManager) {
  /** @type {Map<string, any>} */
  const registry = new Map();

  return {
    resolve: (key) => {
      if (key === "pdfViewerManager") {
        return pdfViewerManager;
      }
      return registry.get(key);
    },
    register: (key, value) => {
      registry.set(key, value);
    },
    _get: (key) => registry.get(key),
  };
}

describe("SearchFeature — SEARCH.UI.OPEN subscription cleanup", () => {
  test("install 后 emit OPEN 会让 searchManager.isVisible=true", async () => {
    document.body.innerHTML = "";

    const globalEventBus = createMockEventBus();
    const container = createMockContainer({});
    const feature = new SearchFeature();

    await feature.install({ container, globalEventBus });

    const searchManager = container._get("searchManager");
    expect(searchManager).toBeTruthy();
    expect(searchManager.store.get().isVisible).toBe(false);

    globalEventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, {}, { actorId: "test" });
    expect(searchManager.store.get().isVisible).toBe(true);

    await feature.uninstall({});
  });

  test("uninstall 后 emit OPEN 不应再改变 searchManager.isVisible", async () => {
    document.body.innerHTML = "";

    const globalEventBus = createMockEventBus();
    const container = createMockContainer({});
    const feature = new SearchFeature();

    await feature.install({ container, globalEventBus });

    const searchManager = container._get("searchManager");
    searchManager.setVisible(false);

    await feature.uninstall({});

    globalEventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, {}, { actorId: "test" });
    expect(searchManager.store.get().isVisible).toBe(false);
  });
});

