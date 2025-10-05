/**
 * HighlightActionMenu - 文本高亮操作菜单
 * @module features/annotation/tools/text-highlight/highlight-action-menu
 */

/**
 * 文本高亮悬浮操作菜单
 */
export class HighlightActionMenu {
  /** @type {Logger} */
  #logger;

  /** @type {string[]} */
  #colorPresets;

  /** @type {Function} */
  #onDelete;

  /** @type {Function} */
  #onCopy;

  /** @type {Function} */
  #onColorChange;

  /** @type {Function} */
  #onJump;

  /** @type {Function} */
  #onTranslate;

  /** @type {Map<string, { hitbox: HTMLElement, toolbar: HTMLElement, palette: HTMLElement, colorButtons: HTMLElement[], hideTimer: number|null, activeColor: string }> } */
  #menus = new Map();

  /**
   * 构造函数
   * @param {Object} options - 配置项
   * @param {Logger} [options.logger=console] - 日志器
   * @param {string[]} [options.colorPresets] - 颜色预设
   * @param {Function} [options.onDelete] - 删除回调
   * @param {Function} [options.onCopy] - 复制回调
   * @param {Function} [options.onColorChange] - 换色回调
   * @param {Function} [options.onJump] - 跳转回调
   * @param {Function} [options.onTranslate] - 翻译回调
   */
  constructor(options = {}) {
    this.#logger = options.logger || console;
    this.#colorPresets = options.colorPresets || ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];
    this.#onDelete = options.onDelete || (() => {});
    this.#onCopy = options.onCopy || (() => {});
    this.#onColorChange = options.onColorChange || (() => {});
    this.#onJump = options.onJump || (() => {});
    this.#onTranslate = options.onTranslate || (() => {});
  }

  /**
   * 附加菜单到高亮容器
   * @param {HTMLElement} highlightContainer - 高亮容器
   * @param {Object} annotation - 标注对象
   * @param {Object} meta - 元信息
   * @param {{left:number, top:number, right:number, bottom:number, width:number, height:number}} meta.boundingBox - 包围盒
   * @returns {{ wrapper: HTMLElement, toolbar: HTMLElement }|null}
   */
  attach(highlightContainer, annotation, meta = {}) {
    const annotationId = annotation?.id;
    if (!highlightContainer || !annotationId) {
      this.#logger?.warn?.('[HighlightActionMenu] Missing container or annotation id');
      return null;
    }

    const parentLayer = highlightContainer.parentElement;
    if (!parentLayer) {
      this.#logger?.warn?.('[HighlightActionMenu] Highlight layer not found');
      return null;
    }

    this.detach(annotationId);

    const bounding = meta.boundingBox || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const width = Math.max(32, Math.floor(bounding.width));
    const height = Math.max(18, Math.floor(bounding.height));

    const hitbox = document.createElement('div');
    hitbox.className = 'text-highlight-action-hitbox';
    hitbox.style.cssText = [
      'position: absolute',
      `left: ${Math.max(0, bounding.left)}px`,
      `top: ${Math.max(0, bounding.top)}px`,
      `width: ${width}px`,
      `height: ${height}px`,
      'pointer-events: auto',
      'background: rgba(0,0,0,0)',
      'z-index: 6'
    ].join(';');

    const toolbar = document.createElement('div');
    toolbar.className = 'text-highlight-action-bar';
    toolbar.style.cssText = [
      'position: absolute',
      'top: -44px',
      'left: 0',
      'display: flex',
      'gap: 6px',
      'padding: 4px 8px',
      'border-radius: 6px',
      'background: rgba(33, 33, 33, 0.92)',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
      'opacity: 0',
      'pointer-events: none',
      'transition: opacity 0.2s ease',
      'color: #fff'
    ].join(';');

    if (bounding.top < 50) {
      toolbar.style.top = `${height + 12}px`;
    }

    const palette = document.createElement('div');
    palette.className = 'text-highlight-action-palette';
    palette.style.cssText = [
      'position: absolute',
      'top: 50%',
      'left: 100%',
      'transform: translate(8px, -50%)',
      'display: none',
      'gap: 6px',
      'background: rgba(33, 33, 33, 0.92)',
      'padding: 4px 6px',
      'border-radius: 6px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.25)'
    ].join(';');

    const state = {
      hideTimer: null,
      activeColor: annotation?.data?.highlightColor || this.#colorPresets[0],
      colorButtons: []
    };

    const showToolbar = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      toolbar.style.opacity = '1';
      toolbar.style.pointerEvents = 'auto';
    };

    const hideToolbar = () => {
      palette.style.display = 'none';
      toolbar.style.opacity = '0';
      toolbar.style.pointerEvents = 'none';
    };

    const scheduleHide = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
      }
      state.hideTimer = setTimeout(() => {
        hideToolbar();
        state.hideTimer = null;
      }, 180);
    };

    hitbox.addEventListener('mouseenter', showToolbar);
    hitbox.addEventListener('mouseleave', scheduleHide);
    toolbar.addEventListener('mouseenter', showToolbar);
    toolbar.addEventListener('mouseleave', scheduleHide);

    const createButton = ({ label, title, action, background = 'rgba(255,255,255,0.16)' }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'text-highlight-action-btn';
      btn.dataset.action = action;
      btn.title = title;
      btn.textContent = label;
      btn.style.cssText = [
        'min-width: 28px',
        'height: 28px',
        'border-radius: 6px',
        'border: none',
        'cursor: pointer',
        'font-size: 13px',
        'background: ' + background,
        'color: inherit',
        'padding: 0 8px'
      ].join(';');
      return btn;
    };

    const deleteBtn = createButton({ label: '🗑️', title: '删除标注', action: 'delete', background: '#f44336' });
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideToolbar();
      this.#onDelete?.(annotation);
    });

    const copyBtn = createButton({ label: '📋', title: '复制文本', action: 'copy' });
    copyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideToolbar();
      this.#onCopy?.(annotation);
    });

    const colorBtn = createButton({ label: '🎨', title: '切换颜色', action: 'color' });
    colorBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      palette.style.display = palette.style.display === 'flex' ? 'none' : 'flex';
    });

    const updateActiveColor = (color) => {
      state.activeColor = color;
      state.colorButtons.forEach((button) => {
        if (button.dataset.color === color) {
          button.style.transform = 'scale(1.15)';
          button.style.boxShadow = '0 0 0 2px #fff';
        } else {
          button.style.transform = 'scale(1)';
          button.style.boxShadow = 'none';
        }
      });
    };

    this.#colorPresets.forEach((color) => {
      const colorOption = document.createElement('button');
      colorOption.type = 'button';
      colorOption.dataset.color = color;
      colorOption.style.cssText = [
        'width: 22px',
        'height: 22px',
        'border-radius: 50%',
        'border: 2px solid rgba(255,255,255,0.8)',
        `background: ${color}`,
        'cursor: pointer',
        'padding: 0'
      ].join(';');
      colorOption.addEventListener('click', (event) => {
        event.stopPropagation();
        palette.style.display = 'none';
        updateActiveColor(color);
        this.#onColorChange?.(annotation, color);
      });
      palette.appendChild(colorOption);
      state.colorButtons.push(colorOption);
    });

    updateActiveColor(state.activeColor);

    const jumpBtn = createButton({ label: '🧭', title: '打开标注栏定位卡片', action: 'jump' });
    jumpBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideToolbar();
      this.#onJump?.(annotation);
    });

    const translateBtn = createButton({ label: '🌐', title: '发送到翻译栏', action: 'translate' });
    translateBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideToolbar();
      this.#onTranslate?.(annotation);
    });

    toolbar.appendChild(deleteBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(colorBtn);
    toolbar.appendChild(jumpBtn);
    toolbar.appendChild(translateBtn);
    toolbar.appendChild(palette);

    parentLayer.appendChild(hitbox);
    hitbox.appendChild(toolbar);

    state.hitbox = hitbox;
    state.toolbar = toolbar;
    state.palette = palette;

    this.#menus.set(annotationId, state);

    return { wrapper: hitbox, toolbar };
  }

  /**
   * 更新菜单颜色状态
   * @param {string} annotationId - 标注ID
   * @param {string} color - 当前高亮颜色
   */
  updateColor(annotationId, color) {
    const menu = this.#menus.get(annotationId);
    if (!menu) {
      return;
    }

    menu.activeColor = color;
    menu.colorButtons.forEach((button) => {
      if (button.dataset.color === color) {
        button.style.transform = 'scale(1.15)';
        button.style.boxShadow = '0 0 0 2px #fff';
      } else {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      }
    });
  }

  /**
   * 移除菜单
   * @param {string} annotationId - 标注ID
   */
  detach(annotationId) {
    const menu = this.#menus.get(annotationId);
    if (!menu) {
      return;
    }

    if (menu.hideTimer) {
      clearTimeout(menu.hideTimer);
      menu.hideTimer = null;
    }

    menu.hitbox.remove();
    this.#menus.delete(annotationId);
  }

  /**
   * 销毁全部菜单
   */
  destroy() {
    Array.from(this.#menus.keys()).forEach((annotationId) => this.detach(annotationId));
    this.#menus.clear();
  }
}

export default HighlightActionMenu;
