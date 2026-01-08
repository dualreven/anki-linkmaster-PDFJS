import { AnchorSidebarUI } from "../anchor-sidebar-ui.js";
import { AnchorManager } from "../../services/anchor.manager.js";
import eventBus from "../../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

describe("AnchorSidebarUI load guard", () => {
  let ui;
  let anchorManager;

  beforeEach(() => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    anchorManager = new AnchorManager();
    ui = new AnchorSidebarUI(eventBus, anchorManager);
    ui.initialize();
    document.getElementById("root").appendChild(ui.getContentElement());
  });

  afterEach(() => {
    ui?.destroy();
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("should show error and allow retry on LOAD_FAILED", () => {
    // 触发加载请求（开始加载态与超时计时）
    const payload = { pdf_uuid: "test-pdf" };
    anchorManager.markLoading(payload);

    // 模拟失败
    anchorManager.markLoadFailed({ message: "backend unreachable", type: "anchor:list:failed" });

    // 断言出现错误提示
    const err = document.querySelector(".anchor-error");
    expect(err).toBeTruthy();
    expect(err.textContent).toContain("加载锚点失败");

    // 点击重试，期望重新发出 LOAD
    const spy = jest.spyOn(eventBus, "emit");
    const btn = err.querySelector("button");
    btn.click();
    // 查找最近一次 emit 调用是否包含 DATA.LOAD
    const called = spy.mock.calls.some(([type]) => type === PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD);
    expect(called).toBe(true);
  });

  test("should show timeout error if no LOADED arrives", () => {
    jest.useFakeTimers();
    anchorManager.markLoading({ pdf_uuid: "test-pdf" });
    // 快进时间（大于内置 5000ms 超时）
    jest.advanceTimersByTime(5200);
    const err = document.querySelector(".anchor-error");
    expect(err).toBeTruthy();
    expect(err.textContent).toContain("请求超时");
  });
});
