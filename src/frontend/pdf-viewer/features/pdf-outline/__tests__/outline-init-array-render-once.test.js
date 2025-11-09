/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：首次回执为“数组”（后端已有大纲）时，只渲染一次；渲染后可导航。
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { ScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import FeatureOutline from "../index.js";
import { setCurrentPDFDocument, clearCurrentPDFDocument } from "../../../pdf/current-document-registry.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    register: (k, v) => store.set(k, v),
    registerGlobal: (k, v) => store.set(k, v),
    getWSClient: () => (store.get("wsClient")),
  };
}

describe("Outline 首次列表为数组：只渲染一次并可导航", () => {
  let eventBus;
  let scoped;
  let container;
  let feature;
  let wsClient;
  let navigationService;

  beforeEach(async () => {
    eventBus = new EventBus({ moduleName: "App", enableValidation: true, logger: console });
    scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    try { window.history.pushState({}, "", "http://localhost/pdf-viewer/?pdf-id=TESTPDF_ARRAY"); } catch {}
    wsClient = { request: jest.fn().mockResolvedValue({ ok: true }) };
    navigationService = { navigateTo: jest.fn().mockResolvedValue({ success: true, actualPage: 7, actualPosition: 66 }) };
    container = createContainer({ wsClient, navigationService });

    setCurrentPDFDocument({ getOutline: async () => [] });

    feature = new FeatureOutline();
    await feature.install({ logger: console, globalEventBus: eventBus, scopedEventBus: scoped, container });
  });

  afterEach(() => {
    try { feature?.uninstall?.(); } catch {}
    clearCurrentPDFDocument();
  });

  test("首次数组回执仅渲染一次", async () => {
    let count = 0;
    let last = null;
    scoped.onGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { count += 1; last = data; });

    scoped.emitGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" });
    const items = [{ id: "outlineItem-ARR0001", name: "数组-章", pageAt: 7, position: 66, children: [] }];
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: items }
    });

    await new Promise(r => setTimeout(r, 0));
    expect(count).toBe(1);
    expect(last).not.toBeNull();
    expect(Array.isArray(last.outlineItems)).toBe(true);
    expect(last.outlineItems[0].id).toBe("outlineItem-ARR0001");
  });

  test("数组回执后可导航", async () => {
    scoped.emitGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" });
    const items = [{ id: "outlineItem-ARR0002", name: "数组-章2", pageAt: 7, position: 66, children: [] }];
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: items }
    });
    await new Promise(r => setTimeout(r, 0));

    scoped.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED, { outlineItem: items[0] });
    await Promise.resolve();

    expect(navigationService.navigateTo).toHaveBeenCalledWith({ pageAt: 7, position: 66 });
  });
});

