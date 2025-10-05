import { AiChatService } from '../ai-chat-service.js';

describe('AiChatService', () => {
  test('builds request url with params and parses response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Hello user' })
    });

    const service = new AiChatService({
      endpoint: 'https://example.com/api',
      botName: 'Bot',
      ownerName: 'Owner',
      sessionId: 'session-123',
      fetchImpl: fetchMock
    });

    const result = await service.sendMessage({ history: [], message: 'Hi' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('https://example.com/api');
    expect(calledUrl).toContain('message=Hi');
    expect(calledUrl).toContain('botname=Bot');
    expect(calledUrl).toContain('ownername=Owner');
    expect(calledUrl).toContain('user=session-123');
    expect(result).toEqual({ role: 'assistant', text: 'Hello user' });
  });

  test('throws when response is not ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    const service = new AiChatService({ fetchImpl: fetchMock });

    await expect(service.sendMessage({ history: [], message: 'Hi' }))
      .rejects.toThrow('AI服务返回错误: 502');
  });
});
