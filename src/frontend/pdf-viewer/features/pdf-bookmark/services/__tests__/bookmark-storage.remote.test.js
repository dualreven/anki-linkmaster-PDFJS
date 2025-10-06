import { RemoteBookmarkStorage } from '../bookmark-storage.js';

const createWsClient = () => ({
  isConnected: jest.fn().mockReturnValue(true),
  request: jest.fn(),
});

const createFallback = () => ({
  load: jest.fn(),
  save: jest.fn(),
  clear: jest.fn(),
});

describe('RemoteBookmarkStorage', () => {
  test('load 使用远端数据并写入本地缓存', async () => {
    const wsClient = createWsClient();
    const fallback = createFallback();
    const storage = new RemoteBookmarkStorage({ wsClient, fallback });

    wsClient.request.mockResolvedValue({
      bookmarks: [{ id: 'b1' }],
      root_ids: ['b1'],
    });

    const result = await storage.load('pdf-1');

    expect(wsClient.request).toHaveBeenCalledWith(
      expect.stringContaining('bookmark:list:records'),
      { pdf_uuid: 'pdf-1' },
      expect.any(Object)
    );
    expect(result).toEqual({ bookmarks: [{ id: 'b1' }], rootIds: ['b1'] });
    expect(fallback.save).toHaveBeenCalledWith('pdf-1', [{ id: 'b1' }], ['b1']);
  });

  test('load 在远端不可用时回退本地缓存', async () => {
    const wsClient = createWsClient();
    wsClient.isConnected.mockReturnValue(false);
    const fallback = createFallback();
    fallback.load.mockResolvedValue({ bookmarks: [], rootIds: [] });

    const storage = new RemoteBookmarkStorage({ wsClient, fallback });
    const result = await storage.load('pdf-2');

    expect(wsClient.request).not.toHaveBeenCalled();
    expect(fallback.load).toHaveBeenCalledWith('pdf-2');
    expect(result).toEqual({ bookmarks: [], rootIds: [] });
  });

  test('save 成功时调用远端并同步本地缓存', async () => {
    const wsClient = createWsClient();
    wsClient.request.mockResolvedValue({ saved: 1 });
    const fallback = createFallback();

    const storage = new RemoteBookmarkStorage({ wsClient, fallback });
    await storage.save('pdf-3', [{ id: 'b2' }], ['b2']);

    expect(wsClient.request).toHaveBeenCalledWith(
      expect.stringContaining('bookmark:save:record'),
      {
        pdf_uuid: 'pdf-3',
        bookmarks: [{ id: 'b2' }],
        root_ids: ['b2'],
      },
      expect.any(Object)
    );
    expect(fallback.save).toHaveBeenCalledWith('pdf-3', [{ id: 'b2' }], ['b2']);
  });

  test('save 远端失败时仍写入本地缓存', async () => {
    const wsClient = createWsClient();
    wsClient.request.mockRejectedValue(new Error('network error'));
    const fallback = createFallback();

    const storage = new RemoteBookmarkStorage({ wsClient, fallback });
    await storage.save('pdf-4', [{ id: 'b3' }], ['b3']);

    expect(fallback.save).toHaveBeenCalledWith('pdf-4', [{ id: 'b3' }], ['b3']);
  });
});
