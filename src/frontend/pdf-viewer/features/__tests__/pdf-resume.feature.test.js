/**
 * PDFResumeFeature - 单元/集成最小测试
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

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "test-bus", enableValidation: true });
    sentMessages = [];
    eventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => { sentMessages.push(msg); }, { subscriberId: "tester" });

    pdfViewerManager = null;

    container = {
      get(name) {
        if (name === "eventBus") { return eventBus; }
        if (name === "navigationService") { return { navigateTo: jest.fn(async () => ({ success: true })) }; }
        if (name === "pdfViewerManager") { return pdfViewerManager; }
        return null;
      },
      registerGlobal() {}
    };
    feature = new PDFResumeFeature();
    // 设置 URL
    const url = new URL("http://localhost/pdf-viewer/?pdf-id=unit-test");
    window.history.replaceState({}, "", url.toString());
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("在文件加载成功时应请求 pdf_info 详情（info:requested）", async () => {
    await feature.install({ container, globalEventBus: eventBus });
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "tester" });
    // 立即发送 info:requested
    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST);
    expect(msg).toBeTruthy();
    expect(msg.data).toEqual({ pdf_id: "unit-test" });
  });

  it("在页面变更后（节流）应发送 record-update:requested（含 resume.page）", async () => {
    await feature.install({ container, globalEventBus: eventBus });
    // 触发一次页面切换
    eventBus.emit(PDF_VIEWER_EVENTS.PAGE.CHANGING, { pageNumber: 5 }, { actorId: "tester" });
    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeTruthy();
    expect(msg.data?.file_id).toBe("unit-test");
    expect(msg.data?.updates?.json_data?.resume?.page).toBe(5);
    // visited_at 必须为数字
    expect(typeof msg.data?.updates?.visited_at).toBe("number");
  });

  it("在更新 resume 时应写入布局字符串与旋转角度", async () => {
    // 准备一个带有视图状态的 pdfViewerManager stub
    pdfViewerManager = {
      _scale: 1.25,
      _scrollMode: 3,
      _spreadMode: 2,
      _rotation: 90,
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

    // 触发一次页面切换以驱动 resume 更新
    eventBus.emit(PDF_VIEWER_EVENTS.PAGE.CHANGING, { pageNumber: 10 }, { actorId: "tester" });
    jest.advanceTimersByTime(2600);

    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeTruthy();

    const resume = msg.data?.updates?.json_data?.resume;
    expect(resume).toBeTruthy();
    expect(resume.page).toBe(10);
    // 缩放比例必须写入
    expect(resume.zoom).toBeCloseTo(1.25);
    // 布局字符串与旋转角度
    expect(resume.scroll_mode).toBe("page");
    expect(resume.spread_mode).toBe("even");
    expect(resume.rotation).toBe(90);
  });

  it("在已有显式导航时仍应恢复缩放与布局但不再次发起导航", async () => {
    // 记录导航请求事件
    const navRequests = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      (data) => { navRequests.push(data); },
      { subscriberId: "tester-nav" }
    );

    // 准备 pdfViewerManager stub（初始状态与期望状态不同，便于断言）
    pdfViewerManager = {
      _scale: 1.0,
      _scrollMode: 0,
      _spreadMode: 0,
      _rotation: 0,
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

    // 先触发一次显式 URL 导航，请求页码 2
    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      { pdfId: "unit-test", pageAt: 2, position: null },
      { actorId: "tester-explicit" }
    );
    expect(navRequests.length).toBe(1);

    // 触发 FILE.LOAD.SUCCESS，驱动 pdf-resume 请求详情
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "tester" });
    const detailReq = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST);
    expect(detailReq).toBeTruthy();

    // 伪造一次包含 resume 的详情回包
    eventBus.emit(
      WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
      {
        type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED,
        data: {
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

    // 不应产生新的导航请求（仍然只有显式那一次）
    expect(navRequests.length).toBe(1);

    // 但视图状态必须已被恢复到 resume 中的值
    expect(pdfViewerManager.currentScale).toBe(1.5);
    // horizontal / odd 映射到对应模式值
    expect(pdfViewerManager.scrollMode).not.toBe(0);
    expect(pdfViewerManager.spreadMode).not.toBe(0);
    expect(pdfViewerManager.pagesRotation).toBe(180);
  });
});
