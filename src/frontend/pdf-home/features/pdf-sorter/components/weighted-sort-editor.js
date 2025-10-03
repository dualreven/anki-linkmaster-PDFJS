/**
 * @file 加权排序编辑器组件
 * @module features/pdf-sorter/components/weighted-sort-editor
 * @description
 * 提供加权排序功能，用户可以输入数学公式来计算权重分数
 * 支持字段引用、基本运算符和常用函数
 */

/**
 * 加权排序编辑器组件
 * @class WeightedSortEditor
 */
export class WeightedSortEditor {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 作用域事件总线
   * @type {ScopedEventBus}
   * @private
   */
  #eventBus = null;

  /**
   * 容器DOM元素
   * @type {HTMLElement|null}
   * @private
   */
  #container = null;

  /**
   * 公式输入框
   * @type {HTMLTextAreaElement|null}
   * @private
   */
  #formulaInput = null;

  /**
   * 当前公式
   * @type {string}
   * @private
   */
  #currentFormula = '';

  /**
   * 可用字段列表
   * @type {Array<{field: string, label: string, type: string}>}
   * @private
   */
  #availableFields = [];

  /**
   * 公式验证结果
   * @type {Object|null}
   * @private
   */
  #validationResult = null;

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {ScopedEventBus} eventBus - 作用域事件总线
   * @param {Object} options - 配置选项
   * @param {Array} options.availableFields - 可用字段
   */
  constructor(logger, eventBus, options = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#availableFields = options.availableFields || [];

    // 初始化默认公式
    this.#currentFormula = 'size * 0.3 + star * 0.5 - page_count * 0.1';
  }

  /**
   * 渲染组件
   * @param {HTMLElement} container - 容器元素
   * @public
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#bindElements();
    this.#attachEventListeners();

    this.#logger.info('[WeightedSortEditor] Rendered');
  }

  /**
   * 获取HTML模板
   * @returns {string}
   * @private
   */
  #getTemplate() {
    return `
      <div class="weighted-sort-editor">
        <div class="weighted-sort-header">
          <h4>加权排序配置</h4>
          <small>使用数学公式计算权重分数</small>
        </div>

        <div class="formula-editor-section">
          <label for="formula-input">权重公式:</label>
          <textarea
            id="formula-input"
            class="formula-input"
            rows="3"
            placeholder="例如: size * 0.3 + star * 0.5 - page_count * 0.1"
          >${this.#currentFormula}</textarea>

          <div class="formula-validation">
            <span class="validation-status"></span>
          </div>
        </div>

        <div class="available-fields-section">
          <h5>可用字段:</h5>
          <div class="fields-list">
            ${this.#availableFields.map(f => `
              <button
                class="field-tag"
                data-field="${f.field}"
                title="点击插入到公式"
              >
                ${f.label} <code>${f.field}</code>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="available-operators-section">
          <h5>可用运算符和函数:</h5>
          <div class="operators-list">
            <span class="operator-tag" title="加法">+</span>
            <span class="operator-tag" title="减法">-</span>
            <span class="operator-tag" title="乘法">*</span>
            <span class="operator-tag" title="除法">/</span>
            <span class="operator-tag" title="取余">%</span>
            <span class="operator-tag" title="幂运算">**</span>
            <span class="operator-tag" title="绝对值">abs(x)</span>
            <span class="operator-tag" title="向上取整">ceil(x)</span>
            <span class="operator-tag" title="向下取整">floor(x)</span>
            <span class="operator-tag" title="四舍五入">round(x)</span>
            <span class="operator-tag" title="最大值">max(a,b)</span>
            <span class="operator-tag" title="最小值">min(a,b)</span>
          </div>
        </div>

        <div class="formula-examples-section">
          <h5>公式示例:</h5>
          <ul class="examples-list">
            <li><code>size * 0.5 + star * 0.3</code> - 文件大小和星标加权</li>
            <li><code>star * 10 - page_count</code> - 优先高星标，页数越少越靠前</li>
            <li><code>abs(size - 5000000) * -1</code> - 文件大小越接近5MB越靠前</li>
          </ul>
        </div>

        <div class="weighted-sort-actions">
          <button class="btn-test-formula" title="测试公式">
            🧪 测试公式
          </button>
          <button class="btn-apply-weighted" title="应用加权排序">
            ✅ 应用排序
          </button>
          <button class="btn-clear-weighted" title="清除排序">
            🗑️ 清除排序
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定DOM元素
   * @private
   */
  #bindElements() {
    this.#formulaInput = this.#container.querySelector('.formula-input');
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 公式输入变更
    this.#formulaInput.addEventListener('input', (e) => {
      this.#currentFormula = e.target.value;
      this.#validateFormula();
    });

    // 字段标签点击插入
    const fieldTags = this.#container.querySelectorAll('.field-tag');
    fieldTags.forEach(tag => {
      tag.addEventListener('click', () => {
        this.#insertFieldToFormula(tag.dataset.field);
      });
    });

    // 测试公式按钮
    const btnTest = this.#container.querySelector('.btn-test-formula');
    btnTest.addEventListener('click', () => this.#handleTestFormula());

    // 应用排序按钮
    const btnApply = this.#container.querySelector('.btn-apply-weighted');
    btnApply.addEventListener('click', () => this.#handleApplyWeightedSort());

    // 清除排序按钮
    const btnClear = this.#container.querySelector('.btn-clear-weighted');
    btnClear.addEventListener('click', () => this.#handleClearSort());

    this.#logger.debug('[WeightedSortEditor] Event listeners attached');
  }

  /**
   * 插入字段到公式
   * @param {string} field - 字段名
   * @private
   */
  #insertFieldToFormula(field) {
    const cursorPos = this.#formulaInput.selectionStart;
    const textBefore = this.#currentFormula.substring(0, cursorPos);
    const textAfter = this.#currentFormula.substring(this.#formulaInput.selectionEnd);

    this.#currentFormula = textBefore + field + textAfter;
    this.#formulaInput.value = this.#currentFormula;

    // 设置光标位置
    const newPos = cursorPos + field.length;
    this.#formulaInput.setSelectionRange(newPos, newPos);
    this.#formulaInput.focus();

    this.#validateFormula();
    this.#logger.debug(`[WeightedSortEditor] Field inserted: ${field}`);
  }

  /**
   * 验证公式
   * @private
   */
  #validateFormula() {
    const validationStatus = this.#container.querySelector('.validation-status');

    if (!this.#currentFormula.trim()) {
      validationStatus.textContent = '';
      validationStatus.className = 'validation-status';
      return;
    }

    try {
      // 基础语法检查
      const result = this.#performBasicValidation(this.#currentFormula);

      if (result.valid) {
        validationStatus.textContent = '✅ 公式格式正确';
        validationStatus.className = 'validation-status valid';
        this.#validationResult = result;
      } else {
        validationStatus.textContent = `❌ ${result.error}`;
        validationStatus.className = 'validation-status invalid';
        this.#validationResult = null;
      }
    } catch (error) {
      validationStatus.textContent = `❌ 验证失败: ${error.message}`;
      validationStatus.className = 'validation-status invalid';
      this.#validationResult = null;
    }
  }

  /**
   * 执行基础验证
   * @param {string} formula - 公式字符串
   * @returns {Object} 验证结果
   * @private
   */
  #performBasicValidation(formula) {
    // 检查括号匹配
    const openBrackets = (formula.match(/\(/g) || []).length;
    const closeBrackets = (formula.match(/\)/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return { valid: false, error: '括号不匹配' };
    }

    // 检查是否包含有效字段
    const fieldNames = this.#availableFields.map(f => f.field);
    const hasValidField = fieldNames.some(field => formula.includes(field));
    if (!hasValidField) {
      return { valid: false, error: '公式中未包含任何有效字段' };
    }

    // 检查非法字符（简单检查）
    const allowedChars = /^[a-zA-Z0-9_+\-*/%()., ]+$/;
    if (!allowedChars.test(formula)) {
      return { valid: false, error: '公式包含非法字符' };
    }

    return { valid: true, formula };
  }

  /**
   * 处理测试公式
   * @private
   */
  #handleTestFormula() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn('[WeightedSortEditor] Cannot test invalid formula');
      alert('请先修复公式错误');
      return;
    }

    this.#logger.info('[WeightedSortEditor] Testing formula:', this.#currentFormula);

    // 触发测试事件（三段式格式）
    this.#eventBus.emit('sorter:formula:tested', {
      formula: this.#currentFormula
    });

    alert(`公式测试请求已发送\n公式: ${this.#currentFormula}\n\n实际测试功能需要在后续实现`);
  }

  /**
   * 处理应用加权排序
   * @private
   */
  #handleApplyWeightedSort() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn('[WeightedSortEditor] Cannot apply invalid formula');
      alert('请先修复公式错误');
      return;
    }

    this.#logger.info('[WeightedSortEditor] Applying weighted sort:', this.#currentFormula);

    // 触发应用排序事件（三段式格式）
    this.#eventBus.emit('sorter:sort:requested', {
      type: 'weighted',
      formula: this.#currentFormula
    });
  }

  /**
   * 处理清除排序
   * @private
   */
  #handleClearSort() {
    this.#currentFormula = '';
    this.#formulaInput.value = '';
    this.#validateFormula();
    this.#logger.info('[WeightedSortEditor] Formula cleared');

    // 触发清除排序事件（三段式格式）
    this.#eventBus.emit('sorter:sort:cleared', {});
  }

  /**
   * 获取当前公式
   * @returns {string}
   * @public
   */
  getFormula() {
    return this.#currentFormula;
  }

  /**
   * 设置公式（编程方式）
   * @param {string} formula - 公式字符串
   * @public
   */
  setFormula(formula) {
    this.#currentFormula = formula;
    this.#formulaInput.value = formula;
    this.#validateFormula();
    this.#logger.info('[WeightedSortEditor] Formula set:', formula);
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = '';
    }
    this.#logger.info('[WeightedSortEditor] Destroyed');
  }
}
