/* eslint-disable custom/event-name-format */
/**
 * @file WebSocket 条件 gate 执行辅助工具（通用）
 * @description
 * 基于 EventBus 和内存状态字典，实现 WS 消息上的 gate.once / gate.on 语义：
 * - once: 若目标事件之前已发生，则立即执行；否则等待首次发生再执行一次；
 * - on:   仅等待下一次事件发生后执行（不关心历史）。
 *
 * 设计原则：
 * - Fail-Fast：非法参数立即抛错，禁止静默兜底；
 * - 只负责“等条件满足再执行回调”，不关心业务语义；
 * - 不直接依赖特定事件常量，事件名使用字符串（由调用方提供）。
 */

import { getLogger } from "../utils/logger.js";
import { validateGateConfig } from "./ws-gate-utils.js";

const logger = getLogger("WsGateRunner");

/**
 * @typedef {import("../event/event-bus.js").EventBus} EventBus
 */

/**
 * 创建事件状态存储容器。
 * 结构：{ [eventName: string]: { fired: boolean, count: number, lastPayload: any, lastAt: number } }
 *
 * @returns {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }}
 */
export function createEventStatusStore() {
  return {
    events: {}
  };
}

/**
 * 标记事件已触发，更新状态字典。
 *
 * @param {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }} store
 * @param {string} eventName
 * @param {any} payload
 */
export function markEventFired(store, eventName, payload) {
  if (!store || typeof store !== "object" || !store.events) {
    throw new Error("[ws-gate] invalid store");
  }
  const name = String(eventName || "").trim();
  if (!name) {
    throw new Error("[ws-gate] eventName must be non-empty string");
  }
  const now = Date.now();
  const prev = store.events[name] || { fired: false, count: 0, lastPayload: null, lastAt: 0 };
  store.events[name] = {
    fired: true,
    count: prev.count + 1,
    lastPayload: payload,
    lastAt: now
  };
}

/**
 * 等待 gate 条件满足后执行回调。
 *
 * @param {Object} options
 * @param {EventBus} options.eventBus
 * @param {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }} options.store
 * @param {unknown} options.rawGate - 来自 WS 消息的 gate 字段
 * @param {(payload:any)=>Promise<void>|void} options.run - 条件满足后执行的回调
 * @returns {Promise<void>}
 */
export async function runWithGate({ eventBus, store, rawGate, run } = {}) {
  if (!eventBus) {
    throw new Error("[ws-gate] eventBus is required");
  }
  if (!store || typeof store !== "object" || !store.events) {
    throw new Error("[ws-gate] store with events is required");
  }
  if (typeof run !== "function") {
    throw new Error("[ws-gate] run callback is required");
  }

  const gate = validateGateConfig(rawGate);
  // 未配置 gate：直接执行
  if (!gate) {
    await run(null);
    return;
  }

  const targetEvent = gate.once || gate.on;
  const useOnce = !!gate.once;
  const timeoutMs = gate.timeout_ms || null;

  const name = String(targetEvent || "").trim();
  if (!name) {
    throw new Error("[ws-gate] gate target event name must be non-empty");
  }

  // once 语义：若已触发过，则立即执行
  const status = store.events[name];
  if (useOnce && status && status.fired) {
    logger.debug("[ws-gate] gate.once satisfied by history", {
      event: name,
      count: status.count,
      lastAt: status.lastAt
    });
    await run(status.lastPayload);
    return;
  }

  // 否则订阅下一次事件（once / on 在订阅行为上相同）
  await new Promise((resolve, reject) => {
    let done = false;
    let timerId = null;

    const unsubscribe = eventBus.onGlobal
      ? eventBus.onGlobal(name, handler, { subscriberId: "WsGateRunner" })
      : eventBus.on(name, handler, { subscriberId: "WsGateRunner" });

    function cleanup() {
      if (done) { return; }
      done = true;
      try {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      } catch (e) {
        logger.warn("[ws-gate] failed to unsubscribe", e);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    function handler(payload) {
      try {
        markEventFired(store, name, payload);
      } catch (e) {
        logger.warn("[ws-gate] markEventFired failed in handler", e);
      }

      // on 和 once 在这里行为相同：第一下就触发
      try {
        Promise.resolve(run(payload))
          .then(() => {
            cleanup();
            resolve();
          })
          .catch((err) => {
            cleanup();
            reject(err);
          });
      } catch (e) {
        cleanup();
        reject(e);
      }
    }

    if (timeoutMs && timeoutMs > 0) {
      timerId = setTimeout(() => {
        logger.warn("[ws-gate] gate timeout", { event: name, timeoutMs });
        cleanup();
        reject(new Error(`[ws-gate] timeout waiting for event ${name}`));
      }, timeoutMs);
    }
  });
}
