/**
 * Quick actions toolbar for text selection.
 * @module features/text-selection-quick-actions/quick-actions-toolbar
 */

const BUTTON_DEFS = [
  { key: 'copy', label: '复制' },
  { key: 'annotate', label: '标注' },
  { key: 'translate', label: '翻译' },
  { key: 'ai', label: 'AI' }
];

export class QuickActionsToolbar {
  #root;
  #buttons = new Map();
  #callbacks = {};

  constructor(callbacks = {}) {
    this.#callbacks = { ...callbacks };
    this.#root = this.#createToolbar();
  }

  #createToolbar() {
    const container = document.createElement('div');
    container.className = 'text-selection-quick-actions';
    container.style.cssText = [
      'position: absolute',
      'display: none',
      'flex-direction: row',
      'gap: 8px',
      'padding: 8px 10px',
      'background: rgba(33,33,33,0.92)',
      'color: #fff',
      'border-radius: 8px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
      'z-index: 9999',
      'font-size: 14px',
      'user-select: none'
    ].join(';');

    BUTTON_DEFS.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.action = key;
      btn.textContent = label;
      btn.style.cssText = [
        'border: none',
        'padding: 6px 12px',
        'border-radius: 6px',
        'cursor: pointer',
        'background: rgba(255,255,255,0.12)',
        'color: inherit',
        'font-size: inherit',
        'transition: background 0.2s ease'
      ].join(';');

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,0.25)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255,255,255,0.12)';
      });
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const cb = this.#callbacks[key];
        if (typeof cb === 'function') {
          cb();
        }
      });

      container.appendChild(btn);
      this.#buttons.set(key, btn);
    });

    document.body.appendChild(container);
    return container;
  }

  setCallbacks(callbacks = {}) {
    this.#callbacks = { ...this.#callbacks, ...callbacks };
  }

  show(position) {
    const { x, y } = position || {};
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;

    this.#root.style.display = 'flex';
    this.#root.style.visibility = 'hidden';
    this.#root.style.left = `${x + scrollX}px`;
    this.#root.style.top = `${y + scrollY}px`;

    // 强制渲染后进行位置调整，避免超出可视区域
    const rect = this.#root.getBoundingClientRect();
    let left = x + scrollX;
    let top = y + scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.width > 0 && x + rect.width > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - rect.width - 10) + scrollX;
    }

    if (rect.height > 0 && y + rect.height > viewportHeight - 10) {
      top = Math.max(10, viewportHeight - rect.height - 10) + scrollY;
    }

    this.#root.style.left = `${left}px`;
    this.#root.style.top = `${top}px`;
    this.#root.style.visibility = 'visible';
  }

  contains(node) {
    return !!(this.#root && node && this.#root.contains(node));
  }

  hide() {
    if (this.#root) {
      this.#root.style.display = 'none';
    }
  }

  destroy() {
    this.hide();
    if (this.#root?.parentNode) {
      this.#root.parentNode.removeChild(this.#root);
    }
    this.#root = null;
    this.#buttons.clear();
    this.#callbacks = {};
  }
}
