/* @jest-environment jsdom */

import { WEBSOCKET_EVENTS } from "../../../../common/event/event-constants.js";
import FeatureOutline from "../index.js";

function createContainer(wsClient) {
  const store = new Map();
  if (wsClient) { store.set("wsClient", wsClient); }
  return {
    get(key) { return store.get(key); },
    resolve(key) { return store.get(key); },
    registerGlobal(key, value) { store.set(key, value); },
    register(key, value) { store.set(key, value); },
  };
}

describe("OutlineFeature — WS 解耦", () => {
  test("install 不应订阅 WEBSOCKET_EVENTS.MESSAGE.RECEIVED", async () => {
    global.window.__DISABLE_OUTLINE_UI = true;
    const subscribed = [];
    const eventBus = {
      onGlobal(eventName) {
        subscribed.push(eventName);
        return () => {};
      },
      on(eventName) {
        subscribed.push(eventName);
        return () => {};
      },
      emit() {},
      emitGlobal() {},
    };

    const wsClient = { request: jest.fn(async () => ({})) };
    const feature = new FeatureOutline();
    await feature.install({
      scopedEventBus: eventBus,
      globalEventBus: eventBus,
      logger: console,
      container: createContainer(wsClient),
    });

    expect(subscribed).not.toContain(WEBSOCKET_EVENTS.MESSAGE.RECEIVED);
  });
});

