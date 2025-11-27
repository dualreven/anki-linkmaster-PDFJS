/**
 * pdf-page-detection-utils 单元测试
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  detectCenterPageNumber,
  measureYPercent,
  getCurrentPageAndPosition
} from "../pdf-page-detection-utils.js";

describe("pdf-page-detection-utils", () => {
  let container;

  /**
   * 创建模拟的 viewerContainer
   * @param {number} pageCount - 页数
   * @param {number} pageHeight - 每页高度
   */
  function createMockContainer(pageCount = 5, pageHeight = 1000) {
    container = document.createElement("div");
    container.id = "viewerContainer";
    Object.defineProperty(container, "clientHeight", { value: 800, writable: true });
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true });

    let currentTop = 0;
    for (let i = 1; i <= pageCount; i++) {
      const page = document.createElement("div");
      page.className = "page";
      page.setAttribute("data-page-number", String(i));

      // 模拟 offsetTop 和 offsetHeight
      Object.defineProperty(page, "offsetTop", { value: currentTop, writable: true });
      Object.defineProperty(page, "offsetHeight", { value: pageHeight, writable: true });

      container.appendChild(page);
      currentTop += pageHeight + 10; // 10px gap
    }

    document.body.appendChild(container);
  }

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  });

  describe("detectCenterPageNumber", () => {
    it("应抛错当 container 为 null/undefined", () => {
      expect(() => detectCenterPageNumber(null)).toThrow("must be a valid HTMLElement");
      expect(() => detectCenterPageNumber(undefined)).toThrow("must be a valid HTMLElement");
    });

    it("应抛错当 container 不是 HTMLElement", () => {
      expect(() => detectCenterPageNumber("string")).toThrow("must be a valid HTMLElement");
      expect(() => detectCenterPageNumber({})).toThrow("must be a valid HTMLElement");
    });

    it("应返回 null 当容器中没有页面", () => {
      createMockContainer(0);
      expect(detectCenterPageNumber(container)).toBeNull();
    });

    it("应检测到第一页当 scrollTop 为 0", () => {
      createMockContainer(5, 1000);
      Object.defineProperty(container, "scrollTop", { value: 0 });
      // 中心在 400px，第一页范围是 0-1000px
      expect(detectCenterPageNumber(container)).toBe(1);
    });

    it("应检测到正确的页码当滚动到中间", () => {
      createMockContainer(5, 1000);
      // 滚动到第 3 页中心附近（每页 1000px + 10px gap）
      // 第 3 页的 offsetTop = 2020，中心在 scrollTop + 400
      Object.defineProperty(container, "scrollTop", { value: 2120 });
      expect(detectCenterPageNumber(container)).toBe(3);
    });
  });

  describe("measureYPercent", () => {
    it("应抛错当 container 无效", () => {
      expect(() => measureYPercent(null, 1)).toThrow("must be a valid HTMLElement");
    });

    it("应抛错当 pageNumber 无效", () => {
      createMockContainer(5);
      expect(() => measureYPercent(container, 0)).toThrow("must be a positive integer");
      expect(() => measureYPercent(container, -1)).toThrow("must be a positive integer");
      expect(() => measureYPercent(container, 1.5)).toThrow("must be a positive integer");
      expect(() => measureYPercent(container, "1")).toThrow("must be a positive integer");
    });

    it("应返回 null 当页面不存在", () => {
      createMockContainer(5);
      expect(measureYPercent(container, 10)).toBeNull();
    });

    it("应计算正确的 Y 百分比", () => {
      createMockContainer(5, 1000);
      // scrollTop = 0，clientHeight = 800，中心 = 400
      // 第 1 页 offsetTop = 0，offsetHeight = 1000
      // relativeY = 400 - 0 = 400
      // percent = 400 / 1000 * 100 = 40%
      Object.defineProperty(container, "scrollTop", { value: 0 });
      const percent = measureYPercent(container, 1);
      expect(percent).toBeCloseTo(40, 0);
    });

    it("应限制结果在 0-100 范围内", () => {
      createMockContainer(5, 1000);
      // 测试边界情况
      Object.defineProperty(container, "scrollTop", { value: 0 });
      const percent = measureYPercent(container, 1);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });

  describe("getCurrentPageAndPosition", () => {
    it("应抛错当 container 无效", () => {
      expect(() => getCurrentPageAndPosition(null)).toThrow("must be a valid HTMLElement");
    });

    it("应返回 null 当没有页面", () => {
      createMockContainer(0);
      expect(getCurrentPageAndPosition(container)).toBeNull();
    });

    it("应返回正确的页码和位置", () => {
      createMockContainer(5, 1000);
      Object.defineProperty(container, "scrollTop", { value: 0 });

      const result = getCurrentPageAndPosition(container);
      expect(result).not.toBeNull();
      expect(result.pageAt).toBe(1);
      expect(result.position).toBeCloseTo(40, 0);
    });
  });
});
