/**
 * AI聊天服务，封装调用公共AI接口的逻辑
 */
export class AiChatService {
  #endpoint;
  #botName;
  #ownerName;
  #sessionId;
  #fetchImpl;

  constructor(options = {}) {
    const {
      endpoint = 'https://api.affiliateplus.xyz/api/chatbot',
      botName = 'LinkMasterAI',
      ownerName = 'LinkMasterUser',
      sessionId = `session_${Date.now()}`,
      fetchImpl = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null)
    } = options;

    if (!fetchImpl) {
      throw new Error('AiChatService requires a fetch implementation');
    }

    this.#endpoint = endpoint;
    this.#botName = botName;
    this.#ownerName = ownerName;
    this.#sessionId = sessionId;
    this.#fetchImpl = fetchImpl;
  }

  async sendMessage({ history = [], message }) {
    if (!message) {
      throw new Error('message is required');
    }

    const url = new URL(this.#endpoint);
    url.searchParams.set('message', message);
    url.searchParams.set('botname', this.#botName);
    url.searchParams.set('ownername', this.#ownerName);
    url.searchParams.set('user', this.#sessionId);

    const response = await this.#fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`AI服务返回错误: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.message || data?.reply || '（无内容）';

    return {
      role: 'assistant',
      text
    };
  }
}

export default AiChatService;
