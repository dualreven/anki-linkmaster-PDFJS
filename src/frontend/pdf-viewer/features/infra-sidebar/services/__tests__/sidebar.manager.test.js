import { SidebarManager } from "../sidebar.manager.js";

describe("SidebarManager", () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    manager = new SidebarManager(mockLogger);
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.activeSidebars).toEqual([]);
    expect(state.widths).toEqual({});
    expect(state.registeredSidebars).toEqual({});
  });

  test("should register sidebar", () => {
    const config = { id: "test", title: "Test", minWidth: 100, maxWidth: 500 };
    manager.registerSidebar(config);
    expect(manager.getSidebar("test")).toEqual(config);
  });

  test("should open sidebar", () => {
    const config = { id: "test", title: "Test" };
    manager.registerSidebar(config);

    manager.openSidebar("test");
    expect(manager.store.get().activeSidebars).toContain("test");
  });

  test("should close sidebar", () => {
    const config = { id: "test", title: "Test" };
    manager.registerSidebar(config);
    manager.openSidebar("test");

    manager.closeSidebar("test");
    expect(manager.store.get().activeSidebars).not.toContain("test");
  });

  test("should toggle sidebar", () => {
    const config = { id: "test", title: "Test" };
    manager.registerSidebar(config);

    manager.toggleSidebar("test");
    expect(manager.store.get().activeSidebars).toContain("test");

    manager.toggleSidebar("test");
    expect(manager.store.get().activeSidebars).not.toContain("test");
  });

  test("should set width", () => {
    const config = { id: "test", title: "Test", minWidth: 100, maxWidth: 500 };
    manager.registerSidebar(config);

    manager.setWidth("test", 300);
    expect(manager.store.get().widths["test"]).toBe(300);

    manager.setWidth("test", 600); // Constrained
    expect(manager.store.get().widths["test"]).toBe(500);
  });
});
