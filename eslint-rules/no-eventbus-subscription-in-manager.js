/**
 * 自定义规则：禁止在 Manager 文件中订阅 EventBus（on/onGlobal/once）
 *
 * 目的：
 * - 强制把 “事件订阅/桥接” 收敛到 Feature composition root / adapter 层
 * - Manager 仅暴露方法 + store，不再通过事件驱动业务主流程（防止面条化回归）
 */

import path from "node:path";

function norm(p) {
  return String(p || "").replace(/\\/g, "/");
}

function isTestFile(filename) {
  const f = norm(filename);
  return /(__tests__|__smoke__|\.test\.(js|mjs)$)/i.test(f);
}

function isManagerFile(filename) {
  const f = norm(filename);
  // 仅在前端范围内生效
  if (!/\/src\/frontend\//.test(f)) { return false; }
  // 以 *.manager*.js 作为 Manager 文件边界（覆盖 *.manager.js / *.manager.v2.js 等）
  return /\.manager(\.[a-z0-9_-]+)?\.js$/i.test(path.posix.basename(f));
}

const FORBIDDEN_METHODS = new Set(["on", "onGlobal", "once", "onceGlobal"]);

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "禁止在 Manager 文件中订阅 EventBus（on/onGlobal/once）",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
    messages: {
      noSubscribe:
        "禁止在 Manager 文件中订阅 EventBus（{{method}}）。请将订阅移动到 Feature 入口/adapter 层，再调用 Manager 方法。",
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename()) || "";
    const skip = !isManagerFile(filename) || isTestFile(filename);
    if (skip) { return {}; }

    function report(node, method) {
      context.report({
        node,
        messageId: "noSubscribe",
        data: { method },
      });
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") { return; }
        if (callee.computed) { return; }
        const prop = callee.property;
        if (!prop || prop.type !== "Identifier") { return; }
        const method = prop.name;
        if (!FORBIDDEN_METHODS.has(method)) { return; }
        report(prop, method);
      },
    };
  },
};

export default rule;

