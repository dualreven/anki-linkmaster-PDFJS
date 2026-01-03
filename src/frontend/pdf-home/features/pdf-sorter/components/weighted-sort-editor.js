import { showError, showInfo } from "../../../../common/utils/notification.js";
import { SORTER_EVENTS } from "../../../../common/event/event-constants.js";
import {
  WEIGHTED_SORT_FUNCTION_DEFINITIONS,
  WEIGHTED_SORT_NUMBER_PAD_DIGITS,
  WEIGHTED_SORT_OPERATORS
} from "./weighted-sort-editor-constants.js";
import { buildWeightedSortEditorTemplate } from "./weighted-sort-editor-template.js";
import { formatFormulaFromTokens, parseFormulaToTokens } from "./weighted-sort-editor-formula.js";
import {
  renderPendingIndicator,
  renderTokens,
  updateFormulaPreview,
  updateNumberPadDisplay,
  validateFormulaView
} from "./weighted-sort-editor-view.js";
/**
 * @file 加权排序编辑器组件
 * @module features/pdf-sorter/components/weighted-sort-editor
 * @description
 * 提供纯鼠标交互的加权排序公式构建器，支持字段、运算符、函数与数字面板
 * 详细说明：`docs/standards/pdf-sorter-weighted-sort-editor.md`
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
  #currentFormula = "";

  /** @type {string} */
  #numberBuffer = "";

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
  #operators = WEIGHTED_SORT_OPERATORS;

  /** @type {ReadonlyArray<string>} */
  #numberPadDigits = WEIGHTED_SORT_NUMBER_PAD_DIGITS;

  /** @type {Readonly<Record<string, { name: string, label: string, display: string, arity: number }>>} */
  #functionDefinitions = WEIGHTED_SORT_FUNCTION_DEFINITIONS;

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
    this.#currentFormula = "";
  }

  /**
   * 渲染组件
   * @param {HTMLElement} container
   */
  render(container) {
    if (!container) {
      throw new Error("WeightedSortEditor: container is required");
    }

    this.#container = container;
    this.#container.innerHTML = buildWeightedSortEditorTemplate({
      availableFields: this.#availableFields,
      operators: this.#operators,
      numberPadDigits: this.#numberPadDigits,
      functionDefinitions: this.#functionDefinitions
    });

    this.#cacheElements();
    this.#bindEvents();
    this.#syncView();

    this.#logger.info("[WeightedSortEditor] Rendered");
  }

  #cacheElements() {
    this.#tokenListEl = this.#container.querySelector("[data-test=\"formula-tokens\"]");
    this.#previewCodeEl = this.#container.querySelector("[data-test=\"formula-preview\"] code");
    this.#pendingIndicatorHost = this.#container.querySelector("[data-role=\"pending-function\"]");
    this.#numberDisplayEl = this.#container.querySelector("[data-test=\"number-pad-display\"]");
    this.#validationStatusEl = this.#container.querySelector("[data-test=\"validation-status\"]");
  }

  #bindEvents() {
    this.#containerClickHandler = (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      const fieldButton = target.closest("[data-test=\"field-button\"]");
      if (fieldButton) {
        event.preventDefault();
        this.#handleFieldClick(fieldButton);
        return;
      }

      const operatorButton = target.closest("[data-test=\"operator-button\"]");
      if (operatorButton) {
        event.preventDefault();
        this.#handleOperatorClick(operatorButton);
        return;
      }

      const functionButton = target.closest("[data-test=\"function-button\"]");
      if (functionButton) {
        event.preventDefault();
        this.#handleFunctionClick(functionButton);
        return;
      }

      const numberDigit = target.closest("[data-test=\"number-pad-digit\"]");
      if (numberDigit) {
        event.preventDefault();
        this.#handleNumberDigit(numberDigit);
        return;
      }

      const numberAction = target.closest("[data-test=\"number-pad-action\"]");
      if (numberAction) {
        event.preventDefault();
        this.#handleNumberAction(numberAction);
        return;
      }

      const tokenDelete = target.closest("[data-test=\"token-delete\"]");
      if (tokenDelete) {
        event.preventDefault();
        this.#handleTokenDelete(tokenDelete);
        return;
      }

      if (target.matches("[data-test=\"apply-weighted-sort\"]")) {
        event.preventDefault();
        this.#handleApplyWeightedSort();
        return;
      }

      if (target.matches("[data-test=\"test-weighted-sort\"]")) {
        event.preventDefault();
        this.#handleTestFormula();
        return;
      }

      if (target.matches("[data-test=\"clear-weighted-sort\"]")) {
        event.preventDefault();
        this.#handleClearSort();
      }
    };

    this.#container.addEventListener("click", this.#containerClickHandler);
  }

  #syncView() {
    renderTokens(this.#tokenListEl, this.#tokens);
    renderPendingIndicator(this.#pendingIndicatorHost, this.#pendingFunction);
    updateNumberPadDisplay(this.#numberDisplayEl, this.#numberBuffer);
    this.#currentFormula = formatFormulaFromTokens(this.#tokens);
    updateFormulaPreview(this.#previewCodeEl, this.#currentFormula);
    this.#validationResult = validateFormulaView({
      validationStatusEl: this.#validationStatusEl,
      formula: this.#currentFormula,
      availableFields: this.#availableFields,
      functionDefinitions: this.#functionDefinitions
    });
  }

  #handleFieldClick(button) {
    const field = button.getAttribute("data-field");
    if (!field) {
      return;
    }
    this.#appendToken({ type: "field", value: field });
  }

  #handleOperatorClick(button) {
    const operator = button.getAttribute("data-operator");
    if (!operator || this.#pendingFunction) {
      return;
    }
    this.#appendToken({ type: "operator", value: operator });
  }

  #handleFunctionClick(button) {
    const functionName = button.getAttribute("data-function");
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
    renderPendingIndicator(this.#pendingIndicatorHost, this.#pendingFunction);
  }

  #handleNumberDigit(button) {
    const digit = button.getAttribute("data-digit");
    if (!digit) {
      return;
    }

    if (digit === "." && this.#numberBuffer.includes(".")) {
      return;
    }

    this.#numberBuffer += digit;
    updateNumberPadDisplay(this.#numberDisplayEl, this.#numberBuffer);
  }

  #handleNumberAction(button) {
    const action = button.getAttribute("data-action");
    if (!action) {
      return;
    }

    if (action === "backspace") {
      this.#numberBuffer = this.#numberBuffer.slice(0, -1);
      updateNumberPadDisplay(this.#numberDisplayEl, this.#numberBuffer);
      return;
    }

    if (action === "clear") {
      this.#numberBuffer = "";
      updateNumberPadDisplay(this.#numberDisplayEl, this.#numberBuffer);
      return;
    }

    if (action === "commit") {
      this.#commitNumberBuffer();
    }
  }

  #commitNumberBuffer() {
    if (!this.#numberBuffer) {
      return;
    }

    const token = { type: "number", value: this.#numberBuffer };
    this.#appendToken(token);
    this.#numberBuffer = "";
    updateNumberPadDisplay(this.#numberDisplayEl, this.#numberBuffer);
  }

  #appendToken(token) {
    if (this.#pendingFunction) {
      this.#pendingFunction.args.push(token.value);
      if (this.#pendingFunction.args.length >= this.#pendingFunction.arity) {
        const expression = `${this.#pendingFunction.name}(${this.#pendingFunction.args.join(", ")})`;
        this.#tokens.push({ type: "function", value: expression, name: this.#pendingFunction.name });
        this.#pendingFunction = null;
      }
      this.#syncView();
      return;
    }

    this.#tokens.push(token);
    this.#syncView();
  }

  #handleTokenDelete(button) {
    const tokenEl = button.closest("[data-test=\"formula-token\"]");
    if (!tokenEl) {
      return;
    }

    const index = Number(tokenEl.getAttribute("data-index"));
    if (Number.isNaN(index)) {
      return;
    }

    this.#tokens.splice(index, 1);
    this.#syncView();
  }

  #loadFormula(formula) {
    this.#numberBuffer = "";
    this.#pendingFunction = null;

    this.#tokens = parseFormulaToTokens(formula, {
      availableFields: this.#availableFields,
      functionDefinitions: this.#functionDefinitions,
      logger: this.#logger
    });
    this.#syncView();
  }

  async #handleTestFormula() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn("[WeightedSortEditor] Cannot test invalid formula");
      try { showError("请先构建有效的公式再进行测试", 3500); } catch (e) { void e; }
      return;
    }

    this.#logger.info("[WeightedSortEditor] Testing formula:", this.#currentFormula);
    this.#eventBus.emit(SORTER_EVENTS.SORT.APPLIED, { formula: this.#currentFormula });

    try { showInfo(`公式测试请求已发送\n公式: ${this.#currentFormula}`, 3000); } catch (e) { void e; }
  }

  async #handleApplyWeightedSort() {
    if (!this.#validationResult || !this.#validationResult.valid) {
      this.#logger.warn("[WeightedSortEditor] Cannot apply invalid formula");
      try { showError("请先构建有效的公式", 3500); } catch (e) { void e; }
      return;
    }

    this.#logger.info("[WeightedSortEditor] Applying weighted sort:", this.#currentFormula);
    this.#eventBus.emit(SORTER_EVENTS.SORT.REQUESTED, { type: "weighted", formula: this.#currentFormula });
  }

  async #handleClearSort() {
    this.#tokens = [];
    this.#numberBuffer = "";
    this.#pendingFunction = null;
    this.#syncView();
    this.#logger.info("[WeightedSortEditor] Formula cleared");
    this.#eventBus.emit(SORTER_EVENTS.SORT.CLEARED, {});
  }

  getFormula() {
    return this.#currentFormula;
  }

  setFormula(formula) {
    this.#currentFormula = formula || "";
    this.#loadFormula(this.#currentFormula);
    this.#logger.info("[WeightedSortEditor] Formula set:", this.#currentFormula);
  }

  destroy() {
    if (this.#container && this.#containerClickHandler) {
      this.#container.removeEventListener("click", this.#containerClickHandler);
    }

    if (this.#container) {
      this.#container.innerHTML = "";
    }

    this.#container = null;
    this.#tokenListEl = null;
    this.#previewCodeEl = null;
    this.#pendingIndicatorHost = null;
    this.#numberDisplayEl = null;
    this.#validationStatusEl = null;
    this.#containerClickHandler = null;

    this.#logger.info("[WeightedSortEditor] Destroyed");
  }
}

