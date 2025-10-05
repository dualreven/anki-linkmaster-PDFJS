import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

/**
 * AI助手侧边栏UI
 */
export class AiAssistantSidebarUI {
  #eventBus;
  #annotationManager;
  #chatService;
  #logger;
  #root;
  #messagesContainer;
  #input;
  #sendButton;
  #annotationSelect;
  #statusBadge;
  #messages = [];
  #unsubs = [];
  #isSending = false;

  constructor({ eventBus, annotationManager, chatService, logger }) {
    this.#eventBus = eventBus;
    this.#annotationManager = annotationManager;
    this.#chatService = chatService;
    this.#logger = logger;
  }

  initialize() {
    this.#root = this.#createLayout();
    this.#refreshAnnotationOptions();
    this.#setupEventListeners();
  }

  getContentElement() {
    return this.#root;
  }

  destroy() {
    this.#unsubs.forEach((off) => off?.());
    this.#unsubs = [];
    this.#messages = [];
    if (this.#root?.parentNode) {
      this.#root.remove();
    }
    this.#root = null;
  }

  #createLayout() {
    const root = document.createElement('div');
    root.className = 'ai-assistant-sidebar';
    root.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'height: 100%'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'padding: 12px 16px',
      'border-bottom: 1px solid #eee',
      'background: #fafafa'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'AI问答助手';
    title.style.cssText = 'font-size: 16px; font-weight: 600; color: #333;';
    header.appendChild(title);

    this.#statusBadge = document.createElement('div');
    this.#statusBadge.textContent = '待命';
    this.#statusBadge.style.cssText = [
      'font-size: 12px',
      'color: #4caf50'
    ].join(';');
    header.appendChild(this.#statusBadge);

    this.#messagesContainer = document.createElement('div');
    this.#messagesContainer.style.cssText = [
      'flex: 1',
      'overflow-y: auto',
      'padding: 16px',
      'display: flex',
      'flex-direction: column',
      'gap: 12px'
    ].join(';');

    const composer = document.createElement('div');
    composer.style.cssText = [
      'border-top: 1px solid #eee',
      'padding: 12px 16px',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'background: #fafafa'
    ].join(';');

    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    this.#annotationSelect = document.createElement('select');
    this.#annotationSelect.style.cssText = [
      'flex: 1',
      'padding: 6px 8px',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'font-size: 13px'
    ].join(';');
    this.#annotationSelect.addEventListener('change', () => {
      const value = this.#annotationSelect.value;
      if (!value) return;
      if (this.#input) {
        const current = this.#input.value;
        this.#input.value = current ? `${current}\n${value}` : value;
        this.#input.focus();
      }
      this.#annotationSelect.value = '';
    });

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.textContent = '刷新标注';
    refreshBtn.style.cssText = [
      'padding: 6px 10px',
      'font-size: 12px',
      'border: 1px solid #ccc',
      'border-radius: 4px',
      'background: white',
      'cursor: pointer'
    ].join(';');
    refreshBtn.addEventListener('click', () => this.#refreshAnnotationOptions());

    controlsRow.appendChild(this.#annotationSelect);
    controlsRow.appendChild(refreshBtn);

    this.#input = document.createElement('textarea');
    this.#input.rows = 3;
    this.#input.placeholder = '输入问题，或通过上方下拉框插入文字标注';
    this.#input.style.cssText = [
      'width: 100%',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'padding: 8px',
      'resize: vertical',
      'font-family: inherit',
      'font-size: 14px'
    ].join(';');
    this.#input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.#handleSend();
      }
    });

    this.#sendButton = document.createElement('button');
    this.#sendButton.type = 'button';
    this.#sendButton.textContent = '发送';
    this.#sendButton.style.cssText = [
      'align-self: flex-end',
      'padding: 8px 16px',
      'background: #2196f3',
      'color: white',
      'border: none',
      'border-radius: 4px',
      'cursor: pointer',
      'font-size: 14px'
    ].join(';');
    this.#sendButton.addEventListener('click', () => this.#handleSend());

    composer.appendChild(controlsRow);
    composer.appendChild(this.#input);
    composer.appendChild(this.#sendButton);

    root.appendChild(header);
    root.appendChild(this.#messagesContainer);
    root.appendChild(composer);
    return root;
  }

  #setupEventListeners() {
    if (!this.#eventBus) return;
    const onCreated = (payload) => {
      if (payload?.annotation?.type === 'text-highlight') {
        this.#refreshAnnotationOptions();
      }
    };
    const onDeleted = (payload) => {
      if (payload?.annotation?.type === 'text-highlight' || payload?.type === 'text-highlight') {
        this.#refreshAnnotationOptions();
      }
    };

    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, onCreated);
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, onDeleted);

    this.#unsubs.push(() => this.#eventBus.off(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, onCreated));
    this.#unsubs.push(() => this.#eventBus.off(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, onDeleted));
  }

  #refreshAnnotationOptions() {
    if (!this.#annotationSelect) return;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '插入文字标注内容…';

    const fragment = document.createDocumentFragment();
    fragment.appendChild(defaultOption);

    if (this.#annotationManager) {
      const highlights = this.#annotationManager.getAnnotationsByType?.('text-highlight') || [];
      highlights.forEach((highlight) => {
        const option = document.createElement('option');
        option.value = `【标注】${(highlight.data?.selectedText || '').slice(0, 80)}`;
        option.textContent = `P.${highlight.pageNumber}：${(highlight.data?.selectedText || '').slice(0, 40)}`;
        fragment.appendChild(option);
      });
    }

    this.#annotationSelect.innerHTML = '';
    this.#annotationSelect.appendChild(fragment);
  }

  async #handleSend() {
    if (this.#isSending) {
      return;
    }

    const text = this.#input.value.trim();
    if (!text) {
      this.#input.focus();
      return;
    }

    this.#appendMessage('user', text);
    this.#input.value = '';
    this.#setSendingState(true);

    try {
      const response = await this.#chatService.sendMessage({
        history: this.#messages,
        message: text
      });

      this.#appendMessage('assistant', response?.text || '（未收到回答）');
    } catch (error) {
      this.#logger?.error('[AiAssistantSidebarUI] sendMessage failed', error);
      this.#appendMessage('assistant', `抱歉，服务暂时不可用：${error.message || error}`);
    } finally {
      this.#setSendingState(false);
    }
  }

  #appendMessage(role, text) {
    this.#messages.push({ role, text });

    if (!this.#messagesContainer) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'display: flex',
      'flex-direction: column',
      role === 'assistant' ? 'align-items: flex-start' : 'align-items: flex-end'
    ].join(';');

    const bubble = document.createElement('div');
    bubble.textContent = text;
    bubble.style.maxWidth = '85%';
    bubble.style.padding = '10px 12px';
    bubble.style.borderRadius = '8px';
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.fontSize = '14px';
    bubble.style.display = 'inline-block';

    if (role === 'assistant') {
      bubble.style.backgroundColor = '#f5f5f5';
      bubble.style.color = '#333333';
      bubble.style.border = '1px solid #eeeeee';
    } else {
      bubble.style.backgroundColor = '#2196f3';
      bubble.style.color = '#ffffff';
      bubble.style.border = '1px solid #2196f3';
    }

    wrapper.appendChild(bubble);
    this.#messagesContainer.appendChild(wrapper);
    this.#messagesContainer.scrollTop = this.#messagesContainer.scrollHeight;
  }

  #setSendingState(isSending) {
    this.#isSending = isSending;
    if (this.#sendButton) {
      this.#sendButton.disabled = isSending;
      this.#sendButton.textContent = isSending ? '发送中…' : '发送';
    }
    if (this.#statusBadge) {
      this.#statusBadge.textContent = isSending ? '思考中…' : '待命';
      this.#statusBadge.style.color = isSending ? '#ff9800' : '#4caf50';
    }
  }
}

export default AiAssistantSidebarUI;
