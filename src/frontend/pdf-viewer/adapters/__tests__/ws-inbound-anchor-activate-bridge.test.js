/* @jest-environment jsdom */
/**
 * 目的：验证 WS 入站 anchor:activate:completed 消息的桥接行为：
 * - 应转译为 ANCHOR.NAVIGATE.REQUESTED（source 标记为 ws-anchor-activate）；
 * - 不应直接发出 ANCHOR.ACTIVATED（激活逻辑由 PDFAnchorFeature 统一处理，并受 resume 门控）。
 */
import { jest } from "@jest/globals";
jest.mock("../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { EventBus } from "../../../common/event/event-bus.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { handleViewerWsInbound } from "../ws-inbound-bridge.js";

describe("ws-inbound-bridge - ANCHOR_ACTIVATE_COMPLETED → ANCHOR.NAVIGATE.REQUESTED", () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ moduleName: "test-bus", enableValidation: true, logger: console });
  });

  test("anchor:activate:completed 应仅发出 ANCHOR.NAVIGATE.REQUESTED，而不是 ANCHOR.ACTIVATED", () => {
    const navigatePayloads = [];
    const activatedPayloads = [];

    eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      (data) => navigatePayloads.push(data),
      { subscriberId: "test-navigate" }
    );
    eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      (data) => activatedPayloads.push(data),
      { subscriberId: "test-activated" }
    );

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE_COMPLETED,
      data: { anchor_id: "pdfanchor-aaaaaaaaaaaa", active: true },
    };

    handleViewerWsInbound({
      message,
      eventBus,
      wsClient: { request: jest.fn(), send: jest.fn() },
      logger: console,
    });

    expect(navigatePayloads).toHaveLength(1);
    expect(navigatePayloads[0]).toMatchObject({
      anchorId: "pdfanchor-aaaaaaaaaaaa",
      source: "ws-anchor-activate",
    });
    expect(activatedPayloads).toHaveLength(0);
  });
});

