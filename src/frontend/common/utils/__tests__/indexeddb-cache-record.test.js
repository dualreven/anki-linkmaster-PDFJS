import { describe, it, expect } from "@jest/globals";

import { createChunkRecord } from "../indexeddb-cache-record.js";

describe("indexeddb-cache-record", () => {
  it("createChunkRecord：应生成包含 size/timestamp/lastAccessed 的记录", () => {
    const now = () => 12345;
    const data = new Uint8Array([1, 2, 3]).buffer;

    const record = createChunkRecord({
      fileId: "file-1",
      pageNumber: 7,
      chunkIndex: 2,
      chunkData: data,
      compressionType: "none",
      now
    });

    expect(record).toMatchObject({
      fileId: "file-1",
      pageNumber: 7,
      chunkIndex: 2,
      data,
      compressionType: "none",
      timestamp: 12345,
      lastAccessed: 12345,
      size: 3
    });
  });
});

