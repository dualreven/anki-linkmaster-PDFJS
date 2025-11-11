/**
 * PDFResumeFeature - 单元/集成最小测试
 */
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// 避免真实 pdfjs-dist 触发 jsdom 兼容问题
jest.mock("pdfjs-dist", () => ({ version: "0-test" }), { virtual: true });

import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { PDFResumeFeature } from "../pdf-resume/index.js";

describe("PDFResumeFeature", () => {
  let eventBus;
  let feature;
  let container;
  let sentMessages;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "test-bus", enableValidation: true });
    sentMessages = [];
    eventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => { sentMessages.push(msg); }, { subscriberId: "tester" });

    container = {
      get(name) {
        if (name === "eventBus") { return eventBus; }
        if (name === "navigationService") { return { navigateTo: jest.fn(async () => ({ success: true })) }; }
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
    // 前进时间超过节流阈值
    jest.advanceTimersByTime(2600);
    const msg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED);
    expect(msg).toBeTruthy();
    expect(msg.data?.file_id).toBe("unit-test");
    expect(msg.data?.updates?.json_data?.resume?.page).toBe(5);
    // visited_at 必须为数字
    expect(typeof msg.data?.updates?.visited_at).toBe("number");
  });
});

