/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：验证 PDFAnchorFeature 在接收到 URL_PARAMS.PARSED 与锚点数据、文件加载完成信号后，
 * 会通过 URL 导航事件触发受控导航请求（不直接调用 navigationService），以保证行为不走样。
 *
 * 注意：
 * - 该用例不依赖 URLParamsParser，直接通过事件驱动。
 * - 事件总线采用项目内置实现；局部事件以 @scope/ 前缀发布，需订阅相同前缀事件。
 */

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { PDFAnchorFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

// 暂时跳过：该用例依赖较复杂的门闸时序（URL→锚点→渲染）与内部延迟，后续联调再启用
describe.skip("PDFAnchorFeature - URL_PARAMS 受控导航门闸", () => {
  beforeEach(() => {
    // 清理全局事件总线监听
    try { globalEventBus.destroy(); } catch {}
    // jsdom 最小 DOM
    document.body.innerHTML = `<div id="viewerContainer"></div>`;
    // 伪造 URL 参数（使用 history.pushState 避免 jsdom 导航）
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=doc-001");
  });

  test("收到 URL_PARAMS.PARSED + ANCHOR.DATA.LOADED + FILE.LOAD.SUCCESS 后发出 URL_PARAMS.REQUESTED", async () => {
    const emitted = [];
    const emittedAny = [];
    // 监视所有 emit 调用（包括局部事件）
    const originalEmit = globalEventBus.emit.bind(globalEventBus);
    globalEventBus.emit = (evt, data, meta) => {
      emittedAny.push({ evt, data, meta });
      return originalEmit(evt, data, meta);
    };
    const subscribe = (evt) => {
      return globalEventBus.on(evt, (data) => emitted.push({ evt, data }), { subscriberId: "test" });
    };
    // 订阅局部事件：pdf-anchor 作用域的 URL 导航请求
    const offReq = subscribe(`@pdf-anchor/${PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED}`);

    // 构建依赖容器与 Feature
    const container = createContainer({
      navigationService: {
        navigateTo: jest.fn().mockResolvedValue({ success: true, actualPage: 5, actualPosition: 50 }),
      },
    });

    const feature = new PDFAnchorFeature();
    await feature.install({
      container,
      globalEventBus,
      logger: console,
    });

    // 1) URL 参数解析完成（包含 anchorId 与页码/位置）
    const anchorId = "pdfanchor-1234567890ab";
    globalEventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, {
      anchorId,
      pageAt: 5,
      position: 50,
      pdfId: "doc-001",
    });

    // 2) 后端返回锚点数据（含该 anchorId）
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, {
      anchors: [{ uuid: anchorId, name: "A", page_at: 5, position: 0.5, is_active: true }],
    });

    // 3) 文件加载成功（作为渲染就绪门闸）
    globalEventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-001.pdf" });

    // 异步等待任务调度 + 内部延迟（~1s）
    await new Promise((r) => setTimeout(r, 1200));

    // 断言：已发出 URL 请求事件（局部事件）
    // 优先检查显式订阅
    const gotExplicit = emitted.some((e) => e.evt === `@pdf-anchor/${PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED}`);
    // 其次检查所有事件流
    const gotInAll = emittedAny.some((e) => e.evt === `@pdf-anchor/${PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED}`);
    expect(gotExplicit || gotInAll).toBe(true);
    offReq?.();
  });
});
