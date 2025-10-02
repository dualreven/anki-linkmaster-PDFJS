/**
 * @file 开关按钮组件
 * @module ToggleSwitch
 * @description
 * 原生JavaScript实现的开关按钮组件
 * 支持开/关状态切换，禁用状态，无障碍访问
 */

/**
 * 开关按钮组件类
 * @class ToggleSwitch
 * @description
 * 提供交互式开关按钮功能，支持状态管理和事件回调
 */
export class ToggleSwitch {
  // 私有字段
  #container;
  #checked;
  #disabled;
  #onChange;
  #label;
  #switchElement;
  #input;

  /**
   * 创建ToggleSwitch实例
   * @param {Object} options - 配置选项
   * @param {HTMLElement} options.container - 容器元素
   * @param {boolean} [options.checked=false] - 初始选中状态
   * @param {boolean} [options.disabled=false] - 是否禁用
   * @param {string} [options.label=''] - 标签文本
   * @param {Function} [options.onChange] - 状态变化回调
   */
  constructor(options = {}) {
    this.#container = options.container;
    this.#checked = options.checked || false;
    this.#disabled = options.disabled || false;
    this.#label = options.label || '';
    this.#onChange = options.onChange;

    this.#init();
  }

  /**
   * 初始化组件
   * @private
   */
  #init() {
    this.#container.classList.add('toggle-switch-wrapper');
    this.#render();
    this.#bindEvents();
  }

  /**
   * 渲染组件
   * @private
   */
  #render() {
    this.#container.innerHTML = `
      <label class="toggle-switch ${this.#disabled ? 'disabled' : ''}">
        <input
          type="checkbox"
          class="toggle-input"
          ${this.#checked ? 'checked' : ''}
          ${this.#disabled ? 'disabled' : ''}
        />
        <span class="toggle-slider"></span>
        ${this.#label ? `<span class="toggle-label">${this.#escapeHtml(this.#label)}</span>` : ''}
      </label>
    `;

    this.#switchElement = this.#container.querySelector('.toggle-switch');
    this.#input = this.#container.querySelector('.toggle-input');
  }

  /**
   * 绑定事件监听器
   * @private
   */
  #bindEvents() {
    this.#input.addEventListener('change', this.#handleChange.bind(this));

    // 支持键盘操作
    this.#input.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!this.#disabled) {
          this.toggle();
        }
      }
    });
  }

  /**
   * 处理状态变化事件
   * @private
   */
  #handleChange() {
    if (this.#disabled) return;

    const oldValue = this.#checked;
    this.#checked = this.#input.checked;

    if (oldValue !== this.#checked && this.#onChange) {
      this.#onChange(this.#checked);
    }
  }

  /**
   * 切换状态
   * @public
   */
  toggle() {
    if (this.#disabled) return;

    this.#checked = !this.#checked;
    this.#input.checked = this.#checked;

    if (this.#onChange) {
      this.#onChange(this.#checked);
    }
  }

  /**
   * 设置选中状态
   * @public
   * @param {boolean} checked - 是否选中
   */
  setChecked(checked) {
    const oldValue = this.#checked;
    this.#checked = checked;
    this.#input.checked = checked;

    if (oldValue !== this.#checked && this.#onChange) {
      this.#onChange(this.#checked);
    }
  }

  /**
   * 获取选中状态
   * @public
   * @returns {boolean} 是否选中
   */
  isChecked() {
    return this.#checked;
  }

  /**
   * 设置禁用状态
   * @public
   * @param {boolean} disabled - 是否禁用
   */
  setDisabled(disabled) {
    this.#disabled = disabled;
    this.#input.disabled = disabled;

    if (disabled) {
      this.#switchElement.classList.add('disabled');
    } else {
      this.#switchElement.classList.remove('disabled');
    }
  }

  /**
   * 获取禁用状态
   * @public
   * @returns {boolean} 是否禁用
   */
  isDisabled() {
    return this.#disabled;
  }

  /**
   * 设置标签文本
   * @public
   * @param {string} label - 新的标签文本
   */
  setLabel(label) {
    this.#label = label;
    const labelElement = this.#container.querySelector('.toggle-label');

    if (labelElement) {
      labelElement.textContent = label;
    } else if (label) {
      const slider = this.#container.querySelector('.toggle-slider');
      const newLabel = document.createElement('span');
      newLabel.className = 'toggle-label';
      newLabel.textContent = label;
      slider.insertAdjacentElement('afterend', newLabel);
    }
  }

  /**
   * HTML转义
   * @private
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    this.#container.innerHTML = '';
  }
}

/**
 * 创建ToggleSwitch组件的便捷函数
 * @param {Object} options - 配置选项
 * @returns {ToggleSwitch} ToggleSwitch实例
 */
export function createToggleSwitch(options) {
  return new ToggleSwitch(options);
}
