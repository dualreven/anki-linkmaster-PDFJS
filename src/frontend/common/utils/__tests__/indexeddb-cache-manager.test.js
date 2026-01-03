/**
 * @jest-environment jsdom
 *
 * IndexedDBCacheManager 单测（基于 fake-indexeddb）
 * - 不再手写 mock indexedDB（避免与 fake-indexeddb/auto 冲突造成“看似成功但未落库”的假阳性）
 * - 聚焦真实行为：store/get、统计、LRU 清理
 */
import { describe, beforeEach, afterEach, test, expect, jest } from "@jest/globals";

import { IndexedDBCacheManager } from "../indexeddb-cache-manager.js";

async function deleteDb(name) {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // 测试环境避免卡住
    } catch (e) {
      reject(e);
    }
  });
}

describe("IndexedDBCacheManager", () => {
  let cacheManager;

  beforeEach(async () => {
    await deleteDb("pdf_cache_db");
    cacheManager = new IndexedDBCacheManager();
    await cacheManager.initialize();
  });

  afterEach(async () => {
    try { cacheManager?.destroy?.(); } catch { /* ignore */ }
    await deleteDb("pdf_cache_db");
  });

  test("storeChunk/getChunk：应能写入并读回 ArrayBuffer", async () => {
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    await cacheManager.storeChunk("file-1", 1, 0, data, "none");

    const got = await cacheManager.getChunk("file-1", 1, 0);
    expect(got).toBeTruthy();
    expect(Array.from(new Uint8Array(got))).toEqual([1, 2, 3, 4]);
  });

  test("getCacheStats：应统计 totalFiles/totalChunks/totalSize", async () => {
    await cacheManager.storeChunk("file-1", 1, 0, new ArrayBuffer(1024), "none");
    await cacheManager.storeChunk("file-1", 1, 1, new ArrayBuffer(2048), "none");

    const stats = await cacheManager.getCacheStats();
    expect(stats.totalFiles).toBe(1);
    expect(stats.totalChunks).toBe(2);
    expect(stats.totalSize).toBe(3072);
    expect(stats.fileStats).toHaveLength(1);
    expect(stats.fileStats[0].fileId).toBe("file-1");
    expect(stats.fileStats[0].chunkCount).toBe(2);
    expect(stats.fileStats[0].totalSize).toBe(3072);
  });

  test("LRU 清理：应优先清理最久未访问分片", async () => {
    const nowSpy = jest.spyOn(Date, "now");
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const chunkSize = 512 * 1024;
    now = 1000;
    await cacheManager.storeChunk("file-1", 1, 0, new ArrayBuffer(chunkSize), "none");
    now = 2000;
    await cacheManager.storeChunk("file-1", 1, 1, new ArrayBuffer(chunkSize), "none");
    now = 3000;
    await cacheManager.storeChunk("file-1", 1, 2, new ArrayBuffer(chunkSize), "none");

    // 访问 1/2，使 0 成为最久未访问
    now = 4000;
    await cacheManager.getChunk("file-1", 1, 1);
    now = 5000;
    await cacheManager.getChunk("file-1", 1, 2);

    await cacheManager._cleanupOldCache(chunkSize);

    const c0 = await cacheManager.getChunk("file-1", 1, 0);
    expect(c0).toBeNull();
    const c1 = await cacheManager.getChunk("file-1", 1, 1);
    expect(c1).not.toBeNull();

    nowSpy.mockRestore();
  });
});

