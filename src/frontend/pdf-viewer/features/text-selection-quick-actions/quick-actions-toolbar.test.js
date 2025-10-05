import { QuickActionsToolbar } from './quick-actions-toolbar.js';

describe('QuickActionsToolbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('show and hide toggles visibility', () => {
    const toolbar = new QuickActionsToolbar();
    expect(document.querySelector('.text-selection-quick-actions')).not.toBeNull();

    toolbar.show({ x: 50, y: 50 });
    const root = document.querySelector('.text-selection-quick-actions');
    expect(root.style.display).toBe('flex');

    toolbar.hide();
    expect(root.style.display).toBe('none');

    toolbar.destroy();
    expect(document.querySelector('.text-selection-quick-actions')).toBeNull();
  });
});
