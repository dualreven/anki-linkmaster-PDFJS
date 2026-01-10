/**
 * @file WebSocketAdapter - visited_at 更新用例
 */

import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

describe("WebSocketAdapter visited_at 更新", () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });
    mockWSClient = { send: jest.fn(), isConnected: jest.fn(() => true) };
    adapter = new WebSocketAdapter(mockWSClient, eventBus, () => "abc123def456");
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    adapter && adapter.destroy();
    eventBus && eventBus.destroy();
  });

  it("在文件加载成功后应发送记录更新消息（visited_at），不再发送 pdf_loaded", () => {
    // 触发文件加载成功事件
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
      filePath: "/abs/path/sample.pdf",
      filename: "sample.pdf",
      totalPages: 12,
      url: "http://localhost:3000/static/sample.pdf"
    });

    const calls = mockWSClient.send.mock.calls.map((c) => c[0]);
    // 不应包含 legacy 的 pdf_loaded 消息
    expect(calls.find((m) => m && m.type === "pdf_loaded")).toBeUndefined();

    // 查找更新消息
    const updateMsg = calls.find((m) => m && m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(updateMsg).toBeTruthy();
    expect(updateMsg.data).toEqual(
      expect.objectContaining({
        file_id: "abc123def456",
        updates: expect.objectContaining({
          visited_at: expect.any(Number),
          json_data: expect.objectContaining({ last_accessed_at: expect.any(Number) })
        })
      })
    );
  });
});
