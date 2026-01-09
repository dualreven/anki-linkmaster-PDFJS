/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

/**
 * 回归目标：
 * - toggle/open/close 能工作；
 * - uninstall 后必须清理：
 *   1) EventBus 订阅（emit 不再触发 open/toggle/close handler）
 *   2) document 级 mousemove/mouseup 监听（removeEventListener 对应解绑）
 *   3) DOM（侧边栏容器/按钮容器不应残留）
 */

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SidebarManagerFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("SidebarManagerFeature — toggle/open/close + uninstall 清理", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<main><div id=\"viewerContainer\"></div></main>";
    // 测试期望：未预先存在按钮容器
    const old = document.getElementById("pdf-viewer-button-container");
    if (old) { old.remove(); }
  });

  test("uninstall 后不再响应 EventBus，且拖拽中途卸载会解绑 document mousemove/mouseup 监听", async () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const container = createContainer({
      annotationSidebarUI: null,
      cardSidebarUI: null,
      translatorSidebarUI: null,
      outlineSidebarUI: null,
      anchorSidebarUI: null,
      aiAssistantSidebarUI: null,
    });

    const feature = new SidebarManagerFeature();
    const openSpy = jest.spyOn(feature, "openSidebar");
    const toggleSpy = jest.spyOn(feature, "toggleSidebar");
    const closeSpy = jest.spyOn(feature, "closeSidebar");

    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    // open/close/toggle 基本链路（直接调用方法，避免依赖异步 setTimeout 的按钮创建）
    feature.openSidebar("outline");
    feature.closeSidebar("outline");
    feature.toggleSidebar("outline");

    expect(openSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(toggleSpy).toHaveBeenCalled();

    // 触发一次拖拽开始（mousedown）→ DraggableResizer 会在 document 上绑定 mousemove/mouseup
    const handle = document.querySelector(".sidebar-resize-handle");
    expect(handle).toBeTruthy();
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, bubbles: true }));

    const mousemoveHandler = addSpy.mock.calls.find((c) => c[0] === "mousemove")?.[1];
    const mouseupHandler = addSpy.mock.calls.find((c) => c[0] === "mouseup")?.[1];
    expect(typeof mousemoveHandler).toBe("function");
    expect(typeof mouseupHandler).toBe("function");

    await feature.uninstall();

    // 解绑断言：要求按同一 handler 引用 removeEventListener
    expect(removeSpy).toHaveBeenCalledWith("mousemove", mousemoveHandler);
    expect(removeSpy).toHaveBeenCalledWith("mouseup", mouseupHandler);

    // DOM：侧边栏容器应清理（按钮容器也不应残留）
    expect(document.getElementById("unified-sidebar-container")).toBeNull();
    expect(document.getElementById("pdf-viewer-button-container")).toBeNull();

    // uninstall 后不应再响应 EventBus
    openSpy.mockClear();
    toggleSpy.mockClear();
    closeSpy.mockClear();

    globalEventBus.emit(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED,
      { sidebarId: "outline" },
      { actorId: "test" }
    );
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED,
      { sidebarId: "outline" },
      { actorId: "test" }
    );
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSE_REQUESTED,
      { sidebarId: "outline" },
      { actorId: "test" }
    );

    expect(openSpy).not.toHaveBeenCalled();
    expect(toggleSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
