import { isGlobalEventAllowed } from "./global-event-registry.js";
import { EventNameValidator } from "./event-name-validator.js";
import { VERBOSE_EVENT_LOGS_ENABLED } from "./event-bus-logging.js";

export function eventBusOn(ctx) {
  const {
    event,
    callback,
    options = {},
    events,
    enableValidation,
    inferredSubscriberId,
    inferredActorId,
    nextSubscriberId,
    log,
    off
  } = ctx;

  const subscriberId = options.subscriberId || inferredSubscriberId || nextSubscriberId();
  const actorId = options.actorId || inferredActorId;

  if (typeof event !== "string" || !event) {
    const stack = (() => { try { return new Error().stack?.split("\n").slice(1, 6).join("\n"); } catch { return ""; } })();
    const msg = [
      `未注册的全局事件：'${event}'，已被禁止订阅`,
      "请使用 event-constants.js 中已存在的事件，或先提交契约PR新增事件后再使用",
      subscriberId ? `订阅者ID: ${subscriberId}` : "",
      actorId ? `执行者ID: ${actorId}` : "",
      stack ? `调用栈:\n${stack}` : ""
    ].filter(Boolean).join("\n");
    log("error", msg, { event });
    return () => {};
  }

  if (!event.startsWith("@") && !isGlobalEventAllowed(event)) {
    const stack = (() => { try { return new Error().stack?.split("\n").slice(1, 6).join("\n"); } catch { return ""; } })();
    const err = `未注册的全局事件：'${event}'，已被禁止订阅` +
      "\n请使用 event-constants.js 中已存在的事件，或先提交契约PR新增事件后再使用" +
      (subscriberId ? `\n订阅者ID: ${subscriberId}` : "") +
      (actorId ? `\n执行者ID: ${actorId}` : "") +
      (stack ? `\n调用栈:\n${stack}` : "");
    log("error", err, { event });
    return () => {};
  }

  if (enableValidation) {
    const error = EventNameValidator.getValidationError(event, { subscriberId, actorId });
    if (error) {
      log("error", `事件订阅失败: ${error}, 事件名: ${event}`);
      throw new Error(`无效的事件名称: ${error}`);
    }
  }

  if (!events[event]) {events[event] = new Map();}

  if (events[event].has(subscriberId)) {
    const errorMsg = [
      "❌ 重复订阅检测！",
      "",
      `事件名称: "${event}"`,
      `订阅者ID: "${subscriberId}"`,
      "",
      "💡 可能原因:",
      "1. 同一个组件多次调用 eventBus.on() 订阅同一事件",
      "2. 组件未正确清理旧订阅（调用 unsubscribe()）",
      "3. 多个组件使用了相同的 subscriberId（如多次实例化同一组件）",
      "",
      "🔧 解决方法:",
      "1. 确保组件销毁时调用 unsubscribe() 清理订阅",
      "2. 或传递唯一的 subscriberId: eventBus.on(event, callback, { subscriberId: 'unique-id' })",
      "3. 或使用 off() 手动移除旧订阅后再重新订阅",
      "4. 检查是否有组件被错误地多次实例化",
    ].join("\n");

    log("error", errorMsg);
    throw new Error(`重复订阅: 事件 "${event}" 已被 "${subscriberId}" 订阅`);
  }

  events[event].set(subscriberId, callback);

  if (VERBOSE_EVENT_LOGS_ENABLED) {
    log("event", `${event}`, "订阅", { subscriberId, actorId });
  }

  return () => off(event, subscriberId);
}

export function eventBusOff(ctx) {
  const { event, callbackOrId, events, log } = ctx;

  const subscribers = events[event];
  if (!subscribers) {return;}

  let removedId = null;
  if (typeof callbackOrId === "function") {
    for (const [id, cb] of subscribers.entries()) {
      if (cb === callbackOrId) {
        subscribers.delete(id);
        removedId = id;
        break;
      }
    }
  } else {
    if (subscribers.has(callbackOrId)) {
      subscribers.delete(callbackOrId);
      removedId = callbackOrId;
    }
  }

  if (removedId !== null) {
    if (subscribers.size === 0) {delete events[event];}
    if (VERBOSE_EVENT_LOGS_ENABLED) {
      log("event", `${event} (取消订阅 by ${removedId})`);
    }
  }
}
