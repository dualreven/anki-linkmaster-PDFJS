/**
 * @file AnchorSidebarUI 复制功能测试（复制ID / 复制文内链接）
 * 场景：
 *  - 加载锚点列表后，点击复制菜单项应调用 navigator.clipboard.writeText
 *  - 点击“复制ID”快捷按钮同样应调用 clipboard
 */

import { AnchorSidebarUI } from "../components/anchor-sidebar-ui.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { getEventBus } from "../../../../common/event/event-bus.js";

describe("AnchorSidebarUI copy actions", () => {
  let eventBus;
  let originalClipboard;
  let originalExecCommand;

  beforeAll(() => {
    // Mock clipboard
    originalClipboard = global.navigator.clipboard;
    global.navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
    originalExecCommand = document.execCommand;
    document.execCommand = jest.fn(() => false);
  });

  afterAll(() => {
    // restore clipboard
    global.navigator.clipboard = originalClipboard;
    document.execCommand = originalExecCommand;
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    eventBus = getEventBus("Test-PDFViewer", { enableValidation: false });
  });

  test("复制锚点ID 菜单项应写入剪贴板", async () => {
    const ui = new AnchorSidebarUI(eventBus);
    ui.initialize();

    // 注入一条锚点数据
    const anchors = [ { uuid: "pdfanchor-1234567890ab", name: "A", page_at: 1, is_active: false } ];
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "Jest" });

    // 先选中第一行（UI 不会默认选中）
    const content = ui.getContentElement();
    const row = content.querySelector("tbody[data-role=\"anchor-tbody\"] tr");
    expect(row).toBeTruthy();
    row.click();

    // 打开复制下拉菜单
    const copyBtn = content.querySelector("button[data-action=\"copy\"]");
    expect(copyBtn).toBeTruthy();
    copyBtn.click();

    // 点击“复制锚点ID”
    const menuItem = Array.from(content.querySelectorAll("div"))
      .find(el => el.textContent === "复制锚点ID");
    expect(menuItem).toBeTruthy();
    menuItem.click();
    await new Promise(r => setTimeout(r, 0));

    // 断言
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("pdfanchor-1234567890ab");
  });

  test("复制文内链接 [[id]] 菜单项应写入剪贴板", async () => {
    const ui = new AnchorSidebarUI(eventBus);
    ui.initialize();

    const anchors = [ { uuid: "pdfanchor-abcdef123456", name: "B", page_at: 2, is_active: false } ];
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "Jest" });

    const content = ui.getContentElement();
    const row = content.querySelector("tbody[data-role=\"anchor-tbody\"] tr");
    expect(row).toBeTruthy();
    row.click();

    const copyBtn = content.querySelector("button[data-action=\"copy\"]");
    copyBtn.click();

    const wikiItem = Array.from(content.querySelectorAll("div"))
      .find(el => el.textContent === "复制文内链接");
    expect(wikiItem).toBeTruthy();
    wikiItem.click();
    await new Promise(r => setTimeout(r, 0));

    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("[[pdfanchor-abcdef123456]]");
  });

  // 移除：侧边栏不再提供“复制ID”快捷按钮，仅保留下拉菜单项
});

