/**
 * 禁止直接使用 iziToast 或直接从 'izitoast' 导入
 * 目的：强制走统一入口 notification.js 或 logger + { toast }
 */

function isWhitelistedFile(filename) {
  if (!filename) { return false; }
  const norm = filename.replace(/\\/g, "/");
  return norm.endsWith("/src/frontend/common/utils/thirdparty-toast.js");
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "禁止直接使用 iziToast 或从 'izitoast' 导入",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      noIzi: "禁止直接使用 iziToast，请使用 notification.js 或 logger + { toast }。",
      noImport: "禁止从 'izitoast' 直接导入，请通过 common/utils/thirdparty-toast.js（仅适配器内部）或公共入口使用。",
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename()) || "";
    const whitelisted = isWhitelistedFile(filename);

    return {
      ImportDeclaration(node) {
        if (whitelisted) { return; }
        const source = node.source && node.source.value;
        if (source === "izitoast" || /\/izitoast(?:\.min)?\.js$/.test(String(source || ""))) {
          context.report({ node: node.source || node, messageId: "noImport" });
        }
      },
      Identifier(node) {
        if (whitelisted) { return; }
        if (node && node.name === "iziToast") {
          context.report({ node, messageId: "noIzi" });
        }
      },
      MemberExpression(node) {
        if (whitelisted) { return; }
        try {
          const obj = node.object;
          if (obj && obj.type === "Identifier" && obj.name === "iziToast") {
            context.report({ node, messageId: "noIzi" });
          }
        } catch (e) { void e; }
      },
    };
  },
};

export default rule;
