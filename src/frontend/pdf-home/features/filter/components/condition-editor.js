/**
 * 条件编辑器对话框
 */
import { showError } from "../../../../common/utils/notification.js";

// 统一 toast 提示入口（使用公共通知API，符合 notification-allowed-apis 规则）
export class ConditionEditor {
  #logger = null;
  #container = null;
  #callback = null;
  #availableTags = [];
  #escHandler = null;

  // 字段定义
  #fields = {
    "filename": { label: "文件名", type: "string" },
    "tags": { label: "标签", type: "tags" },
    "rating": { label: "评分", type: "number" },
    "review_count": { label: "复习次数", type: "number" },
    "file_size": { label: "文件大小", type: "number" },
    "created_at": { label: "创建时间", type: "date" },
    "last_accessed_at": { label: "访问时间", type: "date" }
  };

  // 操作符定义
  #operators = {
    "string": [
      { value: "contains", label: "包含" },
      { value: "not_contains", label: "不包含" },
      { value: "eq", label: "= (等于)" },
      { value: "starts_with", label: "开头是" },
      { value: "ends_with", label: "结尾是" }
    ],
    "number": [
      { value: "eq", label: "= (等于)" },
      { value: "ne", label: "≠ (不等于)" },
      { value: "gt", label: "> (大于)" },
      { value: "lt", label: "< (小于)" },
      { value: "gte", label: "≥ (大于等于)" },
      { value: "lte", label: "≤ (小于等于)" }
    ],
    "date": [
      { value: "eq", label: "= (等于)" },
      { value: "gt", label: "> (之后)" },
      { value: "lt", label: "< (之前)" },
      { value: "in_range", label: "范围内" }
    ],
    "tags": [
      { value: "contains", label: "包含任意" },
      { value: "not_contains", label: "不包含任意" },
      { value: "has_all", label: "包含全部" },
      { value: "eq", label: "= (集合相等)" }
    ]
  };

  constructor(logger, availableTags = []) {
    this.#logger = logger;
    this.#availableTags = availableTags;
  }

  /**
   * 显示编辑器
   */
  show(callback) {
    this.#callback = callback;
    this.#createDialog();
    this.#logger.info("[ConditionEditor] Shown");
  }

  /**
   * 创建对话框
   */
  #createDialog() {
    const html = `
      <div class="condition-editor-dialog">
        <div class="condition-editor-overlay"></div>
        <div class="condition-editor-content">
          <div class="condition-editor-header">
            <h3>📝 编辑条件</h3>
            <button class="condition-editor-close">&times;</button>
          </div>

          <div class="condition-editor-body">
            <!-- 字段选择 -->
            <div class="form-group">
              <label>字段:</label>
              <select id="condition-field" class="form-control">
                ${Object.entries(this.#fields).map(([key, field]) =>
    `<option value="${key}">${field.label}</option>`
  ).join("")}
              </select>
            </div>

            <!-- 操作符选择 -->
            <div class="form-group">
              <label>操作符:</label>
              <select id="condition-operator" class="form-control">
                <!-- 动态填充 -->
              </select>
            </div>

            <!-- 值输入 -->
            <div class="form-group">
              <label>值:</label>
              <div id="condition-value-container">
                <!-- 动态填充 -->
              </div>
            </div>
          </div>

          <div class="condition-editor-footer">
            <button class="condition-editor-cancel">取消</button>
            <button class="condition-editor-save">保存</button>
          </div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html.trim();
    this.#container = tempDiv.firstChild;
    document.body.appendChild(this.#container);

    this.#setupEventListeners();
    this.#updateOperators(); // 初始化操作符
    this.#updateValueInput(); // 初始化值输入
  }

  /**
   * 设置事件监听
   */
  #setupEventListeners() {
    // 关闭按钮
    const closeBtn = this.#container.querySelector(".condition-editor-close");
    closeBtn.addEventListener("click", () => this.#close());

    // 遮罩层点击
    const overlay = this.#container.querySelector(".condition-editor-overlay");
    overlay.addEventListener("click", () => this.#close());

    // 取消按钮
    const cancelBtn = this.#container.querySelector(".condition-editor-cancel");
    cancelBtn.addEventListener("click", () => this.#close());

    // 保存按钮
    const saveBtn = this.#container.querySelector(".condition-editor-save");
    saveBtn.addEventListener("click", () => this.#save());

    // 字段变化
    const fieldSelect = this.#container.querySelector("#condition-field");
    fieldSelect.addEventListener("change", () => {
      this.#updateOperators();
      this.#updateValueInput();
    });

    // ESC键关闭
    this.#escHandler = (e) => {
      if (e.key === "Escape") {
        this.#close();
      }
    };
    document.addEventListener("keydown", this.#escHandler);
  }

  /**
   * 更新操作符选项
   */
  #updateOperators() {
    const fieldSelect = this.#container.querySelector("#condition-field");
    const operatorSelect = this.#container.querySelector("#condition-operator");

    const fieldKey = fieldSelect.value;
    const fieldType = this.#fields[fieldKey].type;
    const operators = this.#operators[fieldType] || this.#operators["string"];

    operatorSelect.innerHTML = operators.map(op =>
      `<option value="${op.value}">${op.label}</option>`
    ).join("");
  }

  /**
   * 更新值输入框
   */
  #updateValueInput() {
    const fieldSelect = this.#container.querySelector("#condition-field");
    const valueContainer = this.#container.querySelector("#condition-value-container");

    const fieldKey = fieldSelect.value;
    const fieldType = this.#fields[fieldKey].type;

    let inputHTML = "";

    switch (fieldType) {
    case "string":
      inputHTML = `
          <input type="text" id="condition-value" class="form-control"
                 placeholder="请输入文本..." />
        `;
      break;

    case "number":
      inputHTML = `
          <input type="number" id="condition-value" class="form-control"
                 placeholder="请输入数值..." />
        `;
      break;

    case "date":
      inputHTML = `
          <input type="date" id="condition-value" class="form-control" />
        `;
      break;

    case "tags":
      if (this.#availableTags.length > 0) {
        inputHTML = `
            <select id="condition-value" class="form-control">
              <option value="">请选择标签...</option>
              ${this.#availableTags.map(tag =>
    `<option value="${tag}">${tag}</option>`
  ).join("")}
            </select>
            <small class="form-hint">或输入自定义标签:</small>
            <input type="text" id="condition-value-custom" class="form-control"
                   placeholder="输入自定义标签..." style="margin-top: 8px;" />
          `;
      } else {
        inputHTML = `
            <input type="text" id="condition-value" class="form-control"
                   placeholder="请输入标签..." />
          `;
      }
      break;
    }

    valueContainer.innerHTML = inputHTML;
  }

  /**
   * 保存条件
   */
  #save() {
    const fieldSelect = this.#container.querySelector("#condition-field");
    const operatorSelect = this.#container.querySelector("#condition-operator");

    const field = fieldSelect.value;
    const operator = operatorSelect.value;

    let value = "";
    const fieldType = this.#fields[field].type;

    if (fieldType === "tags") {
      const selectValue = this.#container.querySelector("#condition-value")?.value;
      const customValue = this.#container.querySelector("#condition-value-custom")?.value;
      value = customValue || selectValue;
    } else {
      const valueInput = this.#container.querySelector("#condition-value");
      value = valueInput?.value || "";
    }

    if (!value) {
      try { showError("请输入值", 3000); } catch(_) {}
      return;
    }

    const conditionData = { field, operator, value };

    this.#logger.info("[ConditionEditor] Condition saved", conditionData);

    if (this.#callback) {
      this.#callback(conditionData);
    }

    this.#close();
  }

  /**
   * 关闭对话框
   */
  #close() {
    if (this.#container) {
      this.#container.remove();
      this.#container = null;
    }

    if (this.#escHandler) {
      document.removeEventListener("keydown", this.#escHandler);
      this.#escHandler = null;
    }

    this.#logger.info("[ConditionEditor] Closed");
  }

  /**
   * 设置可用标签列表
   */
  setAvailableTags(tags) {
    this.#availableTags = tags;
  }
}
