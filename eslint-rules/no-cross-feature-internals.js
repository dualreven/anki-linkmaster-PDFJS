/**
 * 自定义规则：禁止跨特性（features）内部深层 import
 *
 * 背景：
 * - 允许：从另一个 feature 的公共入口 import（index.js / public.js）
 * - 禁止：从另一个 feature 的内部目录 import（components / services / core / ... 任意深层）
 * - 例外：测试与冒烟（__tests__/、__smoke__/、*.test.js）允许跨特性引用以便搭建场景
 * - 临时白名单：部分待重构文件可在此放行，后续逐步清空
 */

import path from "node:path";

function norm(p) {
  return String(p || "").replace(/\\/g, "/");
}

function isTestFile(filename) {
  const f = norm(filename);
  return /(__tests__|__smoke__|\.test\.js$)/i.test(f);
}

function getCurrentFeature(filename) {
  const f = norm(filename);
  const m = f.match(/\/src\/frontend\/pdf-viewer\/features\/([^/]+)\//);
  return m ? m[1] : null;
}

function resolveImport(filename, source) {
  try {
    const basedir = path.posix.dirname(norm(filename));
    const joined = path.posix.normalize(path.posix.join(basedir, source));
    return joined;
  } catch {
    return source;
  }
}

function parseTargetFeature(resolved) {
  const m = norm(resolved).match(/\/src\/frontend\/pdf-viewer\/features\/([^/]+)\/(.+)/);
  if (!m) { return null; }
  return { feature: m[1], subpath: m[2] };
}

function isAllowedPublicSubpath(subpath) {
  const s = norm(subpath);
  return s === "index.js" || s === "public.js";
}

// 临时白名单（待分批清理）
function isTemporarilyWhitelisted(filename, source) {
  const f = norm(filename);
  const s = norm(source);
  // 允许：outline 复用 bookmark 的 toolbar（待抽成公共域后移除）
  if (
    f.endsWith("/src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js") &&
    s.includes("features/pdf-bookmark/components/bookmark-toolbar.js")
  ) {
    return true;
  }
  return false;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "禁止跨特性内部深层 import（只允许 index.js/public.js 公共入口）",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
    messages: {
      crossImport:
        "禁止从其他 feature 的内部路径导入（{{target}}/{{sub}}）。请改为从 '{{target}}/index.js' 或 '{{target}}/public.js' 导入，或通过 DI 容器获取。",
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename()) || "";
    const curFeature = getCurrentFeature(filename);
    const skip = !curFeature || isTestFile(filename);

    function checkNode(node, sourceValue) {
      if (skip || typeof sourceValue !== "string") { return; }
      if (!sourceValue.startsWith(".")) { return; } // 仅检查相对路径
      if (isTemporarilyWhitelisted(filename, sourceValue)) { return; }

      const resolved = resolveImport(filename, sourceValue);
      if (!/\/src\/frontend\/pdf-viewer\/features\//.test(resolved)) { return; }
      const info = parseTargetFeature(resolved);
      if (!info) { return; }
      const { feature: target, subpath } = info;
      if (target === curFeature) { return; } // 同 feature 内部允许
      if (isAllowedPublicSubpath(subpath)) { return; }

      // 命中跨特性内部导入
      context.report({
        node,
        messageId: "crossImport",
        data: { target, sub: subpath },
      });
    }

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        checkNode(node.source || node, source);
      },
      ImportExpression(node) {
        const arg = node.source;
        if (arg && arg.type === "Literal" && typeof arg.value === "string") {
          checkNode(arg, arg.value);
        }
      },
      CallExpression(node) {
        if (
          node.callee &&
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments &&
          node.arguments.length === 1 &&
          node.arguments[0].type === "Literal" &&
          typeof node.arguments[0].value === "string"
        ) {
          checkNode(node.arguments[0], node.arguments[0].value);
        }
      },
    };
  },
};

export default rule;

