/**
 * @file IndexedDB缓存管理器单元测试
 * @module IndexedDBCacheManagerTest
 * @description 测试IndexedDB缓存管理器的基本功能
 */

import { IndexedDBCacheManager } from '../indexeddb-cache-manager.js';

// Mock indexedDB for testing
const mockIndexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn(),
};

// Mock global indexedDB
global.indexedDB = mockIndexedDB;

describe('IndexedDBCacheManager', () => {
    let cacheManager;
    let mockDB;
    let mockTransaction;
    let mockStore;
    let mockIndex;

    beforeEach(() => {
        jest.clearAllMocks();
        
        cacheManager = new IndexedDBCacheManager();
        
        // Setup mock objects
        mockDB = {
            objectStoreNames: { contains: jest.fn(), deleteObjectStore: jest.fn() },
            createObjectStore: jest.fn(),
            transaction: jest.fn(),
            close: jest.fn(),
        };
        
        mockTransaction = {
            objectStore: jest.fn(),
            oncomplete: jest.fn(),
            onerror: jest.fn(),
        };
        
        mockStore = {
            createIndex: jest.fn(),
            add: jest.fn(),
            get: jest.fn(),
            getAll: jest.fn(),
            clear: jest.fn(),
            delete: jest.fn(),
            openCursor: jest.fn(),
        };
        
        mockIndex = {
            get: jest.fn(),
            getAll: jest.fn(),
            openCursor: jest.fn(),
        };

        // Setup mock implementations
        mockIndexedDB.open.mockImplementation((name, version) => {
            const request = {
                onerror: null,
                onsuccess: null,
                onupgradeneeded: null,
                error: null,
                result: mockDB,
            };
            
            setTimeout(() => {
                if (request.onupgradeneeded) {
                    request.onupgradeneeded({ target: { result: mockDB } });
                }
                if (request.onsuccess) {
                    request.onsuccess({ target: { result: mockDB } });
                }
            }, 0);
            
            return request;
        });

        mockDB.transaction.mockReturnValue(mockTransaction);
        mockTransaction.objectStore.mockReturnValue(mockStore);
        mockStore.createIndex.mockReturnValue(mockIndex);
    });

    afterEach(() => {
        if (cacheManager) {
            cacheManager.destroy();
        }
    });

    describe('initialize', () => {
        test('应该成功初始化数据库', async () => {
            await expect(cacheManager.initialize()).resolves.toBeUndefined();
            expect(mockIndexedDB.open).toHaveBeenCalledWith('pdf_cache_db', 1);
        });

        test('应该处理初始化错误', async () => {
            mockIndexedDB.open.mockImplementation(() => {
                const request = {
                    onerror: jest.fn(),
                    onsuccess: null,
                    error: new Error('Database open failed'),
                };
                
                setTimeout(() => {
                    if (request.onerror) {
                        request.onerror({ target: { error: request.error } });
                    }
                }, 0);
                
                return request;
            });

            await expect(cacheManager.initialize()).rejects.toThrow('Database open failed');
        });
    });

    describe('storeChunk', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该成功存储分片数据', async () => {
            const testData = new ArrayBuffer(1024);
            mockStore.add.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            await expect(cacheManager.storeChunk('test-file', 1, 0, testData))
                .resolves.toBeUndefined();
            
            expect(mockStore.add).toHaveBeenCalled();
        });

        test('应该在存储配额超出时清理旧缓存', async () => {
            // Mock getStorageUsage to return more than max size
            cacheManager._getStorageUsage = jest.fn().mockResolvedValue(101 * 1024 * 1024);
            cacheManager._cleanupOldCache = jest.fn().mockResolvedValue(2 * 1024 * 1024);

            const testData = new ArrayBuffer(1024);
            mockStore.add.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            await cacheManager.storeChunk('test-file', 1, 0, testData);
            
            expect(cacheManager._cleanupOldCache).toHaveBeenCalledWith(1024 * 1024); // 1MB cleanup
        });
    });

    describe('getChunk', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该成功获取存在的分片数据', async () => {
            const testData = new ArrayBuffer(1024);
            mockIndex.get.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                    result: { data: testData },
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            const result = await cacheManager.getChunk('test-file', 1, 0);
            expect(result).toBe(testData);
        });

        test('应该返回null当分片不存在时', async () => {
            mockIndex.get.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                    result: null,
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            const result = await cacheManager.getChunk('test-file', 1, 0);
            expect(result).toBeNull();
        });
    });

    describe('getPageChunks', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该成功获取页面的所有分片', async () => {
            const chunk1 = { chunkIndex: 0, data: new ArrayBuffer(512) };
            const chunk2 = { chunkIndex: 1, data: new ArrayBuffer(512) };
            
            mockIndex.getAll.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                    result: [chunk1, chunk2],
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            const result = await cacheManager.getPageChunks('test-file', 1);
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(chunk1.data);
            expect(result[1]).toBe(chunk2.data);
        });
    });

    describe('clearFileCache', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该成功清理文件缓存', async () => {
            mockIndex.openCursor.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                };
                
                // Simulate cursor iteration
                let callCount = 0;
                request.onsuccess = () => {
                    if (callCount === 0) {
                        request.result = {
                            value: { id: 1 },
                            delete: jest.fn(),
                            continue: jest.fn(),
                        };
                        callCount++;
                    } else {
                        request.result = null;
                    }
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            await expect(cacheManager.clearFileCache('test-file')).resolves.toBeUndefined();
        });
    });

    describe('getCacheStats', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该返回正确的缓存统计信息', async () => {
            const chunk1 = { fileId: 'file1', size: 1024 };
            const chunk2 = { fileId: 'file1', size: 2048 };
            
            mockStore.openCursor.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                };
                
                let callCount = 0;
                request.onsuccess = () => {
                    if (callCount === 0) {
                        request.result = {
                            value: chunk1,
                            continue: jest.fn(),
                        };
                        callCount++;
                    } else if (callCount === 1) {
                        request.result = {
                            value: chunk2,
                            continue: jest.fn(),
                        };
                        callCount++;
                    } else {
                        request.result = null;
                    }
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            const stats = await cacheManager.getCacheStats();
            expect(stats.totalFiles).toBe(1);
            expect(stats.totalChunks).toBe(2);
            expect(stats.totalSize).toBe(3072);
            expect(stats.fileStats).toHaveLength(1);
        });
    });

    describe('clearAllCache', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该成功清理所有缓存', async () => {
            mockStore.clear.mockImplementation(() => {
                const request = {
                    onsuccess: jest.fn(),
                    onerror: null,
                };
                
                setTimeout(() => request.onsuccess(), 0);
                return request;
            });

            await expect(cacheManager.clearAllCache()).resolves.toBeUndefined();
            expect(mockStore.clear).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该正确处理数据库操作错误', async () => {
            mockStore.add.mockImplementation(() => {
                const request = {
                    onsuccess: null,
                    onerror: jest.fn(),
                    error: new Error('Add operation failed'),
                };
                
                setTimeout(() => {
                    if (request.onerror) {
                        request.onerror({ target: { error: request.error } });
                    }
                }, 0);
                
                return request;
            });

            await expect(cacheManager.storeChunk('test-file', 1, 0, new ArrayBuffer(1024)))
                .rejects.toThrow('Add operation failed');
        });
    });

    describe('LRU缓存清理策略', () => {
        beforeEach(async () => {
            await cacheManager.initialize();
        });

        test('应该按LRU顺序清理缓存', async () => {
            // 模拟存储多个分片
            const chunk1 = new ArrayBuffer(512 * 1024); // 0.5MB
            const chunk2 = new ArrayBuffer(512 * 1024); // 0.5MB
            const chunk3 = new ArrayBuffer(512 * 1024); // 0.5MB

            // 存储分片
            await cacheManager.storeChunk('file1', 1, 0, chunk1);
            await cacheManager.storeChunk('file1', 1, 1, chunk2);
            await cacheManager.storeChunk('file1', 1, 2, chunk3);

            // 访问chunk2和chunk3，让chunk1成为最久未访问的
            await cacheManager.getChunk('file1', 1, 1);
            await cacheManager.getChunk('file1', 1, 2);

            // 模拟存储使用量超过限制
            cacheManager._getStorageUsage = jest.fn().mockResolvedValue(101 * 1024 * 1024);
            
            // 存储新分片触发清理
            const newChunk = new ArrayBuffer(1024 * 1024); // 1MB
            await cacheManager.storeChunk('file2', 1, 0, newChunk);

            // 验证chunk1被清理（最早访问的）
            const remainingChunk = await cacheManager.getChunk('file1', 1, 0);
            expect(remainingChunk).toBeNull();
        });

        test('应该正确更新访问时间戳', async () => {
            const chunk = new ArrayBuffer(1024);
            await cacheManager.storeChunk('test-file', 1, 0, chunk);

            // 第一次访问
            await cacheManager.getChunk('test-file', 1, 0);
            
            // 稍等片刻再次访问
            await new Promise(resolve => setTimeout(resolve, 10));
            await cacheManager.getChunk('test-file', 1, 0);

            // 验证访问时间被更新（通过清理行为验证）
            cacheManager._getStorageUsage = jest.fn().mockResolvedValue(101 * 1024 * 1024);
            const newChunk = new ArrayBuffer(1024);
            await cacheManager.storeChunk('test-file2', 1, 0, newChunk);

            // 如果访问时间正确更新，原分片应该还在
            const originalChunk = await cacheManager.getChunk('test-file', 1, 0);
            expect(originalChunk).not.toBeNull();
        });

        test('应该在多个文件间正确应用LRU', async () => {
            // 创建多个文件的分片
            for (let i = 0; i < 5; i++) {
                const chunk = new ArrayBuffer(200 * 1024); // 0.2MB
                await cacheManager.storeChunk(`file${i}`, 1, 0, chunk);
            }

            // 访问特定的分片来改变访问顺序
            await cacheManager.getChunk('file2', 1, 0);
            await cacheManager.getChunk('file3', 1, 0);

            // 触发清理
            cacheManager._getStorageUsage = jest.fn().mockResolvedValue(101 * 1024 * 1024);
            const newChunk = new ArrayBuffer(500 * 1024); // 0.5MB
            await cacheManager.storeChunk('new-file', 1, 0, newChunk);

            // 验证最少访问的文件被清理（file0和file1）
            const leastAccessed1 = await cacheManager.getChunk('file0', 1, 0);
            const leastAccessed2 = await cacheManager.getChunk('file1', 1, 0);
            expect(leastAccessed1).toBeNull();
            expect(leastAccessed2).toBeNull();

            // 验证最近访问的文件还在
            const recentAccessed1 = await cacheManager.getChunk('file2', 1, 0);
            const recentAccessed2 = await cacheManager.getChunk('file3', 1, 0);
            expect(recentAccessed1).not.toBeNull();
            expect(recentAccessed2).not.toBeNull();
        });

        test('应该处理大量数据的LRU清理', async () => {
            // 创建大量小分片来测试LRU性能
            const chunkSize = 100 * 1024; // 100KB
            const chunkCount = 50; // 50个分片 = 5MB
            
            for (let i = 0; i < chunkCount; i++) {
                const chunk = new ArrayBuffer(chunkSize);
                await cacheManager.storeChunk('large-file', 1, i, chunk);
            }

            // 随机访问一些分片
            await cacheManager.getChunk('large-file', 1, 10);
            await cacheManager.getChunk('large-file', 1, 25);
            await cacheManager.getChunk('large-file', 1, 40);

            // 触发大规模清理
            cacheManager._getStorageUsage = jest.fn().mockResolvedValue(105 * 1024 * 1024); // 超过5MB
            const largeChunk = new ArrayBuffer(3 * 1024 * 1024); // 3MB
            await cacheManager.storeChunk('huge-file', 1, 0, largeChunk);

            // 验证最少访问的分片被清理
            const untouchedChunk = await cacheManager.getChunk('large-file', 1, 0);
            expect(untouchedChunk).toBeNull();

            // 验证最近访问的分片还在
            const accessedChunk = await cacheManager.getChunk('large-file', 1, 10);
            expect(accessedChunk).not.toBeNull();
        });
    });
});