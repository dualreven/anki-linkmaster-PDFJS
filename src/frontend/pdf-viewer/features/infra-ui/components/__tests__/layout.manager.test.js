import { LayoutManager } from "../layout.manager.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

describe("LayoutManager", () => {
  let manager;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    manager = new LayoutManager(mockEventBus, mockLogger);
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.scrollMode).toBe(0); // Vertical
    expect(state.spreadMode).toBe(0); // None
    expect(state.rotation).toBe(0);
    expect(state.mouseMode).toBe("text");
  });

  test("should set scroll mode", () => {
    manager.setScrollMode(1);
    expect(manager.store.get().scrollMode).toBe(1);
  });

  test("should set spread mode", () => {
    manager.setSpreadMode(2);
    expect(manager.store.get().spreadMode).toBe(2);
  });

  test("should rotate pages", () => {
    manager.rotate(90);
    expect(manager.store.get().rotation).toBe(90);

    manager.rotate(90);
    expect(manager.store.get().rotation).toBe(180);

    manager.rotate(270); // 180 + 270 = 450 -> 90
    expect(manager.store.get().rotation).toBe(90);
  });

  test("should toggle mouse mode", () => {
    manager.toggleMouseMode();
    expect(manager.store.get().mouseMode).toBe("drag");
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.MOUSE.MODE_CHANGED,
      { mode: "drag" },
      expect.any(Object)
    );

    manager.toggleMouseMode();
    expect(manager.store.get().mouseMode).toBe("text");
  });

  test("should set mouse mode explicitly", () => {
    manager.setMouseMode("drag");
    expect(manager.store.get().mouseMode).toBe("drag");
  });
});
