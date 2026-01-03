class EventNameValidator {
  static validate(event) {
    if (typeof event !== "string" || !event) {return false;}

    const parts = event.split(":");

    return parts.length === 3 && parts.every((p) => p.length > 0);
  }

  static getValidationError(event, context = {}) {
    if (typeof event !== "string" || !event) {
      return this.#buildError(
        `事件名称必须是非空字符串，但收到了：${typeof event} (${event})`,
        null,
        context
      );
    }

    const parts = event.split(":");

    if (parts.length !== 3) {
      return this.#buildError(
        `事件名称 '${event}' 格式不正确`,
        this.#suggestFix(event, parts),
        context
      );
    }

    if (parts.some((p) => p.length === 0)) {
      return this.#buildError(
        `事件名称 '${event}' 的各个部分不能为空`,
        "确保格式为 {module}:{action}:{status}，每部分都有内容",
        context
      );
    }

    return null;
  }

  static #buildError(mainMessage, suggestion, context) {
    const lines = [];

    lines.push("❌ 事件名称验证失败！");
    lines.push("");
    lines.push(`错误：${mainMessage}`);
    lines.push("");
    lines.push("📋 正确格式：{module}:{action}:{status} (必须正好3段，用冒号分隔)");
    lines.push("");
    lines.push("✅ 正确示例：");
    lines.push("  - pdf:load:completed");
    lines.push("  - bookmark:toggle:requested");
    lines.push("  - sidebar:open:success");
    lines.push("");
    lines.push("❌ 错误示例：");
    lines.push("  - loadData (缺少冒号)");
    lines.push("  - pdf:list:data:loaded (超过3段)");
    lines.push("  - pdf_list_updated (使用下划线)");
    lines.push("  - onButtonClick (非事件格式)");

    if (suggestion) {
      lines.push("");
      lines.push(`💡 建议修复：${suggestion}`);
    }

    if (context.actorId || context.subscriberId) {
      lines.push("");
      lines.push(this.#formatContext(context));
    }

    lines.push("");
    lines.push("⚠️ 此事件发布/订阅已被阻止！请立即修复事件名称。");

    return lines.join("\n");
  }

  static #suggestFix(event, parts) {
    if (event.includes("_")) {
      const fixed = event.replace(/_/g, "-");
      return `检测到下划线命名，请使用连字符：'${fixed}'`;
    }

    if (/[a-z][A-Z]/.test(event)) {
      return "检测到驼峰命名，事件名应该使用小写+连字符格式";
    }

    if (parts.length === 1) {
      return "事件名缺少冒号，应该分为3段：模块名:动作名:状态";
    }

    if (parts.length === 2) {
      return "事件名只有2段，缺少第3段状态（如：requested/completed/failed）";
    }

    if (parts.length > 3) {
      return `事件名超过3段 (${parts.length}段)，请合并为：{${parts.slice(0, -2).join("-")}}:{${parts[parts.length-2]}}:{${parts[parts.length-1]}}`;
    }

    return "使用格式：{module}:{action}:{status}";
  }

  static #formatContext(context) {
    const { subscriberId, actorId } = context;
    const parts = [];

    if (subscriberId) {parts.push(`订阅者ID: ${subscriberId}`);}
    if (actorId) {parts.push(`执行者ID: ${actorId}`);}

    return parts.length > 0 ? `📍 位置信息：${parts.join(", ")}` : "";
  }
}

export { EventNameValidator };

