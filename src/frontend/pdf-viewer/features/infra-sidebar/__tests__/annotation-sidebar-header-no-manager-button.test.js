/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

import globalEventBus from "../../../../common/event/event-bus.js";
import { SidebarManagerFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("Annotation sidebar header", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<main><div id=\"viewerContainer\"></div></main>";
  });

  test("does not render legacy manager square button", async () => {
    const container = createContainer({
      annotationSidebarUI: {
        initialize: jest.fn(),
        getContentElement: () => {
          const el = document.createElement("div");
          el.textContent = "annotation";
          return el;
        },
      },
      cardSidebarUI: null,
      translatorSidebarUI: null,
    });

    const feature = new SidebarManagerFeature();
    await feature.install({ globalEventBus, container, logger: console });
    feature.openSidebar("annotation");

    const squareBtn = document.querySelector(".pdf-sidebar-annotation-manager-btn");
    expect(squareBtn).toBeNull();
  });
});
