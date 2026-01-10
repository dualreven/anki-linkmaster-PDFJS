/**
 * @jest-environment jsdom
 */

import { describe, test, expect, afterEach, jest } from "@jest/globals";

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

describe("global-error-toast — install/uninstall contract", () => {
  test("module auto-install registers listeners; uninstall removes with same handler refs", async () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const mod = await import("../global-error-toast.js");
    expect(typeof mod.uninstallGlobalErrorToast).toBe("function");

    const getCallsByType = (spy, type) => spy.mock.calls.filter((args) => args[0] === type);

    const errorAdds = getCallsByType(addSpy, "error");
    const rejectionAdds = getCallsByType(addSpy, "unhandledrejection");

    expect(errorAdds.length).toBe(1);
    expect(rejectionAdds.length).toBe(1);

    const [, errorHandler, errorCapture] = errorAdds[0];
    const [, rejectionHandler, rejectionCapture] = rejectionAdds[0];

    expect(typeof errorHandler).toBe("function");
    expect(typeof rejectionHandler).toBe("function");
    expect(errorCapture).toBe(true);
    expect(rejectionCapture).toBe(true);

    mod.uninstallGlobalErrorToast();

    const errorRemoves = getCallsByType(removeSpy, "error");
    const rejectionRemoves = getCallsByType(removeSpy, "unhandledrejection");

    expect(errorRemoves).toEqual([["error", errorHandler, true]]);
    expect(rejectionRemoves).toEqual([["unhandledrejection", rejectionHandler, true]]);
  });
});

