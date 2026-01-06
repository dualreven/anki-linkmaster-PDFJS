/**
 * @file WS 入站桥接契约：同一条入站消息仅允许发射一次领域事件
 * @description
 * 目的：解决同一条 WS 入站 message 被多个层（Adapter/Feature）同时消费时，
 * 重复 emit 领域事件导致的冗余刷新/重复渲染问题。
 *
 * 约束：
 * - 不修改事件名常量与跨 feature payload 形状；
 * - 通过“message 对象身份”进行去重（WeakMap），避免内存泄漏；
 * - Fail-Fast：eventName / message 非法时直接抛错。
 */

/** @type {WeakMap<object, Set<string>>} */
let emittedByMessage = new WeakMap();

/**
 * 判断“给定 message 是否允许发射某个领域事件”（同一 message+eventName 只允许一次）。
 *
 * @param {Object} params
 * @param {object} params.message - 原始入站 message 对象（必须为对象引用）
 * @param {string} params.eventName - 领域事件名（必须为非空字符串）
 * @returns {boolean}
 */
export function shouldEmitWsInboundDomainEventOnce({ message, eventName } = {}) {
  const name = String(eventName || "").trim();
  if (!name) {
    throw new Error("[ws-inbound-bridge-contract] eventName must be non-empty string");
  }
  if (!message || typeof message !== "object") {
    throw new Error("[ws-inbound-bridge-contract] message must be object");
  }

  let set = emittedByMessage.get(message);
  if (!set) {
    set = new Set();
    emittedByMessage.set(message, set);
  }
  if (set.has(name)) {
    return false;
  }
  set.add(name);
  return true;
}

/**
 * 仅供测试：重置内部 WeakMap（避免跨测试污染）。
 */
export function __resetWsInboundBridgeContractForTests() {
  emittedByMessage = new WeakMap();
}

