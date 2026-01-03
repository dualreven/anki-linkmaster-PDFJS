# IndexedDBCacheManager（PDF 分片缓存）说明

> 代码入口：`src/frontend/common/utils/indexeddb-cache-manager.js`

## 目标
- 为 PDF 分片提供基于 IndexedDB 的持久化缓存。
- 支持按 `fileId/pageNumber/chunkIndex` 存取、按页读取、按文件/页面清理、统计与 LRU 清理（100MB 上限）。

## 重要约束
- `storeChunk()` 内部必须在创建 transaction 前完成任何 `await`（否则 transaction 可能变为 inactive，fake-indexeddb 可稳定复现）。
- 订阅/回调类逻辑不存在；该模块以“IO + Promise + fail-fast”为主：未初始化直接抛错。

## 拆分（面条治理）
- `src/frontend/common/utils/indexeddb-cache-manager.js`：对外类与 IndexedDB 读写逻辑
- `src/frontend/common/utils/indexeddb-cache-record.js`：纯逻辑的 `createChunkRecord()`（便于单测与复用）

## 对外 API（保持兼容）
- `initialize()`
- `storeChunk(fileId, pageNumber, chunkIndex, chunkData, compressionType?)`
- `getChunk(fileId, pageNumber, chunkIndex)`
- `getPageChunks(fileId, pageNumber)`
- `clearFileCache(fileId)`
- `clearPageCache(fileId, pageNumber)`
- `getCacheStats()`
- `clearAllCache()`
- `destroy()`

