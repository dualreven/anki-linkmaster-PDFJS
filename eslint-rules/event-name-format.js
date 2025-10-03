/**
 * ESLint 自定义规则：检查事件名称格式
 * @file eslint-rules/event-name-format.js
 *
 * 用途：检查 eventBus.emit() 和 eventBus.on() 调用中的事件名称
 * 确保事件名称符合三段式格式：{module}:{action}:{status}
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '强制事件名称使用三段式格式 {module}:{action}:{status}',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [],
    messages: {
      invalidFormat: '❌ 事件名称 "{{eventName}}" 格式不正确。必须使用三段式格式：{module}:{action}:{status}',
      notString: '❌ 事件名称必须是字符串字面量，不能使用变量或模板字符串',
      tooFewSegments: '❌ 事件名称 "{{eventName}}" 只有 {{count}} 段，缺少 {{missing}}',
      tooManySegments: '❌ 事件名称 "{{eventName}}" 有 {{count}} 段，超过3段限制',
      emptySegment: '❌ 事件名称 "{{eventName}}" 包含空段',
      invalidChars: '❌ 事件名称 "{{eventName}}" 的第{{position}}段 "{{segment}}" 包含非法字符（只允许小写字母、数字、连字符）',
      useHelperFunction: '💡 建议：使用 createEventName() 辅助函数来创建事件名称'
    }
  },

  create(context) {
    /**
     * 验证事件名称格式
     */
    function validateEventName(eventName) {
      const parts = eventName.split(':');

      // 检查段数
      if (parts.length < 3) {
        const missing = [];
        if (parts.length === 1) missing.push('action', 'status');
        if (parts.length === 2) missing.push('status');
        return {
          valid: false,
          messageId: 'tooFewSegments',
          data: { eventName, count: parts.length, missing: missing.join(' 和 ') }
        };
      }

      if (parts.length > 3) {
        return {
          valid: false,
          messageId: 'tooManySegments',
          data: { eventName, count: parts.length }
        };
      }

      // 检查空段
      if (parts.some(p => !p)) {
        return {
          valid: false,
          messageId: 'emptySegment',
          data: { eventName }
        };
      }

      // 检查每段的格式（小写字母开头 + 小写字母/数字/连字符）
      for (let i = 0; i < parts.length; i++) {
        const segment = parts[i];
        if (!/^[a-z][a-z0-9-]*$/.test(segment)) {
          const segmentNames = ['module', 'action', 'status'];
          return {
            valid: false,
            messageId: 'invalidChars',
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
    function checkCallExpression(node) {
      // 只检查 eventBus.emit() 和 eventBus.on() 调用
      if (node.callee.type !== 'MemberExpression') return;
      if (node.callee.property.type !== 'Identifier') return;

      const methodName = node.callee.property.name;
      if (!['emit', 'on', 'once', 'off'].includes(methodName)) return;

      // 第一个参数应该是事件名称
      if (node.arguments.length === 0) return;
      const firstArg = node.arguments[0];

      // 只检查字符串字面量
      if (firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') {
        // 如果使用了变量或模板字符串，给出提示
        if (firstArg.type === 'Identifier' || firstArg.type === 'TemplateLiteral') {
          context.report({
            node: firstArg,
            messageId: 'notString'
          });
        }
        return;
      }

      const eventName = firstArg.value;

      // 验证事件名称
      const result = validateEventName(eventName);
      if (!result.valid) {
        context.report({
          node: firstArg,
          messageId: result.messageId,
          data: result.data
        });
      }
    }

    return {
      CallExpression: checkCallExpression
    };
  }
};
