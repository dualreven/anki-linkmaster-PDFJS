/**
 * 条件 WS 消息 gate 工具测试
 *
 * 目标：约束 gate 对象格式统一（once/on/timeout_ms），
 * 并保证非法配置时 fail-fast 抛出错误（禁止静默兜底）。
 */

import { validateGateConfig } from "../ws-gate-utils.js";

describe("ws-gate-utils.validateGateConfig", () => {
  it("接受仅 once 的合法 gate", () => {
    const gate = validateGateConfig({ once: "pdf-viewer:render:ready" });
    expect(gate).toEqual({ once: "pdf-viewer:render:ready" });
  });

  it("接受仅 on 的合法 gate", () => {
    const gate = validateGateConfig({ on: "pdf-viewer:render:ready" });
    expect(gate).toEqual({ on: "pdf-viewer:render:ready" });
  });

  it("允许可选 timeout_ms 并校验为正整数", () => {
    const gate = validateGateConfig({ once: "pdf-viewer:render:ready", timeout_ms: 2500 });
    expect(gate).toEqual({ once: "pdf-viewer:render:ready", timeout_ms: 2500 });
  });

  it("禁止 once 与 on 同时存在", () => {
    expect(() => validateGateConfig({ once: "a", on: "b" })).toThrow();
  });

  it("禁止空对象或空字符串字段", () => {
    expect(() => validateGateConfig({})).toThrow();
    expect(() => validateGateConfig({ once: "" })).toThrow();
    expect(() => validateGateConfig({ on: "" })).toThrow();
  });

  it("非对象或 null 直接返回 null（视为未配置 gate）", () => {
    expect(validateGateConfig(null)).toBeNull();
    expect(validateGateConfig(undefined)).toBeNull();
    // @ts-expect-error 仅用于运行时校验
    expect(validateGateConfig(123)).toBeNull();
  });

  it("非法 timeout_ms 应抛错，包含 0/负数/NaN", () => {
    expect(() => validateGateConfig({ once: "x", timeout_ms: 0 })).toThrow();
    expect(() => validateGateConfig({ once: "x", timeout_ms: -1 })).toThrow();
    // @ts-expect-error 仅用于运行时校验
    expect(() => validateGateConfig({ once: "x", timeout_ms: Number.NaN })).toThrow();
  });
});
