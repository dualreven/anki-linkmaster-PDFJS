/**
 * @file 星级评分组件
 * @module StarRating
 * @description
 * 原生JavaScript实现的星级评分组件
 * 支持0-5星评分，半星选择，鼠标悬停预览
 */

/**
 * 星级评分组件类
 * @class StarRating
 * @description
 * 提供交互式星级评分功能，支持点击选择和悬停预览
 */
export class StarRating {
  // 私有字段
  #container;
  #value;
  #maxStars;
  #onChange;
  #stars;
  #readonly;

  /**
   * 创建StarRating实例
   * @param {Object} options - 配置选项
   * @param {HTMLElement} options.container - 容器元素
   * @param {number} [options.value=0] - 初始值（0-5）
   * @param {number} [options.maxStars=5] - 最大星数
   * @param {Function} [options.onChange] - 值改变回调
   * @param {boolean} [options.readonly=false] - 是否只读
   */
  constructor(options = {}) {
    this.#container = options.container;
    this.#value = options.value || 0;
    this.#maxStars = options.maxStars || 5;
    this.#onChange = options.onChange;
    this.#readonly = options.readonly || false;
    this.#stars = [];

    this.#init();
  }

  /**
   * 初始化组件
   * @private
   */
  #init() {
    this.#container.classList.add('star-rating');
    if (this.#readonly) {
      this.#container.classList.add('readonly');
    }

    this.#render();
    this.#bindEvents();
  }

  /**
   * 渲染星星元素
   * @private
   */
  #render() {
    this.#container.innerHTML = '';
    this.#stars = [];

    for (let i = 1; i <= this.#maxStars; i++) {
      const star = document.createElement('span');
      star.classList.add('star');
      star.dataset.value = i;
      star.innerHTML = '★';

      this.#container.appendChild(star);
      this.#stars.push(star);
    }

    this.#updateDisplay(this.#value);
  }

  /**
   * 绑定事件监听器
   * @private
   */
  #bindEvents() {
    if (this.#readonly) return;

    this.#container.addEventListener('click', this.#handleClick.bind(this));
    this.#container.addEventListener('mousemove', this.#handleMouseMove.bind(this));
    this.#container.addEventListener('mouseleave', this.#handleMouseLeave.bind(this));
  }

  /**
   * 处理点击事件
   * @private
   * @param {MouseEvent} event - 鼠标事件
   */
  #handleClick(event) {
    const star = event.target.closest('.star');
    if (!star) return;

    const value = parseInt(star.dataset.value);
    const rect = star.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const halfWidth = rect.width / 2;

    // 支持半星选择
    const newValue = clickX < halfWidth ? value - 0.5 : value;

    this.setValue(newValue);
  }

  /**
   * 处理鼠标移动事件（悬停预览）
   * @private
   * @param {MouseEvent} event - 鼠标事件
   */
  #handleMouseMove(event) {
    const star = event.target.closest('.star');
    if (!star) return;

    const value = parseInt(star.dataset.value);
    const rect = star.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const halfWidth = rect.width / 2;

    const previewValue = mouseX < halfWidth ? value - 0.5 : value;
    this.#updateDisplay(previewValue, true);
  }

  /**
   * 处理鼠标离开事件
   * @private
   */
  #handleMouseLeave() {
    this.#updateDisplay(this.#value, false);
  }

  /**
   * 更新星星显示状态
   * @private
   * @param {number} value - 要显示的值
   * @param {boolean} [isPreview=false] - 是否为预览状态
   */
  #updateDisplay(value, isPreview = false) {
    this.#stars.forEach((star, index) => {
      const starValue = index + 1;

      star.classList.remove('full', 'half', 'empty', 'preview');

      if (isPreview) {
        star.classList.add('preview');
      }

      if (value >= starValue) {
        star.classList.add('full');
      } else if (value >= starValue - 0.5) {
        star.classList.add('half');
      } else {
        star.classList.add('empty');
      }
    });
  }

  /**
   * 设置评分值
   * @public
   * @param {number} value - 新的评分值（0-5）
   */
  setValue(value) {
    const oldValue = this.#value;
    this.#value = Math.max(0, Math.min(this.#maxStars, value));
    this.#updateDisplay(this.#value);

    if (oldValue !== this.#value && this.#onChange) {
      this.#onChange(this.#value);
    }
  }

  /**
   * 获取当前评分值
   * @public
   * @returns {number} 当前评分值
   */
  getValue() {
    return this.#value;
  }

  /**
   * 设置只读状态
   * @public
   * @param {boolean} readonly - 是否只读
   */
  setReadonly(readonly) {
    this.#readonly = readonly;

    if (readonly) {
      this.#container.classList.add('readonly');
    } else {
      this.#container.classList.remove('readonly');
    }
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    this.#container.innerHTML = '';
    this.#stars = [];
  }
}

/**
 * 创建StarRating组件的便捷函数
 * @param {Object} options - 配置选项
 * @returns {StarRating} StarRating实例
 */
export function createStarRating(options) {
  return new StarRating(options);
}
