/**
 * @file 功能域集成测试
 * @description 验证4个功能域可以正确注册和安装
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
// 避免在测试环境动态导入真实的 pdfjs-dist（存在多副本冲突），提供虚拟模块
jest.mock("pdfjs-dist", () => ({
  version: "0-test",
  build: "test",
  GlobalWorkerOptions: { workerSrc: "", standardFontDataUrl: "" }
}), { virtual: true });

import { DependencyContainer, FeatureRegistry } from "../../../common/micro-service/index.js";

// 导入4个功能域
import { PDFReaderFeature } from "../pdf-reader/index.js";
import { PDFUIFeature } from "../pdf-ui/index.js";
// pdf-outline 替代，相关验证调整
import { WebSocketAdapterFeature } from "../infra-ws-adapter/index.js";

describe("功能域集成测试", () => {
  let container;
  let registry;

  beforeEach(() => {
    container = new DependencyContainer("pdf-viewer-test");
    const mockEventBus = { on: jest.fn(), emit: jest.fn(), off: jest.fn() };
    registry = new FeatureRegistry({ container, globalEventBus: mockEventBus });
  });

  describe("功能域注册", () => {
    it("应该成功注册pdf-reader功能", () => {
      const feature = new PDFReaderFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe("pdf-reader");
      expect(feature.version).toBe("1.0.0");
      expect(feature.dependencies).toEqual([]);
    });

    it("应该成功注册pdf-ui功能", () => {
      const feature = new PDFUIFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe("pdf-ui");
      expect(feature.dependencies).toContain("pdf-reader");
    });

    // pdf-outline 已替代旧实现，此处不再验证旧实现

    it("应该成功注册websocket-adapter功能", () => {
      const feature = new WebSocketAdapterFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe("infra-ws-adapter");
    });

    it("应该一次性注册核心功能", () => {
      expect(() => {
        registry.register(new PDFReaderFeature());
        registry.register(new PDFUIFeature());
        registry.register(new WebSocketAdapterFeature());
      }).not.toThrow();
    });
  });

  describe("依赖关系验证", () => {
    it("pdf-ui应该依赖pdf-reader", () => {
      const feature = new PDFUIFeature();
      expect(feature.dependencies).toContain("pdf-reader");
    });

    // pdf-outline 已替代旧实现，此处不再验证旧实现

    it("websocket-adapter应该无依赖", () => {
      const feature = new WebSocketAdapterFeature();
      expect(feature.dependencies).toEqual([]);
    });

    it("pdf-reader应该无依赖", () => {
      const feature = new PDFReaderFeature();
      expect(feature.dependencies).toEqual([]);
    });
  });

  describe("生命周期钩子", () => {
    beforeEach(() => {
      // 注册StateManager
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register("stateManager", mockStateManager);
      // 注册最小 EventBus（供 pdf-reader 内部服务使用）
      const mockEventBus = { on: jest.fn(), emit: jest.fn(), off: jest.fn() };
      container.register("eventBus", mockEventBus);
      // jsdom 不实现 canvas.getContext，提供空实现以避开初始化报错
      if (global.HTMLCanvasElement) {
        HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
      }
    });

    it("pdf-reader应该能够安装和卸载", async () => {
      const feature = new PDFReaderFeature();
      registry.register(feature);

      expect(feature.isEnabled()).toBe(false);

      await registry.install("pdf-reader");
      expect(feature.isEnabled()).toBe(true);

      await registry.uninstall("pdf-reader");
      expect(feature.isEnabled()).toBe(false);
    });

    it("pdf-ui应该能够安装和卸载", async () => {
      const feature = new PDFUIFeature();
      registry.register(feature);
      registry.register(new PDFReaderFeature());

      await registry.install("pdf-reader");
      await registry.install("pdf-ui");

      await registry.uninstall("pdf-ui");
      expect(feature.isEnabled()).toBe(false);
    });

    it("应该按依赖顺序安装功能", async () => {
      // 注册所有功能（注意：故意乱序，去除已废弃模块）
      registry.register(new PDFUIFeature());
      registry.register(new PDFReaderFeature());

      // 安装所有功能
      await registry.installAll();

      // 验证都已安装
      expect(registry.getStatus("pdf-reader")).toBe("installed");
      expect(registry.getStatus("pdf-ui")).toBe("installed");
      // 不再校验已废弃模块
    });
  });

  describe("PDF-Viewer应用场景", () => {
    it("应该能够构建完整的PDF-Viewer应用", async () => {
      // 注册StateManager
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register("stateManager", mockStateManager);

      // 注册核心功能域
      registry.register(new PDFReaderFeature());
      registry.register(new PDFUIFeature());
      registry.register(new WebSocketAdapterFeature());

      // 安装所有功能
      await registry.installAll();

      // 验证都已安装
      expect(registry.getStatus("pdf-reader")).toBe("installed");
      expect(registry.getStatus("pdf-ui")).toBe("installed");
      // 不再校验已废弃模块
      expect(registry.getStatus("infra-ws-adapter")).toBe("installed"); // 旧名通过别名解析
    });

    it("应该能够选择性安装功能", async () => {
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register("stateManager", mockStateManager);

      // 注册所有核心功能
      registry.register(new PDFReaderFeature());
      registry.register(new PDFUIFeature());
      registry.register(new WebSocketAdapterFeature());

      // 只安装核心功能
      await registry.install("pdf-reader");
      await registry.install("pdf-reader");
      await registry.install("pdf-ui");
      // 验证
      expect(registry.getStatus("pdf-reader")).toBe("installed");
      expect(registry.getStatus("pdf-ui")).toBe("installed");
      // 不再校验已废弃模块
      expect(registry.getStatus("infra-ws-adapter")).toBe("registered"); // 未安装（旧名通过别名解析）
    });
  });
});

