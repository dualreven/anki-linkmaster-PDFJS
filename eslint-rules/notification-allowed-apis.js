/**
 * 限制从 common/utils/notification.js 导入的标识符
 * 目的：
 *  - 只允许使用项目约定的 API：showInfo/showSuccess/showError/showInfoWithId/dismissById/hideAll
 *  - 禁止 default import 与别名
 */

const ALLOWED = new Set([
  "showInfo",
  "showSuccess",
  "showError",
  "showInfoWithId",
  "dismissById",
  "hideAll",
]);

function isNotificationModule(source) {
  if (typeof source !== "string") { return false; }
  return /common\/utils\/notification\.js$/.test(source);
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "限制从 notification.js 导入的 API 名称与用法",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      onlyAllowed: "从 notification.js 仅允许导入：{{names}}；请改为使用允许的 API。",
      noDefault: "禁止从 notification.js 使用默认导入，请使用具名导入（如：{ showError }）。",
      noAlias: "禁止为 notification.js 的 API 起别名，请直接使用 {{name}}。",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (!isNotificationModule(source)) return;

        for (const spec of node.specifiers) {
          // default import
          if (spec.type === "ImportDefaultSpecifier") {
            context.report({ node: spec, messageId: "noDefault" });
            continue;
          }
          if (spec.type === "ImportSpecifier") {
            const imported = spec.imported && spec.imported.name;
            const local = spec.local && spec.local.name;
            if (!ALLOWED.has(imported)) {
              context.report({
                node: spec,
                messageId: "onlyAllowed",
                data: { names: Array.from(ALLOWED).join("/") },
              });
            } else if (local !== imported) {
              context.report({
                node: spec,
                messageId: "noAlias",
                data: { name: imported },
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
