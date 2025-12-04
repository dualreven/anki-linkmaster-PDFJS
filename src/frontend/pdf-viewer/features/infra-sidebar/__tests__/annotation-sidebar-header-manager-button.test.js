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
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

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

  test("annotation sidebar header has manager square button near close and emits anno-manager open event", async () => {
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

    // 设定 URL，提供 pdf-id，便于后续事件和 WS 桥接使用
    try {
      window.history.pushState({}, "", "/pdf-viewer/?pdf-id=jest-pdf-001");
    } catch {}

    const emitSpy = jest.spyOn(globalEventBus, "emit");

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

    // 应该触发全局事件，用于通过 WebSocketAdapter 打开 anno-manager 窗口
    const openCall = emitSpy.mock.calls.find(
      ([eventName]) => eventName === PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED
    );
    expect(openCall).toBeTruthy();

    const payload = openCall[1];
    expect(payload).toEqual(expect.objectContaining({ pdfId: "jest-pdf-001" }));

    // 仍然保留 toast 反馈，提示用户已点击按钮
    expect(showInfo).toHaveBeenCalled();
  });
});
