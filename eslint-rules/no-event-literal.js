/**
 * ESLint 自定义规则：禁止任何字面量字符串事件
 * 目的：统一使用事件常量（*_EVENTS / *_MESSAGE_TYPES 等），避免散落的字符串事件。
 *
 * 允许的例外（规则内部豁免）：
 * - 事件清单/常量定义文件：
 *   - src/frontend/common/event/event-constants.js
 *   - src/frontend/common/event/pdf-viewer-constants.js
 * - 测试与样例：__tests__ / __smoke__ / fixtures / demo html 等（通过全局 eslint ignores/overrides 兜底，规则也再判一次）
 */

const ALLOW_PATH_REGEXPS = [
  /src\/frontend\/common\/event\/event-constants\.js$/u,
  /src\/frontend\/common\/event\/pdf-viewer-constants\.js$/u,
  /src\/frontend\/.*\/features\/.*\/events\.js$/u,
  /src\/frontend\/.*\/feature\.config\.js$/u,
  /__tests__\//u,
  /__smoke__\//u,
  /fixtures\//u,
  /\/dist\//u,
  /test-event-tracing-demo\.html$/u,
  /README\.md$/u,
  /HOW-TO/i,
];

const TRIPLE_EVENT_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/u;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "禁止任何字面量字符串事件，必须从常量命名空间引用",
      recommended: true,
    },
    schema: [],
    messages: {
      noEventLiteral:
        "禁止使用字面量事件名 \"{{value}}\"，请改用常量命名空间（如 PDF_VIEWER_EVENTS.* / WEBSOCKET_EVENTS.* / WEBSOCKET_MESSAGE_TYPES.*）。",
    },
  },
  create(context) {
    const filename = String(context.getFilename?.() || "");
    const nfile = filename.replace(/\\/g, "/");
    const allowed = ALLOW_PATH_REGEXPS.some((re) => re.test(nfile))
      || /src\/frontend\/common\/event\/event-bus(\.original\.backup)?\.js$/u.test(nfile)
      || /src\/frontend\/common\/event\/event-bus-with-tracing\.js$/u.test(nfile);
    if (allowed) {
      // 豁免文件内不检查
      return {};
    }

    return {
      Literal(node) {
        if (typeof node.value !== "string") {return;}
        const s = node.value.trim();
        if (!s) {return;}
        if (TRIPLE_EVENT_RE.test(s)) {
          context.report({
            node,
            messageId: "noEventLiteral",
            data: { value: s },
          });
        }
      },
      TemplateLiteral(node) {
        // 模板字面量中也可能包含硬编码事件（极少见）；保守仅在纯文本单段时检查
        if (node.expressions && node.expressions.length > 0) {return;}
        const cooked = (node.quasis?.[0]?.value?.cooked || "").trim();
        if (cooked && TRIPLE_EVENT_RE.test(cooked)) {
          context.report({
            node,
            messageId: "noEventLiteral",
            data: { value: cooked },
          });
        }
      },
    };
  },
};
