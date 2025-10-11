/**
 * BookmarkManager 拖拽节点成为子节点测试
 * 验证修复：节点拖拽到另一个节点下时不会丢失
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BookmarkManager } from '../bookmark-manager.js';
import { Bookmark } from '../../models/bookmark.js';

describe('BookmarkManager - Reorder to Child Node', () => {
  let manager;
  let mockEventBus;
  let mockStorage;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(() => jest.fn()) // 返回 unsubscribe 函数
    };

    // Mock Storage
    mockStorage = {
      load: jest.fn(async () => null),
      save: jest.fn(async () => {}),
      clear: jest.fn(async () => {})
    };

    // 创建 BookmarkManager 实例
    manager = new BookmarkManager({
      eventBus: mockEventBus,
      pdfId: 'test-pdf',
      storage: mockStorage
    });
  });

  it('应该正确处理：根节点 A 拖拽到根节点 B 下成为子节点', async () => {
    // 1. 创建初始树结构
    // Root A (pageNumber: 1)
    // Root B (pageNumber: 2)

    const bookmarkA = await manager.addBookmark({
      name: 'Node A',
      type: 'page',
      pageNumber: 1
    });

    const bookmarkB = await manager.addBookmark({
      name: 'Node B',
      type: 'page',
      pageNumber: 2
    });

    expect(bookmarkA.success).toBe(true);
    expect(bookmarkB.success).toBe(true);

    const idA = bookmarkA.bookmarkId;
    const idB = bookmarkB.bookmarkId;

    // 2. 验证初始状态
    let allBookmarks = manager.getAllBookmarks();
    expect(allBookmarks.length).toBe(2);
    expect(allBookmarks[0].id).toBe(idA);
    expect(allBookmarks[1].id).toBe(idB);

    // 3. 拖拽 A 到 B 下成为子节点
    const reorderResult = await manager.reorderBookmarks(idA, idB, 0);
    expect(reorderResult.success).toBe(true);

    // 4. 验证拖拽后的树结构
    allBookmarks = manager.getAllBookmarks();

    // 根节点应该只有 B
    expect(allBookmarks.length).toBe(1);
    expect(allBookmarks[0].id).toBe(idB);

    // B 应该有一个子节点 A
    const nodeB = manager.getBookmark(idB);
    expect(nodeB.children.length).toBe(1);
    expect(nodeB.children[0].id).toBe(idA);

    // A 的 parentId 应该是 B
    const nodeA = manager.getBookmark(idA);
    expect(nodeA.parentId).toBe(idB);

    // 5. 验证保存到 storage 的数据
    expect(mockStorage.save).toHaveBeenCalled();
    const saveCall = mockStorage.save.mock.calls[mockStorage.save.mock.calls.length - 1];
    const [pdfId, savedRoots, savedRootIds] = saveCall;

    // 验证保存的根节点列表
    expect(savedRootIds).toEqual([idB]);

    // 验证保存的树结构
    expect(savedRoots.length).toBe(1);
    expect(savedRoots[0].id).toBe(idB);
    expect(savedRoots[0].children.length).toBe(1);
    expect(savedRoots[0].children[0].id).toBe(idA);

    // ⚠️ 关键验证：A 不应该同时出现在根节点列表中
    const rootIds = savedRoots.map(r => r.id);
    expect(rootIds).not.toContain(idA);

    // ⚠️ 关键验证：A 应该只出现一次（在 B.children 中）
    const allSavedIds = [];
    const collectIds = (node) => {
      allSavedIds.push(node.id);
      if (node.children) {
        node.children.forEach(child => collectIds(child));
      }
    };
    savedRoots.forEach(root => collectIds(root));

    const countA = allSavedIds.filter(id => id === idA).length;
    expect(countA).toBe(1); // A 应该只出现一次
  });

  it('应该正确处理：节点 A 拖拽到其兄弟节点 B 下成为子节点', async () => {
    // 1. 创建初始树结构
    // Root C
    //   ├─ Node A (pageNumber: 1)
    //   └─ Node B (pageNumber: 2)

    const bookmarkC = await manager.addBookmark({
      name: 'Root C',
      type: 'page',
      pageNumber: 0
    });

    const bookmarkA = await manager.addBookmark({
      name: 'Node A',
      type: 'page',
      pageNumber: 1,
      parentId: bookmarkC.bookmarkId
    });

    const bookmarkB = await manager.addBookmark({
      name: 'Node B',
      type: 'page',
      pageNumber: 2,
      parentId: bookmarkC.bookmarkId
    });

    const idC = bookmarkC.bookmarkId;
    const idA = bookmarkA.bookmarkId;
    const idB = bookmarkB.bookmarkId;

    // 2. 拖拽 A 到 B 下成为子节点
    // 目标结构：
    // Root C
    //   └─ Node B
    //       └─ Node A
    const reorderResult = await manager.reorderBookmarks(idA, idB, 0);
    expect(reorderResult.success).toBe(true);

    // 3. 验证树结构
    const nodeC = manager.getBookmark(idC);
    expect(nodeC.children.length).toBe(1);
    expect(nodeC.children[0].id).toBe(idB);

    const nodeB = manager.getBookmark(idB);
    expect(nodeB.children.length).toBe(1);
    expect(nodeB.children[0].id).toBe(idA);

    const nodeA = manager.getBookmark(idA);
    expect(nodeA.parentId).toBe(idB);

    // 4. 验证保存的数据
    const saveCall = mockStorage.save.mock.calls[mockStorage.save.mock.calls.length - 1];
    const [, savedRoots] = saveCall;

    // 验证 A 只出现一次
    const allSavedIds = [];
    const collectIds = (node) => {
      allSavedIds.push(node.id);
      if (node.children) {
        node.children.forEach(child => collectIds(child));
      }
    };
    savedRoots.forEach(root => collectIds(root));

    const countA = allSavedIds.filter(id => id === idA).length;
    expect(countA).toBe(1); // A 应该只出现一次

    // 验证树结构完整性
    expect(savedRoots[0].id).toBe(idC);
    expect(savedRoots[0].children[0].id).toBe(idB);
    expect(savedRoots[0].children[0].children[0].id).toBe(idA);
  });

  it('应该防止循环引用：不允许将节点拖拽到自己的后代下', async () => {
    // 1. 创建初始树结构
    // Root A
    //   └─ Node B

    const bookmarkA = await manager.addBookmark({
      name: 'Node A',
      type: 'page',
      pageNumber: 1
    });

    const bookmarkB = await manager.addBookmark({
      name: 'Node B',
      type: 'page',
      pageNumber: 2,
      parentId: bookmarkA.bookmarkId
    });

    const idA = bookmarkA.bookmarkId;
    const idB = bookmarkB.bookmarkId;

    // 2. 尝试将 A 拖拽到 B 下（循环引用）
    const reorderResult = await manager.reorderBookmarks(idA, idB, 0);

    // 应该失败
    expect(reorderResult.success).toBe(false);
    expect(reorderResult.error).toContain('descendant');
  });

  it('应该处理复杂的多级拖拽场景', async () => {
    // 1. 创建复杂的树结构
    // Root A
    //   ├─ Node A1
    //   │   └─ Node A1a
    //   └─ Node A2
    // Root B
    //   └─ Node B1

    const bookmarkA = await manager.addBookmark({ name: 'A', type: 'page', pageNumber: 1 });
    const bookmarkA1 = await manager.addBookmark({ name: 'A1', type: 'page', pageNumber: 2, parentId: bookmarkA.bookmarkId });
    const bookmarkA1a = await manager.addBookmark({ name: 'A1a', type: 'page', pageNumber: 3, parentId: bookmarkA1.bookmarkId });
    const bookmarkA2 = await manager.addBookmark({ name: 'A2', type: 'page', pageNumber: 4, parentId: bookmarkA.bookmarkId });
    const bookmarkB = await manager.addBookmark({ name: 'B', type: 'page', pageNumber: 5 });
    const bookmarkB1 = await manager.addBookmark({ name: 'B1', type: 'page', pageNumber: 6, parentId: bookmarkB.bookmarkId });

    const idA1 = bookmarkA1.bookmarkId;
    const idB1 = bookmarkB1.bookmarkId;

    // 2. 将 A1（及其子树）拖拽到 B1 下
    // 目标结构：
    // Root A
    //   └─ Node A2
    // Root B
    //   └─ Node B1
    //       └─ Node A1
    //           └─ Node A1a

    const reorderResult = await manager.reorderBookmarks(idA1, idB1, 0);
    expect(reorderResult.success).toBe(true);

    // 3. 验证保存的数据中，A1 和 A1a 都只出现一次
    const saveCall = mockStorage.save.mock.calls[mockStorage.save.mock.calls.length - 1];
    const [, savedRoots] = saveCall;

    const allSavedIds = [];
    const collectIds = (node) => {
      allSavedIds.push(node.id);
      if (node.children) {
        node.children.forEach(child => collectIds(child));
      }
    };
    savedRoots.forEach(root => collectIds(root));

    const countA1 = allSavedIds.filter(id => id === idA1).length;
    const countA1a = allSavedIds.filter(id => id === bookmarkA1a.bookmarkId).length;

    expect(countA1).toBe(1);
    expect(countA1a).toBe(1);
  });
});
