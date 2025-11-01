/**
 * ESLint 自定义规则：检查事件名称格式
 * @file eslint-rules/event-name-format.js
 *
 * 用途：检查 eventBus.emit() 和 eventBus.on() 调用中的事件名称
 * 确保事件名称符合三段式格式：{module}:{action}:{status}
 */

const eventNameFormatRule = {
  meta: {
    type: "problem",
    docs: {
      description: "强制事件名称使用三段式格式 {module}:{action}:{status}",
      category: "Best Practices",
      recommended: true
    },
    fixable: null,
    schema: [],
    messages: {
      invalidFormat: "❌ 事件名称 \"{{eventName}}\" 格式不正确。必须使用三段式格式：{module}:{action}:{status}",
      notString: "❌ 事件名称必须是字符串字面量，不能使用变量或模板字符串",
      tooFewSegments: "❌ 事件名称 \"{{eventName}}\" 只有 {{count}} 段，缺少 {{missing}}",
      tooManySegments: "❌ 事件名称 \"{{eventName}}\" 有 {{count}} 段，超过3段限制",
      emptySegment: "❌ 事件名称 \"{{eventName}}\" 包含空段",
      invalidChars: "❌ 事件名称 \"{{eventName}}\" 的第{{position}}段 \"{{segment}}\" 包含非法字符（只允许小写字母、数字、连字符）",
      useHelperFunction: "💡 建议：使用 createEventName() 辅助函数来创建事件名称"
    }
  },

  create(context) {
    /**
     * 验证事件名称格式
     */
    function validateEventName(eventName) {
      const parts = eventName.split(":");

      // 检查段数
      if (parts.length < 3) {
        const missing = [];
        if (parts.length === 1) { missing.push("action", "status"); }
        if (parts.length === 2) { missing.push("status"); }
        return {
          valid: false,
          messageId: "tooFewSegments",
          data: { eventName, count: parts.length, missing: missing.join(" 和 ") }
        };
      }

      if (parts.length > 3) {
        return {
          valid: false,
          messageId: "tooManySegments",
          data: { eventName, count: parts.length }
        };
      }

      // 检查空段
      if (parts.some(part => !part)) {
        return {
          valid: false,
          messageId: "emptySegment",
          data: { eventName }
        };
      }

      // 检查每段的格式（小写字母开头 + 小写字母/数字/连字符）
      for (let i = 0; i < parts.length; i += 1) {
        const segment = parts[i];
        if (!/^[a-z][a-z0-9-]*$/.test(segment)) {
          const segmentNames = ["module", "action", "status"];
          return {
            valid: false,
            messageId: "invalidChars",
            data: {
              eventName,
              position: i + 1,
              segment,
              segmentName: segmentNames[i]
            }
          };
        }
      }

      return { valid: true };
    }

    /**
     * 检查函数调用
     */
    function isEventBusLike(objExpr) {
      try {
        let cur = objExpr;
        // 判定链条上是否有 eventBus/…EventBus/私有 #eventBus
        while (cur) {
          if (cur.type === "Identifier") {
            const n = cur.name || "";
            if (/eventbus|event_bus|^bus$/i.test(n)) { return true; }
            return false;
          }
          if (cur.type === "MemberExpression") {
            const prop = cur.property;
            if (prop && prop.type === "Identifier" && /eventbus|event_bus/i.test(prop.name)) { return true; }
            if (prop && prop.type === "PrivateIdentifier") { return true; } // 识别 this.#eventBus
            cur = cur.object;
            continue;
          }
          if (cur.type === "ThisExpression") {
            // 继续向外一层 MemberExpression 检查 PrivateIdentifier
            return false;
          }
          // 其他类型放过
          return false;
        }
      } catch (e) { void e; }
      return false;
    }

    function checkCallExpression(node) {
      // 只检查“像 EventBus 的 emit/on/once/off 调用”
      if (node.callee.type !== "MemberExpression") {
        return;
      }

      if (node.callee.property.type !== "Identifier") {
        return;
      }

      const methodName = node.callee.property.name;
      if (!["emit", "on", "once", "off"].includes(methodName)) {
        return;
      }

      if (!isEventBusLike(node.callee.object)) {
        // 非 EventBus 的 on/emit（例如 jQuery.on('ready.jstree', ...)）跳过
        return;
      }

      // 第一个参数应该是事件名称
      if (node.arguments.length === 0) {
        return;
      }

      const firstArg = node.arguments[0];

      // 允许两种形式：1) 字符串字面量；2) 来自常量命名空间的成员表达式（如 PDF_VIEWER_EVENTS.X.Y）
      if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
        const eventName = firstArg.value;
        const result = validateEventName(eventName);
        if (!result.valid) {
          context.report({
            node: firstArg,
            messageId: result.messageId,
            data: result.data
          });
        }
        return;
      }

      if (firstArg.type === "MemberExpression") {
        // 允许从命名空间常量读取：PDF_VIEWER_EVENTS / WEBSOCKET_EVENTS / ..._EVENTS / *_MESSAGE_TYPES
        const walk = (expr) => {
          let cur = expr;
          while (cur && cur.type === "MemberExpression") {
            cur = cur.object;
          }
          return cur;
        };
        const root = walk(firstArg);
        if (root && root.type === "Identifier") {
          const name = root.name || "";
          if (/_EVENTS$/.test(name) || /_MESSAGE_TYPES$/.test(name) || name === "PDF_VIEWER_EVENTS" || name === "WEBSOCKET_EVENTS") {
            return; // 合法：来自常量命名空间
          }
        }
        // 其他 MemberExpression 视为不合规（例如某对象临时属性）
        context.report({ node: firstArg, messageId: "notString" });
        return;
      }

      // 变量/模板字符串一律提示改为常量或字面量
      if (firstArg.type === "Identifier" || firstArg.type === "TemplateLiteral") {
        context.report({
          node: firstArg,
          messageId: "notString"
        });
      }
    }

    return {
      CallExpression: checkCallExpression
    };
  }
};

export default eventNameFormatRule;
