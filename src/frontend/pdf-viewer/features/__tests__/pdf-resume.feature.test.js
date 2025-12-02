/**
 * PDFResumeFeature - 单元/集成最小测试
 * 重构版本 - 适配模块化架构（PositionTracker + ResumeUpdater）
 */
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// 避免真实 pdfjs-dist 触发 jsdom 兼容问题
jest.mock("pdfjs-dist", () => ({ version: "0-test" }), { virtual: true });

import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { PDFResumeFeature } from "../pdf-resume/index.js";

describe("PDFResumeFeature", () => {
  let eventBus;
  let feature;
  let container;
  let sentMessages;
  let pdfViewerManager;
  let mockNavigationService;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "test-bus", enableValidation: true });
    sentMessages = [];
    eventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => { sentMessages.push(msg); }, { subscriberId: "tester" });

    pdfViewerManager = null;
    mockNavigationService = { navigateTo: jest.fn(async () => ({ success: true })) };

    container = {
      get(name) {
        if (name === "eventBus") { return eventBus; }
        if (name === "navigationService") { return mockNavigationService; }
        if (name === "pdfViewerManager") { return pdfViewerManager; }
        return null;
      },
      registerGlobal() {}
    };
    feature = new PDFResumeFeature();

    // 设置 URL
    const url = new URL("http://localhost/pdf-viewer/?pdf-id=unit-test");
    window.history.replaceState({}, "", url.toString());

    // 创建 viewerContainer DOM（PositionTracker 需要）
    const viewerContainer = document.createElement("div");
    viewerContainer.id = "viewerContainer";
    viewerContainer.style.height = "800px";
    viewerContainer.style.overflow = "auto";
    // 添加一些模拟页面
    for (let i = 1; i <= 10; i++) {
      const page = document.createElement("div");
      page.className = "page";
      page.setAttribute("data-page-number", String(i));
      page.style.height = "1000px";
      viewerContainer.appendChild(page);
    }
    document.body.appendChild(viewerContainer);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    // 清理 DOM
    const viewerContainer = document.getElementById("viewerContainer");
    if (viewerContainer) {
      viewerContainer.remove();
    }
  });

  it("在文件加载成功时应请求 pdf_info 详情（info:requested）", async () => {
    await feature.install({ container, globalEventBus: eventBus });
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "tester" });
    // 通过调度的 resume 加载触发 info:requested（fallback 延迟 500ms）
    jest.advanceTimersByTime(600);
    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST);
    expect(msg).toBeTruthy();
    expect(msg.data).toEqual({ pdf_id: "unit-test" });
  });

  it("在页面变更后（节流）应发送 record-update:requested（含 resume.page）", async () => {
    // 准备 pdfViewerManager（提供当前页和视图状态）
    pdfViewerManager = {
      currentPageNumber: 1,
      currentScale: 1.0,
      scrollMode: 0,
      spreadMode: 0,
      pagesRotation: 0
    };

    // 为 pdf-resume 提供 DomEventHub（模拟 UIManagerFeature 注册的全局服务）
    const viewerContainer = document.getElementById("viewerContainer");
    const { DomEventHub } = await import("../../shared/dom-event-hub.js");
    const domEventHub = new DomEventHub({ viewerContainer, documentRef: document, windowRef: window });

    container = {
      get(name) {
        if (name === "eventBus") { return eventBus; }
        if (name === "navigationService") { return mockNavigationService; }
        if (name === "pdfViewerManager") { return pdfViewerManager; }
        if (name === "domEventHub") { return domEventHub; }
        return null;
      },
      has(name) {
        return name === "eventBus" ||
               name === "navigationService" ||
               name === "pdfViewerManager" ||
               name === "domEventHub";
      },
      registerGlobal() {}
    };

    feature = new PDFResumeFeature();

    await feature.install({ container, globalEventBus: eventBus });

    // 模拟用户滚动到第 5 页附近
    viewerContainer.scrollTop = 4000; // 每页 1000px，高度 800px，中心落在第 5 页
    viewerContainer.dispatchEvent(new Event("scroll"));

    // PositionTracker 默认 200ms 去抖
    jest.advanceTimersByTime(250);

    // 第一笔事件应立即触发一次写入
    let msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeTruthy();
    expect(msg.data?.file_id).toBe("unit-test");
    expect(msg.data?.updates?.json_data?.resume?.page).toBe(pdfViewerManager.currentPageNumber);
    expect(typeof msg.data?.updates?.visited_at).toBe("number");

    // 在 1 秒内再次滚动，不应产生新的写入（1 秒节流）
    sentMessages = sentMessages.filter(m => m.type !== WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);
    msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeFalsy();

  });

  it("在更新 resume 时应写入布局字符串与旋转角度", async () => {
    // 准备一个带有视图状态的 pdfViewerManager stub
    pdfViewerManager = {
      _scale: 1.25,
      _scrollMode: 3,
      _spreadMode: 2,
      _rotation: 90,
      currentPageNumber: 1,
      get currentScale() { return this._scale; },
      set currentScale(v) { this._scale = v; },
      get scrollMode() { return this._scrollMode; },
      set scrollMode(v) { this._scrollMode = v; },
      get spreadMode() { return this._spreadMode; },
      set spreadMode(v) { this._spreadMode = v; },
      get pagesRotation() { return this._rotation; },
      set pagesRotation(v) { this._rotation = v; }
    };

    const viewerContainer = document.getElementById("viewerContainer");
    const { DomEventHub } = await import("../../shared/dom-event-hub.js");
    const domEventHub = new DomEventHub({ viewerContainer, documentRef: document, windowRef: window });

    container = {
      get(name) {
        if (name === "eventBus") { return eventBus; }
        if (name === "navigationService") { return mockNavigationService; }
        if (name === "pdfViewerManager") { return pdfViewerManager; }
        if (name === "domEventHub") { return domEventHub; }
        return null;
      },
      has(name) {
        return name === "eventBus" ||
               name === "navigationService" ||
               name === "pdfViewerManager" ||
               name === "domEventHub";
      },
      registerGlobal() {}
    };

    feature = new PDFResumeFeature();

    await feature.install({ container, globalEventBus: eventBus });

    // 通过滚动事件驱动 resume 更新
    viewerContainer.scrollTop = 9000; // 让中心落在第 10 页
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);

    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeTruthy();

    const resume = msg.data?.updates?.json_data?.resume;
    expect(resume).toBeTruthy();
    // 页面字段存在即可（具体页码由位置探测/当前页决定）
    expect(typeof resume.page).toBe("number");
    // 缩放比例必须写入
    expect(resume.zoom).toBeCloseTo(1.25);
    // 布局字符串与旋转角度
    expect(resume.scroll_mode).toBe("page");
    expect(resume.spread_mode).toBe("even");
    expect(resume.rotation).toBe(90);
  });

  it("在收到 resume 后应恢复缩放与布局并执行导航", async () => {
    // 准备 pdfViewerManager stub（初始状态与期望状态不同，便于断言）
    pdfViewerManager = {
      _scale: 1.0,
      _scrollMode: 0,
      _spreadMode: 0,
      _rotation: 0,
      currentPageNumber: 1,
      get currentScale() { return this._scale; },
      set currentScale(v) { this._scale = v; },
      get scrollMode() { return this._scrollMode; },
      set scrollMode(v) { this._scrollMode = v; },
      get spreadMode() { return this._spreadMode; },
      set spreadMode(v) { this._spreadMode = v; },
      get pagesRotation() { return this._rotation; },
      set pagesRotation(v) { this._rotation = v; }
    };

    await feature.install({ container, globalEventBus: eventBus });

    // 触发 FILE.LOAD.SUCCESS，驱动 pdf-resume 请求详情（通过调度的 resume 加载）
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "tester" });
    jest.advanceTimersByTime(600);
    const detailReq = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST);
    expect(detailReq).toBeTruthy();

    // 伪造一次包含 resume 的详情回包
    eventBus.emit(
      WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
      {
        type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED,
        data: {
          id: "unit-test",
          pdf_id: "unit-test",
          json_data: {
            resume: {
              page: 5,
              y_percent: 40,
              zoom: 1.5,
              scroll_mode: "horizontal",
              spread_mode: "odd",
              rotation: 180
            }
          }
        }
      },
      { actorId: "tester" }
    );

    // 等待异步 loadResume Promise 完成
    // 需要多个 microtask 周期让 Promise 链完全执行
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 视图状态必须已被恢复到 resume 中的值
    expect(pdfViewerManager.currentScale).toBe(1.5);
    // horizontal → 1, odd → 1
    expect(pdfViewerManager.scrollMode).toBe(1);
    expect(pdfViewerManager.spreadMode).toBe(1);
    expect(pdfViewerManager.pagesRotation).toBe(180);

    // 导航服务应该被调用
    expect(mockNavigationService.navigateTo).toHaveBeenCalledWith({
      pageAt: 5,
      position: 40
    });
  });
});
