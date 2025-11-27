/**
 * view-mode-converter 单元测试
 */
import { describe, it, expect } from "@jest/globals";
import {
  scrollModeToString,
  scrollModeFromString,
  spreadModeToString,
  spreadModeFromString,
  isValidScrollMode,
  isValidSpreadMode
} from "../view-mode-converter.js";

describe("view-mode-converter", () => {
  describe("scrollModeToString", () => {
    it("应将数值转换为字符串", () => {
      expect(scrollModeToString(0)).toBe("vertical");
      expect(scrollModeToString(1)).toBe("horizontal");
      expect(scrollModeToString(2)).toBe("wrapped");
      expect(scrollModeToString(3)).toBe("page");
    });

    it("应抛错当值不是整数", () => {
      expect(() => scrollModeToString(1.5)).toThrow("invalid scrollMode value");
      expect(() => scrollModeToString("0")).toThrow("invalid scrollMode value");
      expect(() => scrollModeToString(null)).toThrow("invalid scrollMode value");
    });

    it("应抛错当值超出范围", () => {
      expect(() => scrollModeToString(4)).toThrow("unsupported scrollMode value");
      expect(() => scrollModeToString(-1)).toThrow("unsupported scrollMode value");
    });
  });

  describe("scrollModeFromString", () => {
    it("应将字符串转换为数值", () => {
      expect(scrollModeFromString("vertical")).toBe(0);
      expect(scrollModeFromString("horizontal")).toBe(1);
      expect(scrollModeFromString("wrapped")).toBe(2);
      expect(scrollModeFromString("page")).toBe(3);
    });

    it("应忽略大小写", () => {
      expect(scrollModeFromString("VERTICAL")).toBe(0);
      expect(scrollModeFromString("Horizontal")).toBe(1);
      expect(scrollModeFromString("  wrapped  ")).toBe(2);
    });

    it("应抛错当值不是字符串", () => {
      expect(() => scrollModeFromString(0)).toThrow("must be a string");
      expect(() => scrollModeFromString(null)).toThrow("must be a string");
    });

    it("应抛错当值不被支持", () => {
      expect(() => scrollModeFromString("invalid")).toThrow("unsupported scroll_mode");
      expect(() => scrollModeFromString("")).toThrow("unsupported scroll_mode");
    });
  });

  describe("spreadModeToString", () => {
    it("应将数值转换为字符串", () => {
      expect(spreadModeToString(0)).toBe("none");
      expect(spreadModeToString(1)).toBe("odd");
      expect(spreadModeToString(2)).toBe("even");
    });

    it("应抛错当值不是整数", () => {
      expect(() => spreadModeToString(1.5)).toThrow("invalid spreadMode value");
    });

    it("应抛错当值超出范围", () => {
      expect(() => spreadModeToString(3)).toThrow("unsupported spreadMode value");
      expect(() => spreadModeToString(-1)).toThrow("unsupported spreadMode value");
    });
  });

  describe("spreadModeFromString", () => {
    it("应将字符串转换为数值", () => {
      expect(spreadModeFromString("none")).toBe(0);
      expect(spreadModeFromString("odd")).toBe(1);
      expect(spreadModeFromString("even")).toBe(2);
    });

    it("应忽略大小写", () => {
      expect(spreadModeFromString("NONE")).toBe(0);
      expect(spreadModeFromString("ODD")).toBe(1);
    });

    it("应抛错当值不被支持", () => {
      expect(() => spreadModeFromString("invalid")).toThrow("unsupported spread_mode");
    });
  });

  describe("isValidScrollMode", () => {
    it("应返回 true 当值有效", () => {
      expect(isValidScrollMode(0)).toBe(true);
      expect(isValidScrollMode(1)).toBe(true);
      expect(isValidScrollMode(2)).toBe(true);
      expect(isValidScrollMode(3)).toBe(true);
    });

    it("应返回 false 当值无效", () => {
      expect(isValidScrollMode(4)).toBe(false);
      expect(isValidScrollMode(-1)).toBe(false);
      expect(isValidScrollMode(1.5)).toBe(false);
      expect(isValidScrollMode("0")).toBe(false);
      expect(isValidScrollMode(null)).toBe(false);
    });
  });

  describe("isValidSpreadMode", () => {
    it("应返回 true 当值有效", () => {
      expect(isValidSpreadMode(0)).toBe(true);
      expect(isValidSpreadMode(1)).toBe(true);
      expect(isValidSpreadMode(2)).toBe(true);
    });

    it("应返回 false 当值无效", () => {
      expect(isValidSpreadMode(3)).toBe(false);
      expect(isValidSpreadMode(-1)).toBe(false);
    });
  });
});
