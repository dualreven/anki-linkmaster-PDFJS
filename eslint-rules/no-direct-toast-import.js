/**
 * ESLint 自定义规则：禁止直接导入 thirdparty-toast 适配器
 * 目的：
 *  - 业务代码一律通过公共入口使用 toast：
 *      1) Logger：getLogger(...).error(..., { toast })
 *      2) Notification：common/utils/notification.js
 *  - 屏蔽乱用 `import('../../common/utils/thirdparty-toast.js')`（动态/静态）
 * 允许例外（白名单文件）：
 *  - src/frontend/common/utils/thirdparty-toast.js   // 适配器自身
 *  - src/frontend/common/utils/notification.js       // 公共封装
 *  - src/frontend/common/utils/logger.js             // 日志封装
 */

function isWhitelistedFile(filename) {
  if (!filename) { return false; }
  const norm = filename.replace(/\\/g, "/");
  return (
    norm.endsWith("/src/frontend/common/utils/thirdparty-toast.js") ||
    norm.endsWith("/src/frontend/common/utils/notification.js") ||
    norm.endsWith("/src/frontend/common/utils/logger.js")
  );
}

function isThirdpartyToastPath(importSource) {
  if (typeof importSource !== "string") { return false; }
  return importSource.includes("common/utils/thirdparty-toast.js");
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "禁止业务代码直接导入 thirdparty-toast.js，需通过 logger 或 notification 使用",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      noDirectImport:
        "禁止直接导入 thirdparty-toast.js。请改为：1) 使用 getLogger(...).<level>(msg, { toast })；或 2) 从 common/utils/notification.js 导入 showXxx。",
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename()) || "";
    const whitelisted = isWhitelistedFile(filename);

    function reportIfThirdparty(node, sourceValue) {
      if (whitelisted) { return; }
      if (isThirdpartyToastPath(sourceValue)) {
        context.report({ node, messageId: "noDirectImport" });
      }
    }

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        reportIfThirdparty(node.source || node, source);
      },
      ImportExpression(node) {
        // 动态 import('.../thirdparty-toast.js')
        const arg = node.source;
        if (arg && arg.type === "Literal" && typeof arg.value === "string") {
          reportIfThirdparty(arg, arg.value);
          return;
        }
        // import(someVar) - 无法静态判断字符串，忽略
      },
      CallExpression(node) {
        // 兼容 require('.../thirdparty-toast.js') 形式（极少见）
        if (
          node.callee &&
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments &&
          node.arguments.length === 1 &&
          node.arguments[0].type === "Literal" &&
          typeof node.arguments[0].value === "string"
        ) {
          reportIfThirdparty(node.arguments[0], node.arguments[0].value);
        }
      },
    };
  },
};

export default rule;
