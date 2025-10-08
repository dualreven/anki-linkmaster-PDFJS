import eventBus from '../../../../common/event/event-bus.js';
import { createRealSidebarButtons } from '../real-sidebars.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

describe('Header Anchor Button', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header>
        <div class="header-right">
          <div id="pdf-viewer-button-container" class="sidebar-buttons"></div>
        </div>
      </header>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should create anchor button and emit toggle event on click', () => {
    let received = null;
    const off = eventBus.on(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED,
      (data) => { received = data; },
      { subscriberId: 'test' }
    );

    createRealSidebarButtons(eventBus);

    const btn = document.getElementById('anchor-sidebar-button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('锚点');

    btn.click();
    expect(received).toBeTruthy();
    expect(received.sidebarId).toBe('anchor');

    off && off();
  });
});

