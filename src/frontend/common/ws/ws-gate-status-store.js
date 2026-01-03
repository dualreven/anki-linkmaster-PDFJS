/**
 * @file WS gate 状态存储（单窗口内存）
 * @description
 * - 为 `ws-gate-runner` 的 gate.once 提供“命中历史”的状态来源
 * - 提供给 Feature/Adapter 复用，避免各模块各自维护私有 store 导致门控割裂
 * - 注意：这是“每个前端窗口（JS runtime）各自一份”的内存状态，不跨窗口共享
 * - Fail-Fast：eventName 必须为非空字符串，禁止兜底
 */

import { createEventStatusStore, markEventFired } from "./ws-gate-runner.js";

/** @type {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }} */
const STORE = createEventStatusStore();

export function getWsGateStatusStore() {
  return STORE;
}

export function markWsGateEventFired(eventName, payload) {
  markEventFired(STORE, eventName, payload);
}

export function getWsGateEventStatus(eventName) {
  const name = String(eventName || "").trim();
  if (!name) {
    throw new Error("[ws-gate-status-store] eventName must be non-empty string");
  }
  return STORE.events[name] || null;
}

export function clearWsGateStatusStore() {
  STORE.events = {};
}

