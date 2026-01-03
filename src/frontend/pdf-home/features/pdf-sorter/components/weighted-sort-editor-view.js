import { hasSafeReference } from "./weighted-sort-editor-formula.js";

export function renderTokens(tokenListEl, tokens) {
  if (!tokenListEl) {return;}
  if (!tokens.length) {
    tokenListEl.innerHTML = "<div class=\"formula-token placeholder\">点击上方按钮开始构建公式</div>";
    return;
  }

  const fragment = document.createDocumentFragment();
  tokens.forEach((token, index) => {
    const tokenEl = document.createElement("div");
    tokenEl.className = `formula-token formula-token-${token.type}`;
    tokenEl.setAttribute("data-test", "formula-token");
    tokenEl.setAttribute("data-index", String(index));
    tokenEl.textContent = token.value;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "token-delete";
    deleteBtn.setAttribute("data-test", "token-delete");
    deleteBtn.textContent = "×";

    tokenEl.appendChild(deleteBtn);
    fragment.appendChild(tokenEl);
  });

  tokenListEl.innerHTML = "";
  tokenListEl.appendChild(fragment);
}

export function renderPendingIndicator(hostEl, pendingFunction) {
  if (!hostEl) {return;}
  if (!pendingFunction) {
    hostEl.innerHTML = "";
    return;
  }

  const remaining = pendingFunction.arity - pendingFunction.args.length;
  hostEl.innerHTML =
    "<div class=\"function-pending\" data-test=\"function-pending\" data-function=\"" +
    pendingFunction.name +
    "\" data-remaining=\"" +
    remaining +
    "\">" +
    "<span>" +
    pendingFunction.label +
    "</span>" +
    "<span class=\"pending-remaining\">还需 " +
    remaining +
    " 个参数</span>" +
    "</div>";
}

export function updateNumberPadDisplay(displayEl, numberBuffer) {
  if (!displayEl) {return;}
  displayEl.textContent = numberBuffer || "0";
}

export function updateFormulaPreview(previewEl, formula) {
  if (!previewEl) {return;}
  previewEl.textContent = formula || "尚未设置公式";
}

export function validateFormulaView({
  validationStatusEl,
  formula,
  availableFields,
  functionDefinitions
}) {
  if (!validationStatusEl) {return null;}

  if (!formula) {
    validationStatusEl.textContent = "";
    validationStatusEl.className = "validation-status";
    return null;
  }

  const openBrackets = (formula.match(/\(/g) || []).length;
  const closeBrackets = (formula.match(/\)/g) || []).length;
  if (openBrackets !== closeBrackets) {
    validationStatusEl.textContent = "❌ 括号不匹配";
    validationStatusEl.className = "validation-status invalid";
    return { valid: false, error: "括号不匹配" };
  }

  if (!hasSafeReference(formula, { availableFields, functionDefinitions })) {
    validationStatusEl.textContent = "❌ 公式中缺少字段";
    validationStatusEl.className = "validation-status invalid";
    return { valid: false, error: "公式缺少字段" };
  }

  validationStatusEl.textContent = "✅ 公式格式正确";
  validationStatusEl.className = "validation-status valid";
  return { valid: true };
}
