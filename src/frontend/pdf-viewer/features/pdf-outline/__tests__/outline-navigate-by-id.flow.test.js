/**
 * 目的：验证按 ID 导航的挂起-兑现流程，以及“列表已就绪但未找到”时的失败事件
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";

class StubContainer {
  constructor(wsClient, navigationService) { this._store = new Map([["wsClient", wsClient], ["navigationService", navigationService]]); }
  register(k, v) { this._store.set(k, v); }
  registerGlobal(k, v) { this._store.set(k, v); }
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return this._store.get("wsClient"); }
}

describe("按ID导航：挂起等待与失败分支", () => {
  test("列表未就绪时先请求导航，收到列表后应发出 URL_PARAMS.REQUESTED 事件", async () => {
    const wsClient = { request: jest.fn(async () => ({ ok: true })) };
    const navigationService = { navigateTo: jest.fn(async ({ pageAt, position }) => ({ success: true, actualPage: pageAt, actualPosition: position })) };
    const container = new StubContainer(wsClient, navigationService);
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}

    // 监听 URL_PARAMS.REQUESTED 事件（OutlineFeature 的职责是发射此事件）
    const urlParamsRequested = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      (payload) => urlParamsRequested.push(payload),
      { subscriberId: "test-url-params" }
    );

    // 1) 列表未就绪先发导航
    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, { outlineItemId: "outlineItem-TGT00001" }, { actorId: "test" });
    // 2) 随后后端返回列表（含目标）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "outlineItem-TGT00001", name: "目标", pageAt: 3, position: 50, children: [] }] }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    // 验证 OutlineFeature 的职责：发射 URL_PARAMS.REQUESTED 事件
    expect(urlParamsRequested.length).toBe(1);
    expect(urlParamsRequested[0]).toMatchObject({ pageAt: 3, position: 50 });
    // 注意：NAVIGATE.SUCCESS 事件的发射依赖于 URLNavigationFeature 的响应，
    // 在单元测试中（只安装 OutlineFeature）不会触发。
    // 完整的导航流程应在集成测试中验证。
  });

  test("列表已就绪但未找到 ID，应发 FAILED(not_found) 且不调用导航", async () => {
    const wsClient = { request: jest.fn(async () => ({ ok: true })) };
    const navigationService = { navigateTo: jest.fn() };
    const container = new StubContainer(wsClient, navigationService);
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}

    // 先让列表就绪（但不包含目标 ID）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "outlineItem-OTHER", name: "X", pageAt: 1, position: null, children: [] }] }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    let failed = null;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, (d) => { failed = d; }, { subscriberId: "test" });
    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, { outlineItemId: "outlineItem-NOT-EXIST" }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    expect(navigationService.navigateTo).not.toHaveBeenCalled();
    expect(failed).toEqual(expect.objectContaining({ error: "not_found", id: "outlineItem-NOT-EXIST" }));
  });
});

