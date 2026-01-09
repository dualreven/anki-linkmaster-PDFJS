import { isGlobalEventAllowed } from "./global-event-registry.js";
import { EventNameValidator } from "./event-name-validator.js";
import { SUPPRESSED_EVENT_LOGS, shouldLogPublishEvent } from "./event-bus-logging.js";
import { safeSerializeForTrace } from "./trace-safe-serialize.js";

export function eventBusEmit(ctx) {
  const {
    event,
    data,
    options = {},
    events,
    enableValidation,
    actorId,
    payloadValidationEnabled,
    payloadValidateFn,
    moduleName,
    enableTracing,
    messageTracer,
    log,
  } = ctx;

  if (typeof event !== "string" || !event) {
    const stack = (() => { try { return new Error().stack?.split("\n").slice(1, 6).join("\n"); } catch { return ""; } })();
    const msg = [
      `未注册的全局事件：'${event}'，已被禁止发布`,
      "请使用 event-constants.js 中已存在的事件，或先提交契约PR新增事件后再使用",
      actorId ? `执行者ID: ${actorId}` : "",
      stack ? `调用栈:\n${stack}` : ""
    ].filter(Boolean).join("\n");
    log("error", msg, { event, data });
    return;
  }

  if (enableValidation) {
    const error = EventNameValidator.getValidationError(event, { actorId });
    if (error) {
      log("error", `事件发布被阻止: ${error}`, { event, data });
      return;
    }
  }

  if (!event?.startsWith("@") && !isGlobalEventAllowed(event)) {
    const err = `未注册的全局事件：'${event}'，已被禁止发布` +
      "\n请使用 event-constants.js 中已存在的事件，或先提交契约PR新增事件后再使用" +
      (actorId ? `\n执行者ID: ${actorId}` : "");
    log("error", err, { event, data });
    return;
  }

  if (!event?.startsWith("@") && payloadValidationEnabled && typeof payloadValidateFn === "function") {
    try {
      const result = payloadValidateFn(event, data);
      if (result && result.valid === false) {
        const errMsg = [
          "❌ 事件负载契约校验失败，已阻止发布",
          `事件: ${event}`,
          moduleName ? `模块: ${moduleName}` : "",
          actorId ? `执行者: ${actorId}` : "",
          result.errors ? `错误: ${safeSerializeForTrace(result.errors, { maxLength: 300 })}` : ""
        ].filter(Boolean).join("\n");
        log("error", errMsg, { event });
        return;
      }
    } catch (e) {
      log("warn", `事件负载校验器执行异常（已放行）：${e?.message || e}`, { event });
    }
  }

  const subscribers = events[event];

  let messageTrace = null;
  let messageId = null;
  let traceId = null;
  const startTime = Date.now();

  if (enableTracing && messageTracer) {
    messageId = messageTracer.generateMessageId();
    traceId = options.parentTraceId || messageId;

    messageTrace = {
      messageId,
      traceId,
      event,
      publisher: actorId || "unknown",
      subscribers: subscribers ? Array.from(subscribers.keys()) : [],
      timestamp: startTime,
      parentMessageId: options.parentMessageId,
      data: safeSerializeForTrace(data, { maxLength: 500 }),
      executionResults: []
    };
  }

  try {
    if (typeof window !== "undefined" && (window.__E2E_EVENT_TAP__ === true)) {
      try {
        window.__e2e_events__ = window.__e2e_events__ || [];
        window.__e2e_events__.push({ ev: event, data });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  const logPublish = (subscriberCount, suffix = "") => {
    if (SUPPRESSED_EVENT_LOGS.has(event)) { return; }
    if (!shouldLogPublishEvent(event)) { return; }

    const truncatedData = safeSerializeForTrace(data, { maxLength: 200 });

    log("event", `${event} (发布 by ${actorId || "unknown"})${suffix}`, "发布", {
      actorId,
      subscriberCount,
      data: truncatedData,
      messageId,
      traceId
    });
  };

  if (subscribers && subscribers.size > 0) {
    logPublish(subscribers.size);

    for (const [id, callback] of subscribers.entries()) {
      const callbackStartTime = Date.now();

      try {
        if (enableTracing && callback.length >= 2) {
          callback(data, {
            messageId,
            traceId,
            parentMessageId: messageId
          });
        } else {
          callback(data);
        }

        if (messageTrace) {
          messageTrace.executionResults.push({
            subscriberId: id,
            success: true,
            executionTime: Date.now() - callbackStartTime
          });
        }
      } catch (err) {
        if (messageTrace) {
          messageTrace.executionResults.push({
            subscriberId: id,
            success: false,
            error: err.message,
            executionTime: Date.now() - callbackStartTime
          });
        }

        log("error", `事件回调执行出错: ${err.message}`, {
          event,
          subscriberId: id,
          actorId,
          error: err,
          messageId,
          traceId
        });
      }
    }
  } else {
    logPublish(0, " - 无订阅者");
  }

  if (messageTrace) {
    messageTrace.totalExecutionTime = Date.now() - startTime;
    messageTracer.recordMessage(messageTrace);
  }

  if (enableTracing && messageId) {
    return {
      messageId,
      traceId,
      timestamp: Date.now()
    };
  }
}
