/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 保证过渡期别名模块存在且导出对象；
 * - 约束键值均为 string→string；当前应为空映射（Step 1）。
 */
import FEATURE_ALIASES, { FEATURE_ALIASES as NAMED } from "../feature-aliases.js";

describe("feature-aliases 模块", () => {
  test("应导出对象（Record<string,string>），且目前为空映射", () => {
    expect(typeof FEATURE_ALIASES).toBe("object");
    expect(FEATURE_ALIASES).toBe(NAMED);
    for (const [k, v] of Object.entries(FEATURE_ALIASES)) {
      expect(typeof k).toBe("string");
      expect(typeof v).toBe("string");
      expect(k.length).toBeGreaterThan(0);
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

