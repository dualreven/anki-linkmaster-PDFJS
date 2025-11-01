/**
 * PDF Translator 事件注册测试
 * 验证 PDF_TRANSLATOR_EVENTS 是否正确注册到全局事件白名单
 */

import { describe, it, expect } from "@jest/globals";
import { isGlobalEventAllowed } from "../../../../common/event/global-event-registry.js";
import { PDF_TRANSLATOR_EVENTS } from "../events.js";

describe("PDF Translator Events Registration", () => {
  /**
   * 收集所有事件名称
   * @param {Object} obj - 事件常量对象
   * @returns {string[]} 事件名称数组
   */
  function collectEventNames(obj) {
    const names = [];

    function traverse(o) {
      if (typeof o === "string") {
        names.push(o);
        return;
      }
      if (typeof o === "object" && o !== null) {
        Object.values(o).forEach(traverse);
      }
    }

    traverse(obj);
    return names;
  }

  it("应该将所有 PDF_TRANSLATOR_EVENTS 注册到全局白名单", () => {
    const eventNames = collectEventNames(PDF_TRANSLATOR_EVENTS);

    // 验证至少有一些事件
    expect(eventNames.length).toBeGreaterThan(0);

    // 验证所有事件都在白名单中
    eventNames.forEach(eventName => {
      expect(isGlobalEventAllowed(eventName)).toBe(true);
    });
  });

  it("应该注册文本选择事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TEXT.CLEARED)).toBe(true);
  });

  it("应该注册翻译请求事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TRANSLATE.REQUESTED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TRANSLATE.STARTED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.TRANSLATE.FAILED)).toBe(true);
  });

  it("应该注册侧边栏事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.SIDEBAR.TOGGLE)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.SIDEBAR.OPENED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.SIDEBAR.CLOSED)).toBe(true);
  });

  it("应该注册引擎切换事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED)).toBe(true);
  });

  it("应该注册卡片集成事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.CARD.CREATE_REQUESTED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.CARD.CREATE_SUCCESS)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.CARD.CREATE_FAILED)).toBe(true);
  });

  it("应该注册历史记录事件", () => {
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.HISTORY.ADDED)).toBe(true);
    expect(isGlobalEventAllowed(PDF_TRANSLATOR_EVENTS.HISTORY.CLEARED)).toBe(true);
  });

  it("应该遵循三段式事件命名规范", () => {
    const eventNames = collectEventNames(PDF_TRANSLATOR_EVENTS);

    eventNames.forEach(eventName => {
      // 验证三段式格式: {module}:{action}:{status}
      const parts = eventName.split(":");
      expect(parts.length).toBe(3);

      // 验证每段都不为空
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
      });

      // 验证第一段是 'pdf-translator'
      expect(parts[0]).toBe("pdf-translator");
    });
  });

  it("事件名称应该使用小写和连字符", () => {
    const eventNames = collectEventNames(PDF_TRANSLATOR_EVENTS);

    eventNames.forEach(eventName => {
      // 验证只包含小写字母、数字、连字符和冒号
      expect(eventName).toMatch(/^[a-z0-9:-]+$/);

      // 验证不包含下划线
      expect(eventName).not.toContain("_");

      // 验证不包含大写字母
      expect(eventName).toBe(eventName.toLowerCase());
    });
  });
});
