/**
 * 说明（详细）：`docs/standards/indexeddb-cache-manager.md`
 */

export function createChunkRecord({
  fileId,
  pageNumber,
  chunkIndex,
  chunkData,
  compressionType = "none",
  now = Date.now
}) {
  if (!chunkData || typeof chunkData.byteLength !== "number") {
    throw new Error("Invalid chunkData: expected ArrayBuffer-like with byteLength");
  }

  const timestamp = now();

  return {
    fileId,
    pageNumber,
    chunkIndex,
    data: chunkData,
    compressionType,
    timestamp,
    lastAccessed: timestamp,
    size: chunkData.byteLength
  };
}

