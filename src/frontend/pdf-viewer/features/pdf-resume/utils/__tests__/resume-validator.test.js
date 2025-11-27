/**
 * resume-validator 单元测试
 */
import { describe, it, expect } from "@jest/globals";
import { validateResume, isValidResume } from "../resume-validator.js";

describe("resume-validator", () => {
  describe("validateResume", () => {
    it("应返回 null 当输入为 null/undefined", () => {
      expect(validateResume(null)).toBeNull();
      expect(validateResume(undefined)).toBeNull();
    });

    it("应返回 null 当输入不是对象", () => {
      expect(validateResume("string")).toBeNull();
      expect(validateResume(123)).toBeNull();
      expect(validateResume([])).toBeNull();
    });

    it("应返回 null 当 page 缺失或无效", () => {
      expect(validateResume({})).toBeNull();
      expect(validateResume({ page: 0 })).toBeNull();
      expect(validateResume({ page: -1 })).toBeNull();
      expect(validateResume({ page: 1.5 })).toBeNull();
      expect(validateResume({ page: "1" })).toBeNull();
    });

    it("应返回规范化对象当 page 有效", () => {
      const result = validateResume({ page: 5 });
      expect(result).toEqual({ page: 5 });
    });

    it("应正确处理 y_percent 字段", () => {
      expect(validateResume({ page: 1, y_percent: 0 })).toEqual({ page: 1, y_percent: 0 });
      expect(validateResume({ page: 1, y_percent: 50.5 })).toEqual({ page: 1, y_percent: 50.5 });
      expect(validateResume({ page: 1, y_percent: 100 })).toEqual({ page: 1, y_percent: 100 });
    });

    it("应抛错当 y_percent 无效", () => {
      expect(() => validateResume({ page: 1, y_percent: -1 })).toThrow("invalid y_percent");
      expect(() => validateResume({ page: 1, y_percent: 101 })).toThrow("invalid y_percent");
      expect(() => validateResume({ page: 1, y_percent: "50" })).toThrow("invalid y_percent");
      expect(() => validateResume({ page: 1, y_percent: NaN })).toThrow("invalid y_percent");
    });

    it("应正确处理 zoom 字段", () => {
      expect(validateResume({ page: 1, zoom: 1.5 })).toEqual({ page: 1, zoom: 1.5 });
      expect(validateResume({ page: 1, zoom: 0.5 })).toEqual({ page: 1, zoom: 0.5 });
    });

    it("应抛错当 zoom 无效", () => {
      expect(() => validateResume({ page: 1, zoom: 0 })).toThrow("invalid zoom");
      expect(() => validateResume({ page: 1, zoom: -1 })).toThrow("invalid zoom");
      expect(() => validateResume({ page: 1, zoom: "1.5" })).toThrow("invalid zoom");
    });

    it("应正确处理 rotation 字段", () => {
      expect(validateResume({ page: 1, rotation: 0 })).toEqual({ page: 1, rotation: 0 });
      expect(validateResume({ page: 1, rotation: 90 })).toEqual({ page: 1, rotation: 90 });
      expect(validateResume({ page: 1, rotation: 180 })).toEqual({ page: 1, rotation: 180 });
      expect(validateResume({ page: 1, rotation: 270 })).toEqual({ page: 1, rotation: 270 });
    });

    it("应抛错当 rotation 无效", () => {
      expect(() => validateResume({ page: 1, rotation: 45 })).toThrow("invalid rotation");
      expect(() => validateResume({ page: 1, rotation: 360 })).toThrow("invalid rotation");
      expect(() => validateResume({ page: 1, rotation: "90" })).toThrow("invalid rotation");
    });

    it("应正确处理 scroll_mode/spread_mode 字符串字段", () => {
      const result = validateResume({
        page: 1,
        scroll_mode: "vertical",
        spread_mode: "none"
      });
      expect(result.scroll_mode).toBe("vertical");
      expect(result.spread_mode).toBe("none");
    });

    it("应抛错当 scroll_mode/spread_mode 不是字符串", () => {
      expect(() => validateResume({ page: 1, scroll_mode: 0 })).toThrow("invalid scroll_mode");
      expect(() => validateResume({ page: 1, spread_mode: 1 })).toThrow("invalid spread_mode");
    });

    it("应正确处理 updated_at 时间戳", () => {
      const ts = Date.now();
      expect(validateResume({ page: 1, updated_at: ts })).toEqual({ page: 1, updated_at: ts });
    });

    it("应抛错当 updated_at 无效", () => {
      expect(() => validateResume({ page: 1, updated_at: -1 })).toThrow("invalid updated_at");
      expect(() => validateResume({ page: 1, updated_at: 1.5 })).toThrow("invalid updated_at");
    });

    it("应正确处理完整的 resume 对象", () => {
      const input = {
        page: 10,
        y_percent: 35.5,
        zoom: 1.25,
        rotation: 90,
        scroll_mode: "horizontal",
        spread_mode: "odd",
        updated_at: 1700000000000
      };
      const result = validateResume(input);
      expect(result).toEqual(input);
    });
  });

  describe("isValidResume", () => {
    it("应返回 true 当 resume 有效", () => {
      expect(isValidResume({ page: 1 })).toBe(true);
      expect(isValidResume({ page: 5, zoom: 1.5 })).toBe(true);
    });

    it("应返回 false 当 resume 无效（不抛错）", () => {
      expect(isValidResume(null)).toBe(false);
      expect(isValidResume({ page: 0 })).toBe(false);
      expect(isValidResume({ page: 1, zoom: -1 })).toBe(false);
    });
  });
});
