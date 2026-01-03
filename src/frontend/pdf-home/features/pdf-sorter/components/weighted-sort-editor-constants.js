export const WEIGHTED_SORT_OPERATORS = ["+", "-", "*", "/", "(", ")"];

export const WEIGHTED_SORT_NUMBER_PAD_DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "."];

export const WEIGHTED_SORT_FUNCTION_DEFINITIONS = {
  abs: { name: "abs", label: "绝对值", display: "abs(x)", arity: 1 },
  round: { name: "round", label: "四舍五入", display: "round(x)", arity: 1 },
  max: { name: "max", label: "最大值", display: "max(a, b)", arity: 2 },
  min: { name: "min", label: "最小值", display: "min(a, b)", arity: 2 },
  length: { name: "length", label: "长度(字符数)", display: "length(x)", arity: 1 },
  clamp: { name: "clamp", label: "范围限制", display: "clamp(x, min, max)", arity: 3 },
  normalize: { name: "normalize", label: "归一化", display: "normalize(x, min, max)", arity: 3 },
  desc: { name: "desc", label: "降序", display: "desc(x)", arity: 1 },
  tags_length: { name: "tags_length", label: "标签数量", display: "tags_length()", arity: 0 },
  tags_has: { name: "tags_has", label: "包含标签", display: "tags_has('tag')", arity: 1 },
  tags_has_any: { name: "tags_has_any", label: "包含任一标签", display: "tags_has_any('t1','t2')", arity: 2 },
  tags_has_all: { name: "tags_has_all", label: "包含全部标签", display: "tags_has_all('t1','t2')", arity: 2 }
};

