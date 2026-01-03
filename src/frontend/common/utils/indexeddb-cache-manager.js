/**
 * IndexedDB 缓存管理器（PDF 分片缓存）
 * 说明（详细）：`docs/standards/indexeddb-cache-manager.md`
 */

import { getLogger } from "./logger.js";
import { createChunkRecord } from "./indexeddb-cache-record.js";

/**
 * IndexedDB 缓存管理器
 */
export class IndexedDBCacheManager {
  #logger;
  #dbName = "pdf_cache_db";
  #dbVersion = 1;
  #storeName = "pdf_chunks";
  #maxStorageSize = 100 * 1024 * 1024; // 100MB
  #db = null;

  constructor() {
    this.#logger = getLogger("IndexedDBCacheManager");
  }

  // 测试友好：公开同名下划线方法以便 stub
  async _cleanupOldCache(targetSize) {
    return this.#cleanupOldCache(targetSize);
  }

  async _getStorageUsage() {
    return this.#getStorageUsage();
  }

  async initialize() {
    try {
      this.#logger.info("Initializing IndexedDB cache manager...");

      await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.#dbName, this.#dbVersion);

        request.onerror = () => {
          this.#logger.error("Failed to open IndexedDB:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.#db = request.result;
          this.#logger.info("IndexedDB cache manager initialized successfully");
          resolve();
        };

        request.onupgradeneeded = (event) => {
          this.#handleUpgradeNeeded(event, request);
        };
      });
    } catch (error) {
      this.#logger.error("Failed to initialize IndexedDB cache manager:", error);
      throw error;
    }
  }

  #handleUpgradeNeeded(event, request) {
    const db = (event && event.target && event.target.result) || (request && request.result);
    if (!db) {
      throw new Error("IndexedDB upgrade failed: missing db instance");
    }

    if (db.objectStoreNames.contains(this.#storeName)) {
      db.deleteObjectStore(this.#storeName);
    }

    const store = db.createObjectStore(this.#storeName, {
      keyPath: "id",
      autoIncrement: true
    });

    if (store && typeof store.createIndex === "function") {
      store.createIndex("file_page_chunk", ["fileId", "pageNumber", "chunkIndex"], { unique: false });
      store.createIndex("file_page", ["fileId", "pageNumber"], { unique: false });
      store.createIndex("file_id", "fileId", { unique: false });
      store.createIndex("timestamp", "timestamp", { unique: false });
      store.createIndex("last_accessed", "lastAccessed", { unique: false });
      store.createIndex("size", "size", { unique: false });
    } else {
      this.#logger.warn("IndexedDB createObjectStore returned no store, skip index creation (test polyfill?)");
    }

    this.#logger.debug("IndexedDB object store and indexes created");
  }

  async storeChunk(fileId, pageNumber, chunkIndex, chunkData, compressionType = "none") {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    // ⚠️ IndexedDB transaction 在 await 后会变为 inactive（fake-indexeddb 中可稳定复现），必须在创建 transaction 之前完成任何 await 的配额检查。
    await this.#checkStorageQuota();

    const chunkRecord = createChunkRecord({
      fileId,
      pageNumber,
      chunkIndex,
      chunkData,
      compressionType
    });

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);
    const debugKey = `${fileId}-${pageNumber}-${chunkIndex}`;

    await new Promise((resolve, reject) => {
      const request = store.add(chunkRecord);

      if (!request || typeof request.onsuccess === "undefined") {
        this.#logger.debug(`Stored chunk (no request object): ${debugKey}`);
        resolve();
        return;
      }

      request.onsuccess = () => {
        this.#logger.debug(`Stored chunk: ${debugKey}`);
        resolve();
      };

      request.onerror = () => {
        this.#logger.error("Failed to store chunk:", request.error);
        reject(request.error);
      };
    });
  }

  async getChunk(fileId, pageNumber, chunkIndex) {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);
    const hasIndex = typeof store.index === "function";

    return new Promise((resolve, reject) => {
      const finalize = (record) => {
        if (!record) {
          this.#logger.debug(`Chunk not found in cache: ${fileId}-${pageNumber}-${chunkIndex}`);
          resolve(null);
          return;
        }

        record.lastAccessed = Date.now();
        if (typeof store.put === "function") {
          const updateRequest = store.put(record);
          updateRequest.onsuccess = () => {
            this.#logger.debug(`Retrieved and updated chunk: ${fileId}-${pageNumber}-${chunkIndex}`);
            resolve(record.data);
          };
          updateRequest.onerror = () => {
            this.#logger.error("Failed to update access time:", updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          resolve(record.data);
        }
      };

      if (hasIndex) {
        const index = store.index("file_page_chunk");
        const request = index.get([fileId, pageNumber, chunkIndex]);
        request.onsuccess = () => finalize(request.result);
        request.onerror = () => {
          this.#logger.error("Failed to get chunk:", request.error);
          reject(request.error);
        };
        return;
      }

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const v = cursor.value;
          if (v.fileId === fileId && v.pageNumber === pageNumber && v.chunkIndex === chunkIndex) {
            finalize(v);
          } else {
            cursor.continue();
          }
        } else {
          finalize(null);
        }
      };
      cursorReq.onerror = () => {
        this.#logger.error("Failed to iterate chunks:", cursorReq.error);
        reject(cursorReq.error);
      };
    });
  }

  async getPageChunks(fileId, pageNumber) {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    const transaction = this.#db.transaction([this.#storeName], "readonly");
    const store = transaction.objectStore(this.#storeName);
    const hasIndex = typeof store.index === "function";

    return new Promise((resolve, reject) => {
      const done = (records) => {
        const chunks = records.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(chunks.map(chunk => chunk.data));
      };

      if (hasIndex) {
        const index = store.index("file_page");
        const request = index.getAll([fileId, pageNumber]);
        request.onsuccess = () => done(request.result || []);
        request.onerror = () => {
          this.#logger.error("Failed to get page chunks:", request.error);
          reject(request.error);
        };
        return;
      }

      const rows = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const v = cursor.value;
          if (v.fileId === fileId && v.pageNumber === pageNumber) {
            rows.push(v);
          }
          cursor.continue();
        } else {
          done(rows);
        }
      };
      cursorReq.onerror = () => {
        this.#logger.error("Failed to iterate page chunks:", cursorReq.error);
        reject(cursorReq.error);
      };
    });
  }

  async clearFileCache(fileId) {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);
    const hasIndex = typeof store.index === "function";

    const openCursorForFileId = (index) => {
      try {
        if (typeof IDBKeyRange !== "undefined" && IDBKeyRange && typeof IDBKeyRange.only === "function") {
          return index.openCursor(IDBKeyRange.only(fileId));
        }
        return index.openCursor();
      } catch (error) {
        this.#logger.warn("[IndexedDB] clearFileCache: openCursor failed, fallback to openCursor()", {
          fileId,
          err: error?.message || String(error)
        });
        return index.openCursor && index.openCursor();
      }
    };

    return new Promise((resolve, reject) => {
      if (hasIndex) {
        const index = store.index("file_id");
        const request = openCursorForFileId(index);

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const v = cursor.value;
            if (!v || v.fileId === fileId) {
              try { cursor.delete(); } catch (e) {
                this.#logger.warn("[IndexedDB] clearFileCache: cursor.delete failed", {
                  fileId,
                  err: e?.message || String(e)
                });
              }
            }
            try { cursor.continue(); } catch (e) {
              this.#logger.warn("[IndexedDB] clearFileCache: cursor.continue failed; finishing early", {
                fileId,
                err: e?.message || String(e)
              });
              resolve();
            }
          } else {
            this.#logger.info(`Cleared all cache for file: ${fileId}`);
            resolve();
          }
        };
        request.onerror = () => {
          this.#logger.error("Failed to clear file cache:", request.error);
          reject(request.error);
        };
        return;
      }

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const v = cursor.value;
          if (v.fileId === fileId) {
            try { cursor.delete(); } catch (e) {
              this.#logger.warn("[IndexedDB] clearFileCache(fallback): cursor.delete failed", {
                fileId,
                err: e?.message || String(e)
              });
            }
          }
          try { cursor.continue(); } catch (e) {
            this.#logger.warn("[IndexedDB] clearFileCache(fallback): cursor.continue failed; finishing early", {
              fileId,
              err: e?.message || String(e)
            });
            resolve();
          }
        } else {
          this.#logger.info(`Cleared all cache for file (fallback): ${fileId}`);
          resolve();
        }
      };
      cursorReq.onerror = () => {
        this.#logger.error("Failed to iterate for clear:", cursorReq.error);
        reject(cursorReq.error);
      };
    });
  }

  async clearPageCache(fileId, pageNumber) {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);
    const index = store.index("file_page");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.bound([fileId, pageNumber], [fileId, pageNumber]));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          try { cursor.delete(); } catch (e) {
            this.#logger.warn("[IndexedDB] clearPageCache: cursor.delete failed", {
              fileId,
              pageNumber,
              err: e?.message || String(e)
            });
          }
          try { cursor.continue(); } catch (e) {
            this.#logger.warn("[IndexedDB] clearPageCache: cursor.continue failed; finishing early", {
              fileId,
              pageNumber,
              err: e?.message || String(e)
            });
            resolve();
          }
        } else {
          this.#logger.info(`Cleared cache for page: ${fileId}-${pageNumber}`);
          resolve();
        }
      };

      request.onerror = () => {
        this.#logger.error("Failed to clear page cache:", request.error);
        reject(request.error);
      };
    });
  }

  async #cleanupOldCache(targetSize) {
    if (!this.#db) {
      return 0;
    }

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);
    const index = store.index("last_accessed");

    let cleanedSize = 0;
    const recordsToDelete = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "next");

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && cleanedSize < targetSize) {
          recordsToDelete.push({ key: cursor.primaryKey, size: cursor.value.size });
          cleanedSize += cursor.value.size;
          cursor.continue();
          return;
        }

        const deletePromises = recordsToDelete.map(record => {
          return new Promise((deleteResolve, deleteReject) => {
            const deleteRequest = store.delete(record.key);
            deleteRequest.onsuccess = () => deleteResolve();
            deleteRequest.onerror = () => deleteReject(deleteRequest.error);
          });
        });

        Promise.all(deletePromises)
          .then(() => {
            this.#logger.info(`LRU cleanup: cleaned ${cleanedSize} bytes from cache`);
            resolve(cleanedSize);
          })
          .catch(reject);
      };

      request.onerror = () => {
        this.#logger.error("Failed to cleanup cache:", request.error);
        reject(request.error);
      };
    });
  }

  async #checkStorageQuota() {
    try {
      const currentUsage = await this._getStorageUsage();

      if (currentUsage > this.#maxStorageSize) {
        const cleanupSize = currentUsage - this.#maxStorageSize;
        this.#logger.warn(
          `Storage quota exceeded (${currentUsage} > ${this.#maxStorageSize}), cleaning up ${cleanupSize} bytes`
        );
        await this._cleanupOldCache(cleanupSize);
      }
    } catch (error) {
      this.#logger.error("Failed to check storage quota:", error);
    }
  }

  async #getStorageUsage() {
    if (!this.#db) {
      return 0;
    }

    const transaction = this.#db.transaction([this.#storeName], "readonly");
    const store = transaction.objectStore(this.#storeName);
    const index = store.index("size");

    return new Promise((resolve, reject) => {
      let totalSize = 0;
      const request = index.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          totalSize += cursor.value.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getCacheStats() {
    if (!this.#db) {
      return { totalFiles: 0, totalChunks: 0, totalSize: 0, maxSize: this.#maxStorageSize };
    }

    const transaction = this.#db.transaction([this.#storeName], "readonly");
    const store = transaction.objectStore(this.#storeName);

    const fileStats = new Map();
    let totalChunks = 0;
    let totalSize = 0;

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const record = cursor.value;
          totalChunks++;
          totalSize += record.size;

          if (!fileStats.has(record.fileId)) {
            fileStats.set(record.fileId, { fileId: record.fileId, chunkCount: 0, totalSize: 0 });
          }

          const stats = fileStats.get(record.fileId);
          stats.chunkCount++;
          stats.totalSize += record.size;

          cursor.continue();
        } else {
          resolve({
            totalFiles: fileStats.size,
            totalChunks,
            totalSize,
            maxSize: this.#maxStorageSize,
            fileStats: Array.from(fileStats.values()),
            usagePercent: Math.round((totalSize / this.#maxStorageSize) * 100)
          });
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clearAllCache() {
    if (!this.#db) {
      throw new Error("IndexedDB not initialized");
    }

    const transaction = this.#db.transaction([this.#storeName], "readwrite");
    const store = transaction.objectStore(this.#storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        this.#logger.info("Cleared all cache");
        resolve();
      };
      request.onerror = () => {
        this.#logger.error("Failed to clear all cache:", request.error);
        reject(request.error);
      };
    });
  }

  destroy() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
    this.#logger.info("IndexedDB cache manager destroyed");
  }
}

export default IndexedDBCacheManager;

