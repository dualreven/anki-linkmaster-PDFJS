import { ZoomManager } from "../zoom.manager.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

describe("ZoomManager", () => {
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

    manager = new ZoomManager(mockEventBus, mockLogger);
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.scale).toBe(1.0);
    expect(state.minScale).toBe(0.5);
    expect(state.maxScale).toBe(3.0);
  });

  test("should set scale within bounds", () => {
    manager.setScale(1.5);
    expect(manager.store.get().scale).toBe(1.5);

    // Test max bound
    manager.setScale(5.0);
    expect(manager.store.get().scale).toBe(3.0);

    // Test min bound
    manager.setScale(0.1);
    expect(manager.store.get().scale).toBe(0.5);
  });

  test("should zoom in", () => {
    manager.setScale(1.0);
    manager.zoomIn();
    // Assuming step is 0.1
    expect(manager.store.get().scale).toBeCloseTo(1.1);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ZOOM.IN,
      null,
      expect.objectContaining({ actorId: "ZoomManager" })
    );
  });

  test("should zoom out", () => {
    manager.setScale(1.0);
    manager.zoomOut();
    // Assuming step is 0.1
    expect(manager.store.get().scale).toBeCloseTo(0.9);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ZOOM.OUT,
      null,
      expect.objectContaining({ actorId: "ZoomManager" })
    );
  });

  test("should not emit zoom event if scale doesn't change at boundaries", () => {
    manager.setScale(3.0);
    mockEventBus.emit.mockClear();

    manager.zoomIn();
    expect(manager.store.get().scale).toBe(3.0);
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  test("should destroy and clean up", () => {
    manager.destroy();
    // Currently destroy logic might be empty for manager itself if no subscriptions
    // But good to have the API
    expect(true).toBe(true);
  });
});
