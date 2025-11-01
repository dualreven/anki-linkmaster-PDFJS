/**
 * 约束 logger.*(..., { toast }) 的形状
 * 允许：
 *  - { toast: true }
 *  - { toast: { type?: 'error'|'warn'|'info'|'success'|'debug', ms?: number } }
 */

const ALLOWED_TYPES = new Set(["error", "warn", "info", "success", "debug"]);

function getProperty(node, name) {
  if (!node || node.type !== "ObjectExpression") { return null; }
  return node.properties.find(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === name) ||
        (p.key.type === "Literal" && p.key.value === name))
  );
}

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "校验 logger.*(..., { toast }) 参数结构",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
    messages: {
      toastNotObject:
        "logger.* 的最后一个参数包含 toast，但必须是 true 或对象（{ type?, ms? }）。",
      typeInvalid:
        "toast.type 仅允许 'error'|'warn'|'info'|'success'|'debug'。",
      msInvalid: "toast.ms 必须是数字字面量（毫秒）。",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        try {
          // 仅检查形如 obj.error/info/warn/debug(...)
          const callee = node.callee;
          if (
            !callee ||
            callee.type !== "MemberExpression" ||
            callee.property.type !== "Identifier"
          ) {
            return;
          }
          const method = callee.property.name;
          if (!["error", "warn", "info", "debug", "log"].includes(method)) {
            return;
          }
          // 无参数，或最后一个不是对象，跳过
          const args = node.arguments || [];
          if (args.length === 0) { return; }
          const last = args[args.length - 1];
          if (last.type !== "ObjectExpression") { return; }

          const toastProp = getProperty(last, "toast");
          if (!toastProp) { return; }

          const value = toastProp.value;
          if (value.type === "Literal") {
            if (value.value !== true) {
              context.report({ node: value, messageId: "toastNotObject" });
            }
            return;
          }
          if (value.type !== "ObjectExpression") {
            context.report({ node: value, messageId: "toastNotObject" });
            return;
          }
          // 校验 type
          const typeProp = getProperty(value, "type");
          if (typeProp && typeProp.value) {
            const tv = typeProp.value;
            if (tv.type !== "Literal" || !ALLOWED_TYPES.has(String(tv.value))) {
              context.report({ node: tv, messageId: "typeInvalid" });
            }
          }
          // 校验 ms
          const msProp = getProperty(value, "ms");
          if (msProp && msProp.value) {
            const mv = msProp.value;
            if (mv.type !== "Literal" || typeof mv.value !== "number") {
              context.report({ node: mv, messageId: "msInvalid" });
            }
          }
        } catch (e) { void e; }
      },
    };
  },
};

export default rule;
