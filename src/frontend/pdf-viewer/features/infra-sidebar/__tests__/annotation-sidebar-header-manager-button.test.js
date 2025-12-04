/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" }
}));
jest.mock("../../../../common/utils/notification.js", () => ({
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showError: jest.fn()
}));

import globalEventBus from "../../../../common/event/event-bus.js";
import { SidebarManagerFeature } from "../index.js";
import { showInfo } from "../../../../common/utils/notification.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v)
  };
}

describe("SidebarManagerFeature annotation header manager button", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<main><div id=\"viewerContainer\"></div></main>";
    jest.clearAllMocks();
  });

  test("annotation sidebar header has manager square button near close and triggers toast", async () => {
    const container = createContainer({
      annotationSidebarUI: {
        initialize: jest.fn(),
        getContentElement: () => {
          const el = document.createElement("div");
          el.textContent = "annotation";
          return el;
        }
      },
      cardSidebarUI: null,
      translatorSidebarUI: null
    });

    const feature = new SidebarManagerFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console
    });

    feature.openSidebar("annotation");

    const panel = document.querySelector("[data-sidebar-id=\"annotation\"]");
    expect(panel).not.toBeNull();

    const header = panel.querySelector(".sidebar-header");
    expect(header).not.toBeNull();

    const managerBtn = header.querySelector(".pdf-sidebar-annotation-manager-btn");
    expect(managerBtn).not.toBeNull();

    const closeButtons = header.querySelectorAll(".sidebar-close-btn");
    expect(closeButtons.length).toBe(1);

    managerBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(showInfo).toHaveBeenCalledWith("标注管理器按钮已点击（开发中...）", 2500);
  });
});
