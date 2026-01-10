/* @jest-environment jsdom */

import { createAnnotationToggleButton } from "../annotation-feature-toggle-button.js";

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

function createEventBus() {
  return {
    emit: jest.fn(),
    on: jest.fn(() => jest.fn()),
  };
}

function dispatchShortcut() {
  const ev = new KeyboardEvent("keydown", { key: "A", ctrlKey: true, shiftKey: true, bubbles: true });
  document.dispatchEvent(ev);
}

describe("Annotation toggle button — keydown listener uninstall", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("uninstall 后 keydown 不再触发 toggle", () => {
    document.body.innerHTML = "<div id=\"pdf-viewer-button-container\"><button id=\"outline\">Outline</button></div>";
    const logger = createLogger();
    const eventBus = createEventBus();

    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const btn = createAnnotationToggleButton({ eventBus, logger });
    expect(btn).toBeTruthy();
    expect(typeof btn.uninstall).toBe("function");

    dispatchShortcut();
    expect(eventBus.emit).toHaveBeenCalledTimes(1);

    btn.uninstall();
    dispatchShortcut();
    expect(eventBus.emit).toHaveBeenCalledTimes(1);

    expect(addSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(1);
    expect(removeSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(1);
  });

  test("重复安装/卸载幂等：不重复绑定、不重复触发", () => {
    document.body.innerHTML = "<div id=\"pdf-viewer-button-container\"><button id=\"outline\">Outline</button></div>";
    const logger = createLogger();
    const eventBus = createEventBus();

    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const btn1 = createAnnotationToggleButton({ eventBus, logger });
    const btn2 = createAnnotationToggleButton({ eventBus, logger });

    expect(addSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(1);

    dispatchShortcut();
    expect(eventBus.emit).toHaveBeenCalledTimes(1);

    btn1.uninstall();
    dispatchShortcut();
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(removeSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(0);

    btn2.uninstall();
    dispatchShortcut();
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(removeSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(1);
  });
});

