import { OutlineManager } from "../outline.manager.js";

describe("OutlineManager (Observable)", () => {
  let manager;
  let mockLogger;
  let mockDataProvider;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDataProvider = {
      getOutline: jest.fn(),
      parseDestination: jest.fn()
    };
    manager = new OutlineManager(mockLogger, mockDataProvider);
  });

  test("should initialize with empty state", () => {
    const state = manager.store.get();
    expect(state.items).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.selectedOutlineItemId).toBeNull();
  });

  test("should replace items from remote", () => {
    const remoteItems = [
      { id: "1", name: "Chapter 1", pageAt: 1, position: null, children: [] }
    ];
    manager.replaceItems(remoteItems);
    expect(manager.store.get().items).toEqual(remoteItems);
    expect(manager.getItem("1")).toEqual(remoteItems[0]);
  });

  test("should add outline item", () => {
    manager.addItem({ name: "New", pageAt: 5 });
    const items = manager.store.get().items;
    expect(items.length).toBe(1);
    expect(items[0].name).toBe("New");
    expect(items[0].pageAt).toBe(5);
    expect(items[0].id).toBeDefined();
  });

  test("should update outline item", () => {
    manager.addItem({ name: "Original", pageAt: 1 });
    const id = manager.store.get().items[0].id;

    manager.updateItem(id, { name: "Updated" });
    expect(manager.getItem(id).name).toBe("Updated");
  });

  test("should delete outline item", () => {
    manager.addItem({ name: "To Delete", pageAt: 1 });
    const id = manager.store.get().items[0].id;

    manager.deleteItem(id);
    expect(manager.store.get().items.length).toBe(0);
  });

  test("should reorder items", () => {
    manager.addItem({ name: "1", pageAt: 1 });
    manager.addItem({ name: "2", pageAt: 2 });
    const items = manager.store.get().items;
    const id1 = items[0].id;
    const id2 = items[1].id;

    // Move 2 before 1
    manager.reorderItem(id2, null, 0);
    const newItems = manager.store.get().items;
    expect(newItems[0].id).toBe(id2);
    expect(newItems[1].id).toBe(id1);
  });

  test("should set and clear selectedOutlineItemId", () => {
    expect(manager.store.get().selectedOutlineItemId).toBeNull();

    manager.setSelectedOutlineItemId(" outlineItem-123 ");
    expect(manager.store.get().selectedOutlineItemId).toBe("outlineItem-123");

    manager.setSelectedOutlineItemId(null);
    expect(manager.store.get().selectedOutlineItemId).toBeNull();
  });
});
