import { EventBus } from "../../../common/event/event-bus.js";
import { getLogger } from "../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { handleViewerWsInbound } from "../ws-inbound-bridge.js";
import { __resetWsInboundBridgeContractForTests } from "../ws-inbound-bridge-contract.js";

describe("WS 入站桥接契约：同一 message 仅一次 SUCCESS", () => {
  beforeEach(() => {
    __resetWsInboundBridgeContractForTests();
  });

  test("OUTLINE_LIST_COMPLETED 不会触发两次 OUTLINE.LOAD.SUCCESS（多订阅者）", () => {
    const logger = getLogger("test");
    const bus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger });
    const wsClient = { request: jest.fn(), send: jest.fn() };

    // 模拟“多层消费”：同一个 inbound bridge 被装配两次
    bus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        handleViewerWsInbound({ message, eventBus: bus, wsClient, logger });
      },
      { subscriberId: "inbound-A" }
    );
    bus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        handleViewerWsInbound({ message, eventBus: bus, wsClient, logger });
      },
      { subscriberId: "inbound-B" }
    );

    const onSuccess = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, onSuccess, { subscriberId: "assert" });

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "o1", name: "A", pageAt: 1, position: null, children: [] }] }
    };
    bus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("ANCHOR_LIST_COMPLETED 不会触发两次 ANCHOR.DATA.LOADED（多订阅者）", () => {
    const logger = getLogger("test");
    const bus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger });
    const wsClient = { request: jest.fn(), send: jest.fn() };

    bus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        handleViewerWsInbound({ message, eventBus: bus, wsClient, logger });
      },
      { subscriberId: "inbound-A" }
    );
    bus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        handleViewerWsInbound({ message, eventBus: bus, wsClient, logger });
      },
      { subscriberId: "inbound-B" }
    );

    const onLoaded = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, onLoaded, { subscriberId: "assert" });

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_COMPLETED,
      data: { anchors: [{ uuid: "a1" }, { uuid: "a2" }] }
    };
    bus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});

