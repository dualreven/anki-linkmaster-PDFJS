/**
 * @file 删除书签不应误删非子书签的回归测试
 */

import { BookmarkManager } from '../bookmark-manager.js';

describe('BookmarkManager.deleteBookmark 行为', () => {
  beforeEach(() => {
    // 清理 localStorage，避免跨用例相互影响
    if (typeof localStorage !== 'undefined' && localStorage.clear) {
      localStorage.clear();
    }
  });

  test('删除根节点仅影响其子树，其他根节点不受影响', async () => {
    const pdfId = 'pdf-test-del-root';
    const mgr = new BookmarkManager({ pdfId });
    await mgr.initialize();

    const a = await mgr.addBookmark({ name: 'A', type: 'page', pageNumber: 1 });
    const b = await mgr.addBookmark({ name: 'B', type: 'page', pageNumber: 2 });
    const c = await mgr.addBookmark({ name: 'C', type: 'page', pageNumber: 3 });
    expect(a.success && b.success && c.success).toBe(true);

    const b1 = await mgr.addBookmark({ name: 'b1', type: 'page', pageNumber: 2, parentId: b.bookmarkId, order: 0 });
    expect(b1.success).toBe(true);

    // round-trip 一次以模拟真实存储加载
    await mgr.saveToStorage();
    await mgr.loadFromStorage();

    // 删除 B（级联）
    const del = await mgr.deleteBookmark(b.bookmarkId, true);
    expect(del.success).toBe(true);

    // 保存并重新加载后，检查仅 A/C 存活
    await mgr.saveToStorage();
    await mgr.loadFromStorage();
    const roots = mgr.getAllBookmarks();
    const rootNames = roots.map(r => r.name).sort();
    expect(rootNames).toEqual(['A', 'C']);
  });

  test('删除子节点不影响父与同级其他根节点', async () => {
    const pdfId = 'pdf-test-del-child';
    const mgr = new BookmarkManager({ pdfId });
    await mgr.initialize();

    const a = await mgr.addBookmark({ name: 'A', type: 'page', pageNumber: 1 });
    const b = await mgr.addBookmark({ name: 'B', type: 'page', pageNumber: 2 });
    const c = await mgr.addBookmark({ name: 'C', type: 'page', pageNumber: 3 });
    expect(a.success && b.success && c.success).toBe(true);

    const b1 = await mgr.addBookmark({ name: 'b1', type: 'page', pageNumber: 2, parentId: b.bookmarkId, order: 0 });
    expect(b1.success).toBe(true);

    await mgr.saveToStorage();
    await mgr.loadFromStorage();

    // 删除子节点 b1（默认 UI 级联=true，但对单节点无子亦等价）
    const del = await mgr.deleteBookmark(b1.bookmarkId, true);
    expect(del.success).toBe(true);

    await mgr.saveToStorage();
    await mgr.loadFromStorage();
    const roots = mgr.getAllBookmarks();
    const bNode = roots.find(r => r.name === 'B');
    expect(roots.map(r => r.name).sort()).toEqual(['A', 'B', 'C']);
    expect(Array.isArray(bNode.children) ? bNode.children.length : -1).toBe(0);
  });
});

