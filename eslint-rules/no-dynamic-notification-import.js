/**
 * 禁止对 notification.js 或 thirdparty-toast.js 使用动态 import()
 * 目的：统一打包路径与加载时机，避免运行时拆分导致的首屏延迟或异常
 */

const BLOCKED_PATTERNS = [
  /common\/utils\/notification\.js$/,
  /common\/utils\/thirdparty-toast\.js$/,
];

function isBlocked(source) {
  if (typeof source !== "string") { return false; }
  return BLOCKED_PATTERNS.some((re) => re.test(source));
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "禁止动态 import notification/thirdparty-toast",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      noDynamic: "禁止对 {{module}} 使用动态 import()，请改为静态导入或使用 logger + { toast }。",
    },
  },
  create(context) {
    return {
      ImportExpression(node) {
        try {
          const arg = node.source;
          if (arg && arg.type === "Literal" && typeof arg.value === "string" && isBlocked(arg.value)) {
            context.report({
              node: arg,
              messageId: "noDynamic",
              data: { module: arg.value },
            });
          }
        } catch (_) { /* noop */ }
      },
    };
  },
};

export default rule;
