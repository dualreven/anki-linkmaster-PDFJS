/** @jest-environment jsdom */
/**
 * 启动路由测试 — outline-item-id
 * 目标：启动时 URL 含 outline-item-id，经 URLNavigationFeature 解析后，
 * 由 URLJumpDispatcher 发出 BOOKMARK.NAVIGATE_BY_ID.REQUESTED（不依赖 PDF.js）。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SimpleDependencyContainer } from "../../../container/simple-dependency-container.js";
import { URLNavigationFeature } from "../index.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";

jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

describe("Startup Routing — outline-item-id", () => {
  let globalBus;
  let container;

  beforeEach(() => {
    document.body.innerHTML = "<main></main><div id=\"viewerContainer\"></div>";
    window.history.pushState({}, "", "http://localhost/pdf-viewer/?pdf-id=doc-002&outline-item-id=outline-xyz");
    globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    container = new SimpleDependencyContainer("test");
    container.register("eventBus", globalBus);
    // URLJumpDispatcher 需要 navigationService，用到 pageAt/position 时才调用；这里提供桩即可
    container.register("navigationService", { navigateTo: async () => ({ success: true, actualPage: 1, actualPosition: 0 }) });
  });

  test("安装后应发出 OUTLINE.NAVIGATE_BY_ID.REQUESTED", async () => {
    const spy = jest.fn();
    globalBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, spy, { subscriberId: "test" });
    const feature = new URLNavigationFeature();
    await feature.install({ container });
    // 通过“annotation 数据就绪”门闸（URLNavigationFeature 监听的是 annotation 作用域事件）
    const scopedAnnBus = createScopedEventBus(globalBus, "annotation");
    scopedAnnBus.emit(PDF_VIEWER_EVENTS.NAVIGATION ? PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED : "annotation-data:load:success", { annotations: [], count: 0 });
    // 触发一次文件加载成功（与门闸无强依赖，但贴近真实启动）
    globalBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-002.pdf" });
    expect(spy).toHaveBeenCalled();
    const payload = spy.mock.calls[0][0];
    expect(payload).toEqual({ outlineItemId: "outline-xyz" });
  });
});
