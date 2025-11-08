/**
 * @jest-environment jsdom
 *
 * 目的（集成抽测）：
 * - 在启用 FEATURE_ALIASES 的情况下，注册并安装一组互相依赖的特性，
 *   验证“旧名/新名混用”时依赖解析、安装顺序与状态查询均可用。
 * - 避免真实 WebSocket/后端依赖：通过在容器中预注册 'infra-app' 作为占位，满足 'app-core' 依赖。
 */
import { describe, beforeEach, test, expect, jest } from "@jest/globals";

// 避免真实 pdfjs-dist 行为（多副本/Worker等）
jest.mock("pdfjs-dist", () => ({
  version: "0-test",
  build: "test",
  GlobalWorkerOptions: { workerSrc: "", standardFontDataUrl: "" }
}), { virtual: true });

// mock PDF.js web viewer module used by PDFViewerManager
jest.mock("@pdfjs/web/pdf_viewer.mjs", () => {
  class EventBus {}
  class PDFViewer {
    constructor() {
      this.currentScale = 1.0;
      this.currentScaleValue = "page-width";
      this.currentPageNumber = 1;
      this.pagesCount = 1;
    }
  }
  class PDFLinkService {}
  class PDFFindController {}
  class PDFHistory {}
  return { EventBus, PDFViewer, PDFLinkService, PDFFindController, PDFHistory };
}, { virtual: true });

// jsdom 不提供 canvas.getContext，避免依赖代码报错
if (global.HTMLCanvasElement) {

  HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
}

import { FeatureRegistry } from "../../../common/micro-service/feature-registry.js";
import FEATURE_ALIASES from "../../../common/micro-service/feature-aliases.js";
import { SimpleDependencyContainer } from "../../container/simple-dependency-container.js";

// 被测特性（选取装配链上的代表，按需引入）
import { TextSelectionQuickActionsFeature } from "../pdf-quick-actions/index.js";
import { SearchFeature } from "../pdf-search/index.js";

describe("命名统一与别名解析 — 集成安装（installAll）", () => {
  let container;
  let registry;
  let mockEventBus;

  beforeEach(() => {
    // 构造最小 DOM 结构，满足 UIManagerCore/Annotation 对 DOM 的基本需求
    document.body.innerHTML = `
      <div id="pdf-container"></div>
      <div id="viewer-container"></div>
      <div id="viewerContainer"></div>
      <div id="pdf-viewer-button-container" class="sidebar-buttons"></div>
      <div id="page-display"></div>
      <div id="zoom-display"></div>
    `;

    // 构造容器与总线
    container = new SimpleDependencyContainer("integration");
    mockEventBus = { on: jest.fn(), emit: jest.fn(), off: jest.fn() };

    // 预注册 'infra-app' 以满足 'app-core' 依赖（通过别名解析）
    container.register("infra-app", { kind: "placeholder" });

    registry = new FeatureRegistry({
      container,
      globalEventBus: mockEventBus,
      aliases: FEATURE_ALIASES
    });
  });

  test("旧名/新名混用时可 installAll，且状态查询对旧名与新名一致", async () => {
    // 以“服务占位 + 轻量安装”的方式降低集成测试耦合
    // 通过根容器提供依赖占位，避免真实 UI/WS 初始化
    container.register("infra-ui", { kind: "placeholder-ui" });
    container.register("infra-nav-core", { kind: "placeholder-core-nav" });
    container.register("pdf-translator", { kind: "placeholder-translator" });
    container.register("pdf-annotation", { kind: "placeholder-annotation" });
    container.register("pdfViewerManager", { kind: "stub-viewer-manager" });

    // 仅安装与命名统一相关的 Representative Features
    registry.register(new TextSelectionQuickActionsFeature()); // 依赖：app-core + annotation + pdf-translator（均由占位/别名满足）
    registry.register(new SearchFeature());                    // 依赖：app-core + ui-manager（占位）

    // 安装所有
    await registry.installAll();

    // 断言：canonical 与 alias 查询状态一致
    // 占位满足的依赖本身不会显示为 installed（非注册特性），仅验证别名映射不阻塞安装
    expect(registry.getStatus("pdf-annotation")).toBe("unregistered");
    expect(registry.getStatus("annotation")).toBe("unregistered");

    expect(registry.getStatus("pdf-quick-actions")).toBe("installed");
    expect(registry.getStatus("text-selection-quick-actions")).toBe("installed");

    expect(registry.getStatus("pdf-search")).toBe("installed");
    expect(registry.getStatus("search")).toBe("installed");

    // spot check：未注册但通过容器占位满足的依赖，不会出现在“已安装列表”中
    // 但 installAll 不应抛出，且上方断言已证明目标特性顺利安装
  });
});
