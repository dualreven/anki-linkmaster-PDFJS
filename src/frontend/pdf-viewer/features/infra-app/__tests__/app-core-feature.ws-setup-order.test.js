/** @jest-environment jsdom */

/**
 * 目的：
 * - 回归保护：确保 AppCoreFeature.install 的顺序为
 *   1) setupWsInfra(安装适配器/注册逻辑)
 *   2) appContainer.connect(触发 connection:established)
 *   避免适配器错过 connection:established，导致注册消息漏发。
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { AppCoreFeature } from "../index.js";
import { createPDFViewerContainer } from "../../../container/app-container.js";
import { setupWsInfra } from "../../../../common/features/ws-infra/index.js";

jest.mock("../../../container/app-container.js", () => {
  return {
    createPDFViewerContainer: jest.fn(() => {
      const fakeEventBus = {
        on: jest.fn(() => () => {}),
        emit: jest.fn(),
        off: jest.fn()
      };
      const fakeWsClient = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        isConnected: jest.fn(() => false)
      };
      const deps = { wsClient: fakeWsClient, eventBus: fakeEventBus };

      return {
        isInitialized: jest.fn(() => false),
        initialize: jest.fn(async () => {}),
        getDependencies: jest.fn(() => deps),
        connect: jest.fn(() => {
          globalThis.__APP_CORE_WS_ORDER__ = globalThis.__APP_CORE_WS_ORDER__ || [];
          globalThis.__APP_CORE_WS_ORDER__.push("connect");
        }),
        disconnect: jest.fn(),
        dispose: jest.fn()
      };
    })
  };
});

jest.mock("../../../../common/features/ws-infra/index.js", () => {
  return {
    setupWsInfra: jest.fn(() => {
      globalThis.__APP_CORE_WS_ORDER__ = globalThis.__APP_CORE_WS_ORDER__ || [];
      globalThis.__APP_CORE_WS_ORDER__.push("setupWsInfra");
      return { adapters: [], dispose: jest.fn() };
    })
  };
});

jest.mock("../../../../common/utils/notification.js", () => ({
  showError: jest.fn()
}));

jest.mock("../../../../common/utils/websocket-error-handler.js", () => ({
  WebSocketErrorHandler: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    unregister: jest.fn()
  }))
}));

describe("AppCoreFeature — wsInfra 安装顺序", () => {
  beforeEach(() => {
    globalThis.__APP_CORE_WS_ORDER__ = [];
    jest.clearAllMocks();
  });

  test("setupWsInfra 必须先于 connect 调用", async () => {
    const feature = new AppCoreFeature();

    const container = {
      registerGlobal: jest.fn(),
      register: jest.fn(),
      get: jest.fn(() => ({}))
    };

    const context = {
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      config: { wsUrl: "ws://localhost:12345" },
      container,
      globalEventBus: { on: jest.fn(() => () => {}), emit: jest.fn(), off: jest.fn() }
    };

    await feature.install(context);

    expect(createPDFViewerContainer).toHaveBeenCalledTimes(1);
    expect(setupWsInfra).toHaveBeenCalledTimes(1);

    const order = globalThis.__APP_CORE_WS_ORDER__ || [];
    const idxSetup = order.indexOf("setupWsInfra");
    const idxConnect = order.indexOf("connect");

    expect(idxSetup).toBeGreaterThanOrEqual(0);
    expect(idxConnect).toBeGreaterThanOrEqual(0);
    expect(idxSetup).toBeLessThan(idxConnect);
  });
});
