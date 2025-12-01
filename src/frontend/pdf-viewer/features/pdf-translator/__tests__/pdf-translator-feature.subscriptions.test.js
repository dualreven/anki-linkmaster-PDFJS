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

jest.mock("../components/TranslatorSidebarUI.js", () => ({
  TranslatorSidebarUI: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    destroy: jest.fn()
  }))
}));

jest.mock("../services/TranslationService.js", () => ({
  TranslationService: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}));

jest.mock("../services/SelectionMonitor.js", () => ({
  SelectionMonitor: jest.fn().mockImplementation(() => ({
    setEnabled: jest.fn(),
    clearLastSelection: jest.fn(),
    destroy: jest.fn()
  }))
}));

import { PDFTranslatorFeature } from "../index.js";

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

function createContainer() {
  const store = new Map();
  return {
    registerGlobal(key, value) {
      store.set(key, value);
    },
    get(key) {
      return store.get(key);
    },
    resolve(key) {
      return store.get(key);
    }
  };
}

describe("PDFTranslatorFeature - 订阅管理", () => {
  test("install + uninstall 会调用所有 unsubscribe 函数一次", async () => {
    const unsubCalls = [];
    const eventBus = createTestEventBus(unsubCalls);
    const container = createContainer();

    const feature = new PDFTranslatorFeature();
    await feature.install({
      globalEventBus: eventBus,
      logger: console,
      container
    });

    await feature.uninstall();

    expect(unsubCalls.length).toBeGreaterThan(0);
    unsubCalls.forEach(count => {
      expect(count).toBe(1);
    });
  });
});

