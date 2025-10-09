import { AnchorSidebarUI } from '../anchor-sidebar-ui.js';
import eventBus from '../../../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

describe('AnchorSidebarUI load guard', () => {
  let ui;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    ui = new AnchorSidebarUI(eventBus);
    ui.initialize();
    document.getElementById('root').appendChild(ui.getContentElement());
  });

  afterEach(() => {
    ui?.destroy();
    document.body.innerHTML = '';
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('should show error and allow retry on LOAD_FAILED', () => {
    // 触发加载请求（开始加载态与超时计时）
    const payload = { pdf_uuid: 'test-pdf' };
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, payload, { actorId: 'test' });

    // 模拟失败
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED, { error: { message: 'backend unreachable' }, type: 'anchor:list:failed' }, { actorId: 'test' });

    // 断言出现错误提示
    const err = document.querySelector('.anchor-error');
    expect(err).toBeTruthy();
    expect(err.textContent).toContain('加载锚点失败');

    // 点击重试，期望重新发出 LOAD
    const spy = jest.spyOn(eventBus, 'emit');
    const btn = err.querySelector('button');
    btn.click();
    // 查找最近一次 emit 调用是否包含 DATA.LOAD
    const called = spy.mock.calls.some(([type]) => type === PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD);
    expect(called).toBe(true);
  });

  test('should show timeout error if no LOADED arrives', () => {
    jest.useFakeTimers();
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { pdf_uuid: 'test-pdf' }, { actorId: 'test' });
    // 快进时间（大于内置 5000ms 超时）
    jest.advanceTimersByTime(5200);
    const err = document.querySelector('.anchor-error');
    expect(err).toBeTruthy();
    expect(err.textContent).toContain('请求超时');
  });
});

