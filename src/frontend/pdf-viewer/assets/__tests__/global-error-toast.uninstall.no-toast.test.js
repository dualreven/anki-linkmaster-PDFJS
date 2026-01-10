/**
 * @jest-environment jsdom
 */

import { describe, test, expect, afterEach, jest } from "@jest/globals";
import { showError } from "../../../common/utils/notification.js";

jest.mock("../../../common/utils/notification.js", () => ({
  __esModule: true,
  showError: jest.fn(),
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

describe("global-error-toast — uninstall disables side effects", () => {
  test("after uninstall, dispatching error does not call showError()", async () => {
    const mod = await import("../global-error-toast.js");

    mod.uninstallGlobalErrorToast();

    const preventUnhandled = (e) => { e.preventDefault(); };
    window.addEventListener("error", preventUnhandled, true);

    const err = new Error("boom");
    const ev = new ErrorEvent("error", {
      message: "boom",
      filename: "x.js",
      lineno: 1,
      colno: 2,
      error: err,
    });
    window.dispatchEvent(ev);

    window.removeEventListener("error", preventUnhandled, true);

    expect(showError).not.toHaveBeenCalled();
  });

  test("after uninstall, dispatching unhandledrejection does not call showError()", async () => {
    const mod = await import("../global-error-toast.js");

    mod.uninstallGlobalErrorToast();

    const reason = new Error("reject");
    // JSDOM environments may not expose PromiseRejectionEvent; emulate minimal shape if missing.
    const ev = (typeof PromiseRejectionEvent === "function")
      ? new PromiseRejectionEvent("unhandledrejection", { reason, promise: Promise.resolve() })
      : Object.assign(new Event("unhandledrejection"), { reason });

    window.dispatchEvent(ev);

    expect(showError).not.toHaveBeenCalled();
  });
});
