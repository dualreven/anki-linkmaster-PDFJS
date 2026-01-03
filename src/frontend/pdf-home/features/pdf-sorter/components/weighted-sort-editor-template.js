function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`[WeightedSortEditor] ${label} must be an array`);
  }
}

export function buildWeightedSortEditorTemplate({ availableFields, operators, numberPadDigits, functionDefinitions }) {
  assertArray(availableFields, "availableFields");
  assertArray(operators, "operators");
  assertArray(numberPadDigits, "numberPadDigits");
  if (!functionDefinitions || typeof functionDefinitions !== "object") {
    throw new Error("[WeightedSortEditor] functionDefinitions must be an object");
  }

  const fieldButtons = availableFields
    .map((field) =>
      `<button type="button" class="builder-chip field-button" data-test="field-button" data-field="${field.field}" title="插入字段 ${field.label}">` +
      `<span>${field.label}</span><code>${field.field}</code></button>`
    )
    .join("");

  const operatorButtons = operators
    .map((operator) =>
      `<button type="button" class="builder-chip operator-button" data-test="operator-button" data-operator="${operator}" title="插入运算符 ${operator}">${operator}</button>`
    )
    .join("");

  const functionButtons = Object.values(functionDefinitions)
    .map((fn) =>
      `<button type="button" class="builder-chip function-button" data-test="function-button" data-function="${fn.name}" data-arity="${fn.arity}" title="${fn.label}(${fn.arity} 参数)">` +
      `${fn.display}</button>`
    )
    .join("");

  const digitButtons = numberPadDigits
    .map((digit) =>
      `<button type="button" class="number-pad-digit" data-test="number-pad-digit" data-digit="${digit}">${digit}</button>`
    )
    .join("");

  return [
    "<div class=\"weighted-sort-editor\">",
    "<div class=\"weighted-sort-header\"><h4>加权排序配置</h4><small>通过按钮组合字段、运算符、函数和数字来构建排序公式</small></div>",
    "<div class=\"formula-preview\" data-test=\"formula-preview\"><code>尚未设置公式</code></div>",
    "<div class=\"formula-token-list\" data-test=\"formula-tokens\"></div>",
    "<div data-role=\"pending-function\"></div>",
    "<div class=\"formula-validation\"><span class=\"validation-status\" data-test=\"validation-status\"></span></div>",
    "<div class=\"builder-panels\">",
    "<section class=\"builder-panel\"><header>字段</header><div class=\"panel-body\">" +
      (fieldButtons || "<div class=\"panel-placeholder\">暂无可用字段</div>") +
      "</div></section>",
    "<section class=\"builder-panel\"><header>运算符</header><div class=\"panel-body\">" + operatorButtons + "</div></section>",
    "<section class=\"builder-panel\"><header>函数</header><div class=\"panel-body\">" + functionButtons + "</div></section>",
    "<section class=\"builder-panel number-panel\"><header>数字面板</header>" +
      "<div class=\"number-pad-display\" data-test=\"number-pad-display\">0</div>" +
      "<div class=\"number-pad-grid\">" + digitButtons + "</div>" +
      "<div class=\"number-pad-actions\">" +
        "<button type=\"button\" class=\"number-pad-action\" data-test=\"number-pad-action\" data-action=\"backspace\">⌫</button>" +
        "<button type=\"button\" class=\"number-pad-action\" data-test=\"number-pad-action\" data-action=\"clear\">清空</button>" +
        "<button type=\"button\" class=\"number-pad-action primary\" data-test=\"number-pad-action\" data-action=\"commit\">确定</button>" +
      "</div></section>",
    "</div>",
    "<div class=\"weighted-sort-actions\">" +
      "<button type=\"button\" class=\"btn-test-formula\" data-test=\"test-weighted-sort\">🧪 测试公式</button>" +
      "<button type=\"button\" class=\"btn-apply-weighted\" data-test=\"apply-weighted-sort\">✅ 应用排序</button>" +
      "<button type=\"button\" class=\"btn-clear-weighted\" data-test=\"clear-weighted-sort\">🗑️ 清除排序</button>" +
    "</div>",
    "</div>"
  ].join("");
}

