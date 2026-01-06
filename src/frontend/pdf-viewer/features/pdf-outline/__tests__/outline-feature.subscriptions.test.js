/* @jest-environment jsdom */

jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" }
}));

jest.mock("../services/outline.manager.js", () => ({
  OutlineManager: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}));

jest.mock("../../../outline/components/outline-dialog.js", () => ({
  OutlineDialog: jest.fn().mockImplementation(() => ({
    showAdd: jest.fn(),
    showEdit: jest.fn(),
    showDelete: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock("../../../outline/outline-data-provider.js", () => ({
  OutlineDataProvider: jest.fn().mockImplementation(() => ({
    getOutline: jest.fn(),
    parseDestination: jest.fn()
  }))
}));

jest.mock("../../../pdf/current-document-registry.js", () => ({
  getCurrentPDFDocument: jest.fn(() => ({}))
}));

import { OutlineManager as OutlineFeature } from "../index.js";

function createTestEventBus(unsubCalls) {
  const bus = {
    on(_eventName, _handler) {
      const idx = unsubCalls.length;
      unsubCalls[idx] = 0;
      return () => {
        unsubCalls[idx] += 1;
      };
    },
    onGlobal(...args) {
      return bus.on(...args);
    },
    emit() {},
    emitGlobal() {}
  };
  return bus;
}

function createContainer(wsClient) {
  const store = new Map();
  if (wsClient) {
    store.set("wsClient", wsClient);
  }
  return {
    get(key) {
      return store.get(key);
    },
    resolve(key) {
      return store.get(key);
    },
    registerGlobal(key, value) {
      store.set(key, value);
    }
  };
}

describe("OutlineFeature — 订阅管理", () => {
  test("install + uninstall 会调用通过 on/onGlobal 注册的 unsubscribe", async () => {
    const unsubCalls = [];
    const globalEventBus = createTestEventBus(unsubCalls);
    const wsClient = {
      request: jest.fn().mockResolvedValue({}),
      send: jest.fn()
    };
    const container = createContainer(wsClient);

    const feature = new OutlineFeature();
    await feature.install({
      scopedEventBus: globalEventBus,
      globalEventBus,
      logger: console,
      container
    });

    await feature.uninstall({ logger: console });

    // 至少订阅了若干事件
    expect(unsubCalls.length).toBeGreaterThan(0);

    // 至少有一个订阅在卸载阶段调用了 unsubscribe
    const calledOnce = unsubCalls.filter((count) => count === 1);
    expect(calledOnce.length).toBeGreaterThan(0);
  });
});
