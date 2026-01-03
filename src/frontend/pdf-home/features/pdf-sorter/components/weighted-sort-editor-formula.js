function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`[WeightedSortEditor] ${label} must be an array`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasSafeReference(formula, { availableFields, functionDefinitions }) {
  if (!formula) {return false;}
  assertArray(availableFields, "availableFields");
  if (!functionDefinitions || typeof functionDefinitions !== "object") {
    throw new Error("[WeightedSortEditor] functionDefinitions must be an object");
  }

  const fieldNames = availableFields.map((field) => field.field);
  const fnNames = Object.keys(functionDefinitions);
  const hasField = fieldNames.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(formula));
  const hasFunc = fnNames.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, "i").test(formula));
  return hasField || hasFunc;
}

export function formatFormulaFromTokens(tokens) {
  assertArray(tokens, "tokens");
  if (!tokens.length) {return "";}

  let formula = tokens.map((token) => token.value).join(" ");
  formula = formula
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+\*/g, " *")
    .replace(/\s+\//g, " /")
    .replace(/\s+\+/g, " +")
    .replace(/\s+-/g, " -");

  return formula.trim();
}

export function parseFormulaToTokens(formula, { availableFields, functionDefinitions, logger }) {
  assertArray(availableFields, "availableFields");
  if (!functionDefinitions || typeof functionDefinitions !== "object") {
    throw new Error("[WeightedSortEditor] functionDefinitions must be an object");
  }

  const tokens = [];
  if (!formula) {return tokens;}

  const length = formula.length;
  let index = 0;

  while (index < length) {
    const char = formula[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "*" && formula[index + 1] === "*") {
      tokens.push({ type: "operator", value: "**" });
      index += 2;
      continue;
    }

    if ("+-*/%()".includes(char)) {
      tokens.push({ type: "operator", value: char });
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
      tokens.push({ type: "number", value: numberLiteral });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let identifier = char;
      index += 1;
      while (index < length && /[a-zA-Z0-9_]/.test(formula[index])) {
        identifier += formula[index];
        index += 1;
      }

      if (functionDefinitions[identifier] && formula[index] === "(") {
        let depth = 0;
        let expression = identifier;
        while (index < length) {
          const currentChar = formula[index];
          expression += currentChar;
          if (currentChar === "(") {
            depth += 1;
          } else if (currentChar === ")") {
            depth -= 1;
            if (depth === 0) {
              index += 1;
              break;
            }
          }
          index += 1;
        }
        tokens.push({ type: "function", value: expression, name: identifier });
        continue;
      }

      const isField = availableFields.some((field) => field.field === identifier);
      tokens.push({ type: isField ? "field" : "identifier", value: identifier });
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "operator", value: "," });
      index += 1;
      continue;
    }

    try { logger?.warn?.(`[WeightedSortEditor] 无法识别的字符: ${char}`); } catch (err) { /* logger-guard */ void err; }
    index += 1;
  }

  return tokens;
}
