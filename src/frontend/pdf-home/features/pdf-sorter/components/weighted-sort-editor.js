/**
 * @file 加权排序编辑器组件
 * @module features/pdf-sorter/components/weighted-sort-editor
 * @description
 * 提供纯鼠标交互的加权排序公式构建器，支持字段、运算符、函数与数字面板
 */

export class WeightedSortEditor {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {import('../../../common/event/scoped-event-bus.js').ScopedEventBus} */
  #eventBus = null;

  /** @type {HTMLElement|null} */
  #container = null;

  /** @type {Array<{type: string, value: string, name?: string}>} */
  #tokens = [];

  /** @type {Array<{field: string, label: string, type: string}>} */
  #availableFields = [];

  /** @type {string} */
  #currentFormula = '';

  /** @type {string} */
  #numberBuffer = '';

  /** @type {{ name: string, label: string, arity: number, args: string[] }|null} */
  #pendingFunction = null;

  /** @type {Object|null} */
  #validationResult = null;

  /** @type {HTMLElement|null} */
  #tokenListEl = null;

  /** @type {HTMLElement|null} */
  #previewCodeEl = null;

  /** @type {HTMLElement|null} */
  #pendingIndicatorHost = null;

  /** @type {HTMLElement|null} */
  #numberDisplayEl = null;

  /** @type {HTMLElement|null} */
  #validationStatusEl = null;

  /** @type {Function|null} */
  #containerClickHandler = null;

  /** @type {ReadonlyArray<string>} */
  #operators = ['+', '-', '*', '/', '(', ')'];

  /** @type {ReadonlyArray<string>} */
  #numberPadDigits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'];

  /** @type {Readonly<Record<string, { name: string, label: string, display: string, arity: number }>>} */
  #functionDefinitions = {
    abs: { name: 'abs', label: '绝对值', display: 'abs(x)', arity: 1 },
    round: { name: 'round', label: '四舍五入', display: 'round(x)', arity: 1 },
    max: { name: 'max', label: '最大值', display: 'max(a, b)', arity: 2 },
    min: { name: 'min', label: '最小值', display: 'min(a, b)', arity: 2 },
    length: { name: 'length', label: '长度(字符数)', display: 'length(x)', arity: 1 },
    clamp: { name: 'clamp', label: '范围限制', display: 'clamp(x, min, max)', arity: 3 },
    normalize: { name: 'normalize', label: '归一化', display: 'normalize(x, min, max)', arity: 3 },
    // 标签相关（作用于 tags 列表，全部走 SQL JSON1 实现）
    tags_length: { name: 'tags_length', label: '标签数量', display: 'tags_length()', arity: 0 },
    tags_has: { name: 'tags_has', label: '包含标签', display: "tags_has('tag')", arity: 1 },
    tags_has_any: { name: 'tags_has_any', label: '包含任一标签', display: "tags_has_any('t1','t2')", arity: 2 },
    tags_has_all: { name: 'tags_has_all', label: '包含全部标签', display: "tags_has_all('t1','t2')", arity: 2 }
  };

  /**
   * @param {import('../../../common/utils/logger.js').Logger} logger
   * @param {import('../../../common/event/scoped-event-bus.js').ScopedEventBus} eventBus
   * @param {{ availableFields?: Array<{field: string, label: string, type: string}> }} options
   */
  constructor(logger, eventBus, options = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#availableFields = options.availableFields || [];

    this.#tokens = [];
    this.#currentFormula = '';
  }

  /**
   * 渲染组件
   * @param {HTMLElement} container
   */
  render(container) {
    if (!container) {
      throw new Error('WeightedSortEditor: container is required');
    }

    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();

    this.#cacheElements();
    this.#bindEvents();
    this.#syncView();

    this.#logger.info('[WeightedSortEditor] Rendered');
  }

  /**
   * 生成模板
   * @returns {string}
   */
  #getTemplate() {
    const fieldButtons = this.#availableFields.map((field) => `
      <button
        type="button"
        class="builder-chip field-button"
        data-test="field-button"
        data-field="${field.field}"
        title="插入字段 ${field.label}"
      >
        <span>${field.label}</span>
        <code>${field.field}</code>
      </button>
    `).join('');

    const operatorButtons = this.#operators.map((operator) => `
      <button
        type="button"
        class="builder-chip operator-button"
        data-test="operator-button"
        data-operator="${operator}"
        title="插入运算符 ${operator}"
      >${operator}</button>
    `).join('');

    const functionButtons = Object.values(this.#functionDefinitions).map((fn) => `
      <button
        type="button"
        class="builder-chip function-button"
        data-test="function-button"
        data-function="${fn.name}"
        data-arity="${fn.arity}"
        title="${fn.label}(${fn.arity} 参数)"
      >${fn.display}</button>
    `).join('');

    const numberPadDigits = this.#numberPadDigits.map((digit) => `
      <button
        type="button"
        class="number-pad-digit"
        data-test="number-pad-digit"
        data-digit="${digit}"
      >${digit}</button>
    `).join('');

    return `
      <div class="weighted-sort-editor">
        <div class="weighted-sort-header">
          <h4>加权排序配置</h4>
          <small>通过按钮组合字段、运算符、函数和数字来构建排序公式</small>
        </div>

        <div class="formula-preview" data-test="formula-preview">
          <code>尚未设置公式</code>
        </div>

        <div class="formula-token-list" data-test="formula-tokens"></div>
        <div data-role="pending-function"></div>

        <div class="formula-validation">
          <span class="validation-status" data-test="validation-status"></span>
        </div>

        <div class="builder-panels">
          <section class="builder-panel">
            <header>字段</header>
            <div class="panel-body">
              ${fieldButtons || '<div class="panel-placeholder">暂无可用字段</div>'}
            </div>
          </section>

          <section class="builder-panel">
            <header>运算符</header>
            <div class="panel-body">
              ${operatorButtons}
            </div>
          </section>

          <section class="builder-panel">
            <header>函数</header>
            <div class="panel-body">
              ${functionButtons}
            </div>
          </section>

          <section class="builder-panel number-panel">
            <header>数字面板</header>
            <div class="number-pad-display" data-test="number-pad-display">0</div>
            <div class="number-pad-grid">
              ${numberPadDigits}
            </div>
            <div class="number-pad-actions">
              <button type="button" class="number-pad-action" data-test="number-pad-action" data-action="backspace">⌫</button>
              <button type="button" class="number-pad-action" data-test="number-pad-action" data-action="clear">清空</button>
              <button type="button" class="number-pad-action primary" data-test="number-pad-action" data-action="commit">确定</button>
            </div>
          </section>
        </div>

        <div class="weighted-sort-actions">
          <button type="button" class="btn-test-formula" data-test="test-weighted-sort">🧪 测试公式</button>
          <button type="button" class="btn-apply-weighted" data-test="apply-weighted-sort">✅ 应用排序</button>
          <button type="button" class="btn-clear-weighted" data-test="clear-weighted-sort">🗑️ 清除排序</button>
        </div>
      </div>
    `;
  }

  #cacheElements() {
    this.#tokenListEl = this.#container.querySelector('[data-test="formula-tokens"]');
    this.#previewCodeEl = this.#container.querySelector('[data-test="formula-preview"] code');
    this.#pendingIndicatorHost = this.#container.querySelector('[data-role="pending-function"]');
    this.#numberDisplayEl = this.#container.querySelector('[data-test="number-pad-display"]');
    this.#validationStatusEl = this.#container.querySelector('[data-test="validation-status"]');
  }

  #bindEvents() {
    this.#containerClickHandler = (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      const fieldButton = target.closest('[data-test="field-button"]');
      if (fieldButton) {
        event.preventDefault();
        this.#handleFieldClick(fieldButton);
        return;
      }

      const operatorButton = target.closest('[data-test="operator-button"]');
      if (operatorButton) {
        event.preventDefault();
        this.#handleOperatorClick(operatorButton);
        return;
      }

      const functionButton = target.closest('[data-test="function-button"]');
      if (functionButton) {
        event.preventDefault();
        this.#handleFunctionClick(functionButton);
        return;
      }

      const numberDigit = target.closest('[data-test="number-pad-digit"]');
      if (numberDigit) {
        event.preventDefault();
        this.#handleNumberDigit(numberDigit);
        return;
      }

      const numberAction = target.closest('[data-test="number-pad-action"]');
      if (numberAction) {
        event.preventDefault();
        this.#handleNumberAction(numberAction);
        return;
      }

      const tokenDelete = target.closest('[data-test="token-delete"]');
      if (tokenDelete) {
        event.preventDefault();
        this.#handleTokenDelete(tokenDelete);
        return;
      }

      if (target.matches('[data-test="apply-weighted-sort"]')) {
        event.preventDefault();
        this.#handleApplyWeightedSort();
        return;
      }

      if (target.matches('[data-test="test-weighted-sort"]')) {
        event.preventDefault();
        this.#handleTestFormula();
        return;
      }

      if (target.matches('[data-test="clear-weighted-sort"]')) {
        event.preventDefault();
        this.#handleClearSort();
      }
    };

    this.#container.addEventListener('click', this.#containerClickHandler);
  }

  #syncView() {
    this.#renderTokens();
    this.#renderPendingIndicator();
    this.#updateNumberPadDisplay();
    this.#rebuildFormula();
    this.#updateFormulaPreview();
    this.#validateFormula();
  }

  #renderTokens() {
    if (!this.#tokenListEl) {
      return;
    }

    if (!this.#tokens.length) {
      this.#tokenListEl.innerHTML = '<div class="formula-token placeholder">点击上方按钮开始构建公式</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.#tokens.forEach((token, index) => {
      const tokenEl = document.createElement('div');
      tokenEl.className = `formula-token formula-token-${token.type}`;
      tokenEl.setAttribute('data-test', 'formula-token');
      tokenEl.setAttribute('data-index', String(index));
      tokenEl.textContent = token.value;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'token-delete';
      deleteBtn.setAttribute('data-test', 'token-delete');
      deleteBtn.textContent = '×';

      tokenEl.appendChild(deleteBtn);
      fragment.appendChild(tokenEl);
    });

    this.#tokenListEl.innerHTML = '';
    this.#tokenListEl.appendChild(fragment);
  }

  #renderPendingIndicator() {
    if (!this.#pendingIndicatorHost) {
      return;
    }

    if (!this.#pendingFunction) {
      this.#pendingIndicatorHost.innerHTML = '';
      return;
    }

    const remaining = this.#pendingFunction.arity - this.#pendingFunction.args.length;
    this.#pendingIndicatorHost.innerHTML = `
      <div class="function-pending" data-test="function-pending" data-function="${this.#pendingFunction.name}" data-remaining="${remaining}">
        <span>${this.#pendingFunction.label}</span>
        <span class="pending-remaining">还需 ${remaining} 个参数</span>
      </div>
    `;
  }

  #updateNumberPadDisplay() {
    if (this.#numberDisplayEl) {
      this.#numberDisplayEl.textContent = this.#numberBuffer || '0';
    }
  }

  #updateFormulaPreview() {
    if (this.#previewCodeEl) {
      this.#previewCodeEl.textContent = this.#currentFormula || '尚未设置公式';
    }
  }

  #validateFormula() {
    if (!this.#validationStatusEl) {
      return;
    }

    if (!this.#currentFormula) {
      this.#validationStatusEl.textContent = '';
      this.#validationStatusEl.className = 'validation-status';
      this.#validationResult = null;
      return;
    }

    const openBrackets = (this.#currentFormula.match(/\(/g) || []).length;
    const closeBrackets = (this.#currentFormula.match(/\)/g) || []).length;
    if (openBrackets !== closeBrackets) {
      this.#validationStatusEl.textContent = '❌ 括号不匹配';
      this.#validationStatusEl.className = 'validation-status invalid';
      this.#validationResult = { valid: false, error: '括号不匹配' };
      return;
    }

    if (!this.#hasSafeReference(this.#currentFormula)) {
      this.#validationStatusEl.textContent = '❌ 公式中缺少字段';
      this.#validationStatusEl.className = 'validation-status invalid';
      this.#validationResult = { valid: false, error: '公式缺少字段' };
      return;
    }

    this.#validationStatusEl.textContent = '✅ 公式格式正确';
    this.#validationStatusEl.className = 'validation-status valid';
    this.#validationResult = { valid: true };
  }

  #hasSafeReference(formula) {
    if (!formula) {
      return false;
    }
    const fieldNames = this.#availableFields.map((field) => field.field);
    const fnNames = Object.keys(this.#functionDefinitions);
    const hasField = fieldNames.some((name) => new RegExp(`\\b${this.#escapeRegExp(name)}\\b`, 'i').test(formula));
    const hasFunc = fnNames.some((name) => new RegExp(`\\b${this.#escapeRegExp(name)}\\s*\\(`, 'i').test(formula));
    return hasField || hasFunc;
  }

  /**
   * 转义正则特殊字符
   * @param {string} value
   * @returns {string}
   */
  #escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  #handleFieldClick(button) {
    const field = button.getAttribute('data-field');
    if (!field) {
      return;
    }
    this.#appendToken({ type: 'field', value: field });
  }

  #handleOperatorClick(button) {
    const operator = button.getAttribute('data-operator');
    if (!operator || this.#pendingFunction) {
      return;
    }
    this.#appendToken({ type: 'operator', value: operator });
  }

  #handleFunctionClick(button) {
    const functionName = button.getAttribute('data-function');
    if (!functionName || this.#pendingFunction) {
      return;
    }

    const definition = this.#functionDefinitions[functionName];
    if (!definition) {
      this.#logger.warn(`[WeightedSortEditor] 未知函数: ${functionName}`);
      return;
    }

    this.#pendingFunction = {
      name: definition.name,
      label: definition.display,
      arity: definition.arity,
      args: []
    };
    this.#renderPendingIndicator();
  }

  #handleNumberDigit(button) {
    const digit = button.getAttribute('data-digit');
    if (!digit) {
      return;
    }

    if (digit === '.' && this.#numberBuffer.includes('.')) {
      return;
    }

    this.#numberBuffer += digit;
    this.#updateNumberPadDisplay();
  }

  #handleNumberAction(button) {
    const action = button.getAttribute('data-action');
    if (!action) {
      return;
    }

    if (action === 'backspace') {
      this.#numberBuffer = this.#numberBuffer.slice(0, -1);
      this.#updateNumberPadDisplay();
      return;
    }

    if (action === 'clear') {
      this.#numberBuffer = '';
      this.#updateNumberPadDisplay();
      return;
    }

    if (action === 'commit') {
      this.#commitNumberBuffer();
    }
  }

  #commitNumberBuffer() {
    if (!this.#numberBuffer) {
      return;
    }

    const token = { type: 'number', value: this.#numberBuffer };
    this.#appendToken(token);
    this.#numberBuffer = '';
    this.#updateNumberPadDisplay();
  }

  #appendToken(token) {
    if (this.#pendingFunction) {
      this.#pendingFunction.args.push(token.value);
      if (this.#pendingFunction.args.length >= this.#pendingFunction.arity) {
        const expression = `${this.#pendingFunction.name}(${this.#pendingFunction.args.join(', ')})`;
        this.#tokens.push({ type: 'function', value: expression, name: this.#pendingFunction.name });
        this.#pendingFunction = null;
      }
      this.#syncView();
      return;
    }

    this.#tokens.push(token);
    this.#syncView();
  }

  #handleTokenDelete(button) {
    const tokenEl = button.closest('[data-test="formula-token"]');
    if (!tokenEl) {
      return;
    }

    const index = Number(tokenEl.getAttribute('data-index'));
    if (Number.isNaN(index)) {
      return;
    }

    this.#tokens.splice(index, 1);
    this.#syncView();
  }

  #rebuildFormula() {
    if (!this.#tokens.length) {
      this.#currentFormula = '';
      return;
    }

    let formula = this.#tokens.map((token) => token.value).join(' ');
    formula = formula.replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+,/g, ',')
      .replace(/,\s*/g, ', ')
      .replace(/\s+\*/g, ' *')
      .replace(/\s+\//g, ' /')
      .replace(/\s+\+/g, ' +')
      .replace(/\s+-/g, ' -');

    this.#currentFormula = formula.trim();
  }

  #loadFormula(formula) {
    this.#tokens = [];
    this.#numberBuffer = '';
    this.#pendingFunction = null;

    if (!formula) {
      this.#syncView();
      return;
    }

    const length = formula.length;
    let index = 0;

    while (index < length) {
      const char = formula[index];

      if (/\s/.test(char)) {
        index += 1;
        continue;
      }

      if (char === '*' && formula[index + 1] === '*') {
        this.#tokens.push({ type: 'operator', value: '**' });
        index += 2;
        continue;
      }

      if ('+-*/%()'.includes(char)) {
        this.#tokens.push({ type: 'operator', value: char });
        index += 1;
        continue;
      }

      if (/[0-9]/.test(char)) {
        let numberLiteral = char;
        index += 1;
        while (index < length && /[0-9.]/.test(formula[index])) {
          numberLiteral += formula[index];
          index += 1;
        }
        this.#tokens.push({ type: 'number', value: numberLiteral });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let identifier = char;
        index += 1;
        while (index < length && /[a-zA-Z0-9_]/.test(formula[index])) {
          identifier += formula[index];
          index += 1;
        }

        if (this.#functionDefinitions[identifier] && formula[index] === '(') {
          let depth = 0;
          let expression = identifier;
          while (index < length) {
            const currentChar = formula[index];
            expression += currentChar;
            if (currentChar === '(') {
              depth += 1;
            } else if (currentChar === ')') {
              depth -= 1;
              if (depth === 0) {
                index += 1;
                break;
              }
            }
            index += 1;
          }
          this.#tokens.push({ type: 'function', value: expression, name: identifier });
          continue;
        }

        const isField = this.#availableFields.some((field) => field.field === identifier);
        this.#tokens.push({ type: isField ? 'field' : 'identifier', value: identifier });
        continue;
      }

      if (char === ',') {
        this.#tokens.push({ type: 'operator', value: ',' });
        index += 1;
        continue;
      }

      this.#logger.warn(`[WeightedSortEditor] 无法识别的字符: ${char}`);
      index += 1;
    }

    this.#syncView();
  }

  #handleTestFormula() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn('[WeightedSortEditor] Cannot test invalid formula');
      alert('请先构建有效的公式再进行测试');
      return;
    }

    this.#logger.info('[WeightedSortEditor] Testing formula:', this.#currentFormula);
    this.#eventBus.emit('sorter:formula:tested', {
      formula: this.#currentFormula
    });

    alert(`公式测试请求已发送\n公式: ${this.#currentFormula}\n\n后端执行逻辑将在后续实现`);
  }

  #handleApplyWeightedSort() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn('[WeightedSortEditor] Cannot apply invalid formula');
      alert('请先构建有效的公式');
      return;
    }

    this.#logger.info('[WeightedSortEditor] Applying weighted sort:', this.#currentFormula);
    this.#eventBus.emit('sorter:sort:requested', {
      type: 'weighted',
      formula: this.#currentFormula
    });
  }

  #handleClearSort() {
    this.#tokens = [];
    this.#numberBuffer = '';
    this.#pendingFunction = null;
    this.#syncView();
    this.#logger.info('[WeightedSortEditor] Formula cleared');

    this.#eventBus.emit('sorter:sort:cleared', {});
  }

  getFormula() {
    return this.#currentFormula;
  }

  setFormula(formula) {
    this.#currentFormula = formula || '';
    this.#loadFormula(this.#currentFormula);
    this.#logger.info('[WeightedSortEditor] Formula set:', this.#currentFormula);
  }

  destroy() {
    if (this.#container && this.#containerClickHandler) {
      this.#container.removeEventListener('click', this.#containerClickHandler);
    }

    if (this.#container) {
      this.#container.innerHTML = '';
    }

    this.#container = null;
    this.#tokenListEl = null;
    this.#previewCodeEl = null;
    this.#pendingIndicatorHost = null;
    this.#numberDisplayEl = null;
    this.#validationStatusEl = null;
    this.#containerClickHandler = null;

    this.#logger.info('[WeightedSortEditor] Destroyed');
  }
}
