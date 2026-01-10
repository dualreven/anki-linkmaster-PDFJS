/* @jest-environment jsdom */

import { jest } from "@jest/globals";

jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
}));

const mockOutlineSidebarUIDestroy = jest.fn();
const mockOutlineSidebarUIFocus = jest.fn();

jest.mock("../components/outline-sidebar-ui.js", () => ({
  OutlineSidebarUI: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    destroy: mockOutlineSidebarUIDestroy,
    focusByOutlineItemId: mockOutlineSidebarUIFocus,
  })),
}));

jest.mock("../services/outline.manager.js", () => ({
  OutlineManager: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

jest.mock("../../../outline/components/outline-dialog.js", () => ({
  OutlineDialog: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
}));

jest.mock("../../../outline/outline-data-provider.js", () => ({
  OutlineDataProvider: jest.fn().mockImplementation(() => ({})),
}));

import { OutlineFeature } from "../index.js";

function createEventBusDouble() {
  const unsubs = [];
  const bus = {
    on() { const unsub = jest.fn(); unsubs.push(unsub); return unsub; },
    onGlobal() { return bus.on(); },
    emit() {},
    emitGlobal() {}
  };
  return { bus, unsubs };
}

function createContainer() {
  return {
    getWSClient() { return { request: jest.fn().mockResolvedValue({}), send: jest.fn() }; },
    get() { return null; },
    resolve() { return null; },
    registerGlobal() {},
  };
}

describe("pdf-outline: OutlineFeature uninstall cleanup", () => {
  test("uninstall is idempotent and destroys OutlineSidebarUI once", async () => {
    delete global.window.__DISABLE_OUTLINE_UI;
    mockOutlineSidebarUIDestroy.mockClear();

    const { bus } = createEventBusDouble();
    const feature = new OutlineFeature();
    await feature.install({
      scopedEventBus: bus,
      globalEventBus: bus,
      logger: console,
      container: createContainer()
    });

    await expect(feature.uninstall({ logger: console })).resolves.toBeUndefined();
    await expect(feature.uninstall({ logger: console })).resolves.toBeUndefined();
    expect(mockOutlineSidebarUIDestroy).toHaveBeenCalledTimes(1);
  });
});
