/**

 * WSClient (moved)

 */

import Logger from "../utils/logger.js";

import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
} from "../event/event-constants.js";

export class WSClient {
  #url;
  #eventBus;
  #logger;
  #socket = null;
  #isConnectedFlag = false;
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectDelay = 1000;
  #messageQueue = [];

  constructor(url, eventBus) {
    this.#url = url;
    this.#eventBus = eventBus;
    this.#logger = new Logger("WSClient");
    this.#setupEventListeners();
  }

  #setupEventListeners() {
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      (message) => {
        this.#logger.info(
          `Received request to send message: ${JSON.stringify(
            message,
            null,
            2
          )}`
        );
        this.send(message);
      },
      { subscriberId: "WSClient" }
    );
  }

  connect() {
    try {
      this.#logger.info(`Connecting to WebSocket server: ${this.#url}`);
      this.#socket = new WebSocket(this.#url);
      this.#attachSocketHandlers();
    } catch (error) {
      this.#logger.error("Failed to initiate WebSocket connection.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
        actorId: "WSClient",
      });
    }
  }

  disconnect() {
    if (this.#socket) {
      this.#logger.info("Disconnecting WebSocket.");
      this.#socket.close(1000, "Client initiated disconnect.");
      this.#socket = null;
      this.#isConnectedFlag = false;
    }
  }

  isConnected() {
    return this.#isConnectedFlag && this.#socket?.readyState === WebSocket.OPEN;
  }

  send({ type, data = {} }) {
    const message = { type, data, timestamp: new Date().toISOString() };
    if (this.isConnected()) {
      try {
        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`Sent message: ${type}`);
      } catch (error) {
        this.#logger.error(`Failed to send message: ${type}`, error);
        this.#eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
          { type, error },
          { actorId: "WSClient" }
        );
      }
    } else {
      this.#messageQueue.push(message);
      this.#logger.debug(`Message queued, connection not available: ${type}`);
    }
  }

  #attachSocketHandlers() {
    this.#socket.onopen = () => {
      this.#logger.info("WebSocket connection established.");
      this.#isConnectedFlag = true;
      this.#reconnectAttempts = 0;
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, undefined, {
        actorId: "WSClient",
      });
      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = () => {
      this.#logger.warn("WebSocket connection closed.");
      this.#isConnectedFlag = false;
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED, undefined, {
        actorId: "WSClient",
      });
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      this.#logger.error("WebSocket connection error.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, error, {
        actorId: "WSClient",
      });
    };
  }

  #handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.#logger.debug(`Received message: ${message.type}`, message);
      this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, {
        actorId: "WSClient",
      });
      let targetEvent = null;
      switch (message.type) {
        case "pdf_list_updated":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED;
          break;
        case "pdf_list":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST;
          break;
        case "success":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.SUCCESS;
          break;
        case "error":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case "response":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        default:
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.UNKNOWN;
          this.#logger.warn(`Unknown message type: ${message.type}`);
      }

      if (targetEvent) {
        this.#logger.debug(`Routing message to event: ${targetEvent}`);
        this.#eventBus.emit(targetEvent, message, { actorId: "WSClient" });
      }
    } catch (error) {
      this.#logger.error("Failed to parse incoming WebSocket message.", error);
    }
  }

  #attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      this.#logger.error("Max WebSocket reconnect attempts reached.");
      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED, undefined, {
        actorId: "WSClient",
      });
      return;
    }
    this.#reconnectAttempts++;
    this.#logger.info(
      `Attempting to reconnect (${this.#reconnectAttempts}/${
        this.#maxReconnectAttempts
      })...`
    );
    setTimeout(
      () => this.connect(),
      this.#reconnectDelay * this.#reconnectAttempts
    );
  }

  #flushMessageQueue() {
    this.#logger.info(`Flushing ${this.#messageQueue.length} queued messages.`);
    while (this.#messageQueue.length > 0) {
      const message = this.#messageQueue.shift();
      this.send({ type: message.type, data: message.data });
    }
  }
}

export default WSClient;
