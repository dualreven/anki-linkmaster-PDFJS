function stringifyPythonValue(v) {
  if (typeof v === "number" || typeof v === "boolean") { return String(v); }
  return `"${String(v)}"`;
}

export function buildSortSummary(sortRules) {
  const arr = Array.isArray(sortRules) ? sortRules : [];
  if (arr.length === 0) { return "默认"; }
  return arr.map((r) => `${r.field || r.column || "?"} ${r.direction || ""}`.trim()).join(", ");
}

export function toPythonExpression(cfg) {
  if (!cfg || typeof cfg !== "object") { return "True"; }

  if (cfg.type === "composite") {
    const op = String(cfg.operator || "AND").toUpperCase();
    const xs = (cfg.conditions || []).map((c) => toPythonExpression(c)).filter(Boolean);
    if (op === "NOT") { return xs.length ? `not (${xs[0]})` : "True"; }
    if (op === "AND") { return xs.length === 1 ? xs[0] : `(${xs.join(" and ")})`; }
    if (op === "OR") { return xs.length === 1 ? xs[0] : `(${xs.join(" or ")})`; }
    return xs.join(" and ");
  }

  if (cfg.type === "field") {
    const field = String(cfg.field || "field");
    const operator = String(cfg.operator || "eq");
    const value = cfg.value;
    switch (operator) {
    case "contains": return `${stringifyPythonValue(value)} in ${field}`;
    case "not_contains": return `${stringifyPythonValue(value)} not in ${field}`;
    case "eq": return `${field} == ${stringifyPythonValue(value)}`;
    case "ne": return `${field} != ${stringifyPythonValue(value)}`;
    case "gt": return `${field} > ${value}`;
    case "lt": return `${field} < ${value}`;
    case "gte": return `${field} >= ${value}`;
    case "lte": return `${field} <= ${value}`;
    case "starts_with": return `${field}.startswith(${stringifyPythonValue(value)})`;
    case "ends_with": return `${field}.endswith(${stringifyPythonValue(value)})`;
    case "in_range": {
      const parts = String(value || "").split(",");
      const min = parts[0] ?? "";
      const max = parts[1] ?? "";
      return `${min} <= ${field} <= ${max}`;
    }
    default: return `${field} ${operator} ${stringifyPythonValue(value)}`;
    }
  }

  if (cfg.type === "fuzzy") {
    const keywords = Array.isArray(cfg.keywords) ? cfg.keywords : [];
    const fields = Array.isArray(cfg.searchFields) && cfg.searchFields.length
      ? cfg.searchFields
      : ["filename", "tags", "notes"];
    if (keywords.length === 0) { return "True"; }
    const perKw = (kw) => `(${fields.map((f) => `"${kw}" in ${f}`).join(" or ")})`;
    const exprs = keywords.map(perKw);
    const mode = String(cfg.matchMode || "any").toLowerCase();
    return mode === "all" ? `(${exprs.join(" and ")})` : `(${exprs.join(" or ")})`;
  }

  return "True";
}

