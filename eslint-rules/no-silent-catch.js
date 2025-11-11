/**
 * custom/no-silent-catch
 * 目标：禁止产品代码中的“静默 catch”，例如 `catch(e){}` 或 `catch(e){ void e; }`
 * 允许的例外：
 * - 明确标注了 logger 保护用途：在 catch 块内包含注释 `logger-guard`
 * - try 块仅包裹日志/通知调用（启发式）：包含 `logger.`、`showError/showSuccess/showInfo`、`toast`
 */

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow silent catch blocks; require logging or explicit guard comment",
    },
    schema: [],
    messages: {
      silent: "Silent catch detected. Log the error or add a comment 'logger-guard' if this is guarding a logger/toast call.",
    },
  },
  create(context) {
    const source = context.getSourceCode();
    const isVoidOnly = (node) =>
      node &&
      node.type === "ExpressionStatement" &&
      node.expression &&
      node.expression.type === "UnaryExpression" &&
      node.expression.operator === "void";

    return {
      CatchClause(node) {
        // no param or non-block body -> ignore (handled by other rules)
        const body = node.body && node.body.body ? node.body.body : [];
        if (body.length === 0) {
          // 空 catch 已由 no-empty 处理
          return;
        }
        // 仅一条 void 语句
        if (body.length === 1 && isVoidOnly(body[0])) {
          const catchText = source.getText(node.body);
          if (catchText.includes("logger-guard")) {
            return; // 明确注释豁免
          }
          try {
            // 启发式：若 try 块中主要是日志/通知调用，则允许
            const tryText = source.getText(node.parent.block || node.parent);
            if (/(logger\s*\.)|(show(Error|Success|Info)\s*\()|toast/i.test(tryText)) {
              return;
            }
          } catch {
            /* fallthrough */
          }
          context.report({ node: body[0], messageId: "silent" });
        }
      },
    };
  },
};

