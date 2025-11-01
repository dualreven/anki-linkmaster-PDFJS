/**
 * @file EventBus 事件负载契约校验 - 最小样板测试
 */

import { EventBus } from "../event-bus.js";
import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";
import { createDefaultValidator } from "../../contracts/contract-registry.js";

describe("EventBus 负载契约校验（样板）", () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus({ enableValidation: true, moduleName: "TestBus" });
    bus.setPayloadValidation(true, createDefaultValidator());
  });

  afterEach(() => {
    bus?.destroy();
    bus = null;
  });

  test("无效负载应被阻止发布（BOOKMARK.NAVIGATE_BY_ID.REQUESTED）", () => {
    const handler = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, handler, { subscriberId: "s1" });

    // 缺少 outlineItemId
    bus.emit(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, {}, { actorId: "Tester" });

    expect(handler).not.toHaveBeenCalled();
  });

  test("有效负载应正常传递给订阅者", () => {
    const handler = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, handler, { subscriberId: "s1" });

    bus.emit(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, { outlineItemId: "outlineItem-abc123" }, { actorId: "Tester" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ outlineItemId: "outlineItem-abc123" });
  });
});

