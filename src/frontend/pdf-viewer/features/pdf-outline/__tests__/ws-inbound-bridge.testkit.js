import { WEBSOCKET_EVENTS } from "../../../../common/event/event-constants.js";
import { handleViewerWsInbound } from "../../../adapters/ws-inbound-bridge.js";
import { __resetWsInboundBridgeContractForTests } from "../../../adapters/ws-inbound-bridge-contract.js";

export function resetWsInboundBridgeContractForTests() {
  __resetWsInboundBridgeContractForTests();
}

export function installWsInboundBridge({
  eventBus,
  wsClient,
  logger,
  pdfIdProvider,
  destroySignal = null,
  subscriberId = "Test.InboundBridge",
}) {
  if (!eventBus) { throw new Error("[testkit] eventBus is required"); }
  if (!wsClient) { throw new Error("[testkit] wsClient is required"); }
  if (!logger) { throw new Error("[testkit] logger is required"); }
  if (typeof pdfIdProvider !== "function") { throw new Error("[testkit] pdfIdProvider must be a function"); }

  return eventBus.on(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    (message) => {
      handleViewerWsInbound({ message, eventBus, wsClient, logger, pdfIdProvider, destroySignal });
    },
    { subscriberId }
  );
}

