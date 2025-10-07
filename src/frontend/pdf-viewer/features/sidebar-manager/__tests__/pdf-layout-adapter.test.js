import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
// 在导入被测模块前，mock 掉 logger 以规避 import.meta 解析问题
jest.unstable_mockModule('../../../../common/utils/logger.js', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    event: jest.fn(),
  }),
  LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }
}));

let PDFLayoutAdapter;
beforeAll(async () => {
  ({ PDFLayoutAdapter } = await import('../pdf-layout-adapter.js'));
});

class FakeEventBus {
  constructor() {
    this._handlers = new Map();
  }
  on(event, cb) {
    this._handlers.set(event, cb);
    return () => this._handlers.delete(event);
  }
  emit(event, data) {
    const cb = this._handlers.get(event);
    if (typeof cb === 'function') cb(data);
  }
}

describe('PDFLayoutAdapter', () => {
  beforeEach(() => {
    // 准备 DOM：模拟 pdf 容器
    document.body.innerHTML = `
      <main style="position:relative; width:1200px; height:800px;">
        <div id="viewerContainer" class="pdf-container" style="position:absolute; left:0; right:0; height:100%"></div>
      </main>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('当收到侧边栏布局更新事件时，应根据总宽度左移 PDF 容器', () => {
    const eventBus = new FakeEventBus();
    const adapter = new PDFLayoutAdapter(eventBus);
    adapter.initialize();

    // 触发布局更新事件（总宽度 320px）
    eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, { totalWidth: 320 });

    const container = document.getElementById('viewerContainer');
    expect(container.style.left).toBe('320px');
  });

  it('当总宽度为 0 时，应复位 PDF 容器到 0px', () => {
    const eventBus = new FakeEventBus();
    const adapter = new PDFLayoutAdapter(eventBus);
    adapter.initialize();

    // 先移动，再复位
    eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, { totalWidth: 280 });
    eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, { totalWidth: 0 });

    const container = document.getElementById('viewerContainer');
    expect(container.style.left).toBe('0px');
  });
});
