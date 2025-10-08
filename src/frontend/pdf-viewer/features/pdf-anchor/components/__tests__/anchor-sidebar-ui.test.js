import { AnchorSidebarUI } from '../anchor-sidebar-ui.js';
import eventBus from '../../../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

describe('AnchorSidebarUI', () => {
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
  });

  test('should render toolbar buttons 添加/删除/修改/复制/激活', () => {
    const bar = document.querySelector('.anchor-toolbar');
    expect(bar).toBeTruthy();
    const labels = Array.from(bar.querySelectorAll('button')).map(b => b.textContent.trim());
    expect(labels).toEqual(['添加','删除','修改','复制','激活']);
  });

  test('should render table with columns 名称/页码/激活 and rows', () => {
    // emit anchors loaded
    const anchors = [
      { uuid: 'aaaaaaaaaaaa', name: '示例锚点', page_at: 3, is_active: true },
      { uuid: 'bbbbbbbbbbbb', name: '第二个', page_at: 10, is_active: false },
    ];
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: 'test' });

    const ths = Array.from(document.querySelectorAll('thead th')).map(th => th.textContent.trim());
    expect(ths).toEqual(['名称','页码','激活']);

    const rows = Array.from(document.querySelectorAll('tbody[data-role="anchor-tbody"] tr'));
    expect(rows.length).toBe(2);
    const firstName = rows[0].querySelector('td').textContent.trim();
    expect(firstName).toBe('示例锚点');
  });
});

