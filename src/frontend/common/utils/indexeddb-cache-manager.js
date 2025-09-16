/**
 * @file IndexedDB缓存管理器，用于PDF分片缓存
 * @module IndexedDBCacheManager
 * @description 提供基于IndexedDB的PDF分片缓存管理，支持100MB存储上限
 */

import Logger from './logger.js';

/**
 * @class IndexedDBCacheManager
 * @description IndexedDB缓存管理器，处理PDF分片的持久化缓存
 */
export class IndexedDBCacheManager {
    #logger;
    #dbName = 'pdf_cache_db';
    #dbVersion = 2;
    #storeName = 'pdf_chunks';
    #maxStorageSize = 100 * 1024 * 1024; // 100MB
    #db = null;

    constructor() {
        this.#logger = new Logger('IndexedDBCacheManager');
    }

    /**
     * 初始化IndexedDB数据库
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            this.#logger.info('Initializing IndexedDB cache manager...');

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.#dbName, this.#dbVersion);

                request.onerror = () => {
                    this.#logger.error('Failed to open IndexedDB:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.#db = request.result;
                    this.#logger.info('IndexedDB cache manager initialized successfully');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    // 传入 request 以兼容某些 polyfill 在 event.target.result 不可用时获取 db
                    this.#handleUpgradeNeeded(event, request);
                };
            });
        } catch (error) {
            this.#logger.error('Failed to initialize IndexedDB cache manager:', error);
            throw error;
        }
    }

    /**
     * 处理数据库升级
     * @param {IDBVersionChangeEvent} event - 升级事件
     * @private
     */
    #handleUpgradeNeeded(event) {
        const db = event.target.result;
        
        // 删除旧的存储（如果存在）
        if (db.objectStoreNames.contains(this.#storeName)) {
            db.deleteObjectStore(this.#storeName);
        }

        // 创建新的对象存储
        const store = db.createObjectStore(this.#storeName, {
            keyPath: 'id',
            autoIncrement: true
        });

        // 创建索引
        store.createIndex('file_page_chunk', ['fileId', 'pageNumber', 'chunkIndex'], { unique: false });
        store.createIndex('file_page', ['fileId', 'pageNumber'], { unique: false });
        store.createIndex('file_id', 'fileId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('last_accessed', 'lastAccessed', { unique: false });
        store.createIndex('size', 'size', { unique: false });

        this.#logger.debug('IndexedDB object store and indexes created');
    }

    /**
     * 存储PDF分片到缓存
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @param {number} chunkIndex - 分片索引
     * @param {ArrayBuffer} chunkData - 分片数据
     * @param {string} compressionType - 压缩类型
     * @returns {Promise<void>}
     */
    async storeChunk(fileId, pageNumber, chunkIndex, chunkData, compressionType = 'none') {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite');
        const store = transaction.objectStore(this.#storeName);

        const chunkRecord = {
            fileId,
            pageNumber,
            chunkIndex,
            data: chunkData,
            compressionType,
            timestamp: Date.now(),
            lastAccessed: Date.now(), // 记录初始访问时间
            size: chunkData.byteLength
        };

        // 检查存储配额
        await this.#checkStorageQuota();

        return new Promise((resolve, reject) => {
            const request = store.add(chunkRecord);

            request.onsuccess = () => {
                this.#logger.debug(`Stored chunk: ${fileId}-${pageNumber}-${chunkIndex}`);
                resolve();
            };

            request.onerror = () => {
                this.#logger.error('Failed to store chunk:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 从缓存获取PDF分片
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @param {number} chunkIndex - 分片索引
     * @returns {Promise<ArrayBuffer|null>} 分片数据或null（如果不存在）
     */
    async getChunk(fileId, pageNumber, chunkIndex) {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite'); // 改为读写事务以更新访问时间
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('file_page_chunk');

        return new Promise((resolve, reject) => {
            const request = index.get([fileId, pageNumber, chunkIndex]);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    // 更新访问时间
                    result.lastAccessed = Date.now();
                    const updateRequest = store.put(result);
                    
                    updateRequest.onsuccess = () => {
                        this.#logger.debug(`Retrieved and updated chunk: ${fileId}-${pageNumber}-${chunkIndex}`);
                        resolve(result.data);
                    };
                    
                    updateRequest.onerror = () => {
                        this.#logger.error('Failed to update access time:', updateRequest.error);
                        reject(updateRequest.error);
                    };
                } else {
                    this.#logger.debug(`Chunk not found in cache: ${fileId}-${pageNumber}-${chunkIndex}`);
                    resolve(null);
                }
            };

            request.onerror = () => {
                this.#logger.error('Failed to get chunk:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 获取页面的所有分片
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @returns {Promise<ArrayBuffer[]>} 页面所有分片数据
     */
    async getPageChunks(fileId, pageNumber) {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readonly');
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('file_page');

        return new Promise((resolve, reject) => {
            const request = index.getAll([fileId, pageNumber]);

            request.onsuccess = () => {
                const chunks = request.result.sort((a, b) => a.chunkIndex - b.chunkIndex);
                const chunkData = chunks.map(chunk => chunk.data);
                this.#logger.debug(`Retrieved ${chunks.length} chunks for page: ${fileId}-${pageNumber}`);
                resolve(chunkData);
            };

            request.onerror = () => {
                this.#logger.error('Failed to get page chunks:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 删除特定文件的所有缓存
     * @param {string} fileId - 文件ID
     * @returns {Promise<void>}
     */
    async clearFileCache(fileId) {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite');
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('file_id');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(fileId));

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    this.#logger.info(`Cleared all cache for file: ${fileId}`);
                    resolve();
                }
            };

            request.onerror = () => {
                this.#logger.error('Failed to clear file cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 删除特定页面的缓存
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @returns {Promise<void>}
     */
    async clearPageCache(fileId, pageNumber) {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite');
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('file_page');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.bound([fileId, pageNumber], [fileId, pageNumber]));

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    this.#logger.info(`Cleared cache for page: ${fileId}-${pageNumber}`);
                    resolve();
                }
            };

            request.onerror = () => {
                this.#logger.error('Failed to clear page cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 清理过期缓存（基于LRU算法）
     * @param {number} targetSize - 目标清理大小（字节）
     * @returns {Promise<number>} 实际清理的大小
     * @private
     */
    async #cleanupOldCache(targetSize) {
        if (!this.#db) {
            return 0;
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite');
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('last_accessed'); // 使用最后访问时间索引进行LRU清理

        let cleanedSize = 0;
        const recordsToDelete = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'next'); // 按访问时间升序（最早访问的在前）

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor && cleanedSize < targetSize) {
                    recordsToDelete.push({
                        key: cursor.primaryKey,
                        size: cursor.value.size
                    });
                    cleanedSize += cursor.value.size;
                    cursor.continue();
                } else {
                    // 删除记录
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
                }
            };

            request.onerror = () => {
                this.#logger.error('Failed to cleanup cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 检查存储配额并在需要时清理
     * @returns {Promise<void>}
     * @private
     */
    async #checkStorageQuota() {
        try {
            const currentUsage = await this.#getStorageUsage();
            
            if (currentUsage > this.#maxStorageSize) {
                const cleanupSize = currentUsage - this.#maxStorageSize;
                this.#logger.warn(`Storage quota exceeded (${currentUsage} > ${this.#maxStorageSize}), cleaning up ${cleanupSize} bytes`);
                await this.#cleanupOldCache(cleanupSize);
            }
        } catch (error) {
            this.#logger.error('Failed to check storage quota:', error);
        }
    }

    /**
     * 获取当前存储使用情况
     * @returns {Promise<number>} 当前存储使用量（字节）
     * @private
     */
    async #getStorageUsage() {
        if (!this.#db) {
            return 0;
        }

        const transaction = this.#db.transaction([this.#storeName], 'readonly');
        const store = transaction.objectStore(this.#storeName);
        const index = store.index('size');

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

    /**
     * 获取缓存统计信息
     * @returns {Promise<Object>} 缓存统计信息
     */
    async getCacheStats() {
        if (!this.#db) {
            return {
                totalFiles: 0,
                totalChunks: 0,
                totalSize: 0,
                maxSize: this.#maxStorageSize
            };
        }

        const transaction = this.#db.transaction([this.#storeName], 'readonly');
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
                        fileStats.set(record.fileId, {
                            fileId: record.fileId,
                            chunkCount: 0,
                            totalSize: 0
                        });
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

    /**
     * 清空所有缓存
     * @returns {Promise<void>}
     */
    async clearAllCache() {
        if (!this.#db) {
            throw new Error('IndexedDB not initialized');
        }

        const transaction = this.#db.transaction([this.#storeName], 'readwrite');
        const store = transaction.objectStore(this.#storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();

            request.onsuccess = () => {
                this.#logger.info('Cleared all cache');
                resolve();
            };

            request.onerror = () => {
                this.#logger.error('Failed to clear all cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 销毁缓存管理器
     */
    destroy() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
        }
        this.#logger.info('IndexedDB cache manager destroyed');
    }
}

export default IndexedDBCacheManager;