import { UIZoomControls } from "../ui-zoom-controls.js";

describe("UIZoomControls timeout cleanup (regression)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("destroy() should clear animation timeouts and remove animation classes immediately", () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout").mockReturnValue(111);
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout").mockImplementation(() => {});

    const eventBus = { emit: jest.fn() };
    const zoomManager = null;
    const ui = new UIZoomControls(eventBus, zoomManager);

    const canvas = document.createElement("canvas");

    ui.applyZoomAnimation(canvas);
    ui.applyPageTransitionAnimation(canvas);

    expect(canvas.classList.contains("zoom-animation")).toBe(true);
    expect(canvas.classList.contains("page-transition")).toBe(true);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    ui.destroy();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(canvas.classList.contains("zoom-animation")).toBe(false);
    expect(canvas.classList.contains("page-transition")).toBe(false);
  });
});

