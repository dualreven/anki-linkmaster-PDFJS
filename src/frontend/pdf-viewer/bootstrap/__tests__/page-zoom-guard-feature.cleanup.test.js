/* @jest-environment jsdom */

import { PageZoomGuardFeature } from "../page-zoom-guard-feature.js";

describe("PageZoomGuardFeature — uninstall removes global listeners (P0)", () => {
  test("install adds listeners; uninstall removes the same handlers", async () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const eventBus = { emit: jest.fn() };
    const feature = new PageZoomGuardFeature();

    await feature.install({ globalEventBus: eventBus, logger: console, container: {} });

    const wheelAdd = addSpy.mock.calls.find(([type]) => type === "wheel");
    const keydownAdd = addSpy.mock.calls.find(([type]) => type === "keydown");
    expect(wheelAdd).toBeTruthy();
    expect(keydownAdd).toBeTruthy();

    const wheelHandler = wheelAdd[1];
    const keydownHandler = keydownAdd[1];
    expect(typeof wheelHandler).toBe("function");
    expect(typeof keydownHandler).toBe("function");

    await feature.uninstall();

    const wheelRemove = removeSpy.mock.calls.find(([type, handler]) => type === "wheel" && handler === wheelHandler);
    const keydownRemove = removeSpy.mock.calls.find(([type, handler]) => type === "keydown" && handler === keydownHandler);
    expect(wheelRemove).toBeTruthy();
    expect(keydownRemove).toBeTruthy();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

