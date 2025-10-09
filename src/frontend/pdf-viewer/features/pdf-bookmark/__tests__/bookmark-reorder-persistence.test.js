/* eslint-env jest */
/**
 * @file 测试：拖拽根节点为子节点后保存载荷完整且去重
 */

import { BookmarkManager } from "../../pdf-bookmark/services/bookmark-manager.js";

class FakeStorage {
  constructor() {
    this.saved = [];
    this.last = null;
  }
  async load() { return null; }
  async clear() {}
  async save(pdfId, bookmarks, rootIds) {
    this.last = { pdfId, bookmarks, rootIds };
    this.saved.push(this.last);
  }
}

function flattenIds(nodes) {
  const ids = [];
  const walk = (arr) => {
    for (const n of arr || []) {
      if (!n || !n.id) { continue; }
      ids.push(n.id);
      if (Array.isArray(n.children) && n.children.length) { walk(n.children); }
    }
  };
  walk(nodes);
  return ids;
}

describe("Bookmark reorder persistence", () => {
  test("moving root → child keeps other roots and unique ids", async () => {
    const storage = new FakeStorage();
    const manager = new BookmarkManager({ eventBus: {}, pdfId: "test-pdf", storage });
    await manager.initialize();

    // 三个根节点：b1, b2, b3
    await manager.addBookmark({ id: "b1", name: "A", type: "page", pageNumber: 1 });
    await manager.addBookmark({ id: "b2", name: "B", type: "page", pageNumber: 2 });
    await manager.addBookmark({ id: "b3", name: "C", type: "page", pageNumber: 3 });

    // 将 b1 拖为 b2 的子节点
    const result = await manager.reorderBookmarks("b1", "b2", 0);
    expect(result.success).toBe(true);

    // 验证最后一次保存载荷
    const payload = storage.last;
    expect(payload).toBeTruthy();
    const { bookmarks, rootIds } = payload;

    // 根列表应包含 b2、b3（b1 已作为子节点）
    expect(rootIds).toEqual(expect.arrayContaining(["b2", "b3"]));
    expect(rootIds).not.toEqual(expect.arrayContaining(["b1"]));

    // 展开树的所有 id，且应该唯一且完整
    const allIds = flattenIds(bookmarks);
    const idSet = new Set(allIds);
    expect(idSet.size).toBe(allIds.length);
    expect(idSet).toEqual(new Set(["b1", "b2", "b3"]));

    // 验证 b1 在 b2 的 children 下
    const rootB2 = bookmarks.find((n) => n.id === "b2");
    expect(rootB2).toBeTruthy();
    const hasChildB1 = !!(rootB2.children || []).find((n) => n.id === "b1");
    expect(hasChildB1).toBe(true);
  });
});
