/**
 * @file PDF Anchor 添加/删除 冒烟测试
 * 目标：验证“添加锚点”动作能即时更新列表，不再出现“无反应”
 */

// 避免引入真实 logger/import.meta & 第三方 toast
jest.mock("../../common/utils/logger.js", () => {
  return {
    getLogger: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    setModuleLogLevel: jest.fn(),
    LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
  };
});
jest.mock("../../common/utils/thirdparty-toast.js", () => ({
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../../common/utils/notification.js", () => ({
  showInfo: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { PDFAnchorFeature } from "../features/pdf-anchor/index.js";
import { AnchorSidebarUI } from "../features/pdf-anchor/components/anchor-sidebar-ui.js";

describe("Smoke | Anchor Create/Delete", () => {
  let bus;
  let feature;
  let ui;

  beforeEach(async () => {
    // DOM 准备：提供基本容器，避免默认采样报错
    document.body.innerHTML = `
      <div id="app-root"></div>
      <div id="viewerContainer" style="height:800px; overflow:auto;">
        <div class="page" data-page-number="1" style="height:1200px;"></div>
      </div>
    `;

    // 极简事件总线（避免全局事件白名单的限制）
    const listeners = new Map();
    const emitted = [];
    bus = {
      on: (evt, cb) => {
        if (!listeners.has(evt)) {listeners.set(evt, []);}
        listeners.get(evt).push(cb);
        return () => {};
      },
      emit: (evt, data) => {
        emitted.push(evt);
        const arr = listeners.get(evt) || [];
        arr.forEach((fn) => { try { fn(data); } catch(_) {} });
      },
      // 兼容可能的 onGlobal/emitGlobal 调用
      onGlobal: (evt, cb) => { return bus.on(evt, cb); },
      emitGlobal: (evt, data) => { return bus.emit(evt, data); }
    };
    // 暴露给断言
    bus.__emitted = emitted;

    // 安装 Feature（仅依赖 eventBus）
    feature = new PDFAnchorFeature();
    await feature.install({
      container: {
        get: (k) => (k === "eventBus" ? bus : null)
      },
      globalEventBus: bus
    });

    // 初始化侧边栏 UI
    ui = new AnchorSidebarUI(bus);
    ui.initialize();
    document.getElementById("app-root").appendChild(ui.getContentElement());
  });

  afterEach(async () => {
    try { await feature?.uninstall?.(); } catch (_) {}
    try { ui?.destroy?.(); } catch (_) {}
    document.body.innerHTML = "";
  });

  test("添加锚点后应在表格出现新行", async () => {
    const root = ui.getContentElement();
    const addBtn = root.querySelector("button[data-action=\"add\"]");
    expect(addBtn).toBeTruthy();
    addBtn.click();

    // 填写弹窗并保存
    const nameInput = document.getElementById("anchor-name");
    const pageInput = document.getElementById("anchor-page");
    const posInput = document.getElementById("anchor-pos");
    expect(nameInput && pageInput && posInput).toBeTruthy();
    nameInput.value = "E2E-锚点";
    pageInput.value = "1";
    posInput.value = "35";
    // 点击保存
    const saveBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "保存");
    expect(saveBtn).toBeTruthy();
    saveBtn.click();

    // 让事件循环一轮，等待监听器处理
    await new Promise((r) => setTimeout(r, 0));
    // 断言：表格有一行，且名称/页码/位置显示正确
    // 同时确认已发布 DATA.LOADED 事件
    expect(bus.__emitted.includes(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED)).toBe(true);
    const rows = root.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr");
    expect(rows.length).toBe(1);
    const tds = rows[0].querySelectorAll("td");
    expect(tds[0].textContent).toBe("E2E-锚点");
    expect(tds[1].textContent).toBe("1");
    expect(tds[2].textContent).toBe("35");

    // dataset.anchorId 应存在且符合前缀
    const id = rows[0].dataset.anchorId;
    expect(typeof id).toBe("string");
    expect(id.startsWith("pdfanchor-")).toBe(true);
  });

  test("删除选中锚点应恢复空态提示", async () => {
    // 先添加一条
    bus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor: { uuid: "pdfanchor-aaaaaaaaaaaa", name: "A", page_at: 1, position: 10 } }, { actorId: "Jest" });
    const root = ui.getContentElement();
    // 等待事件循环一轮，确保列表渲染
    await new Promise((r) => setTimeout(r, 0));
    let rows = root.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr");
    expect(rows.length).toBe(1);
    // 选中第一条后点击“删除”
    rows[0].click();
    const delBtn = root.querySelector("button[data-action=\"delete\"]");
    expect(delBtn).toBeTruthy();
    delBtn.click();
    // 等待 UI 刷新
    await new Promise((r) => setTimeout(r, 0));
    // 断言空态出现
    const empty = root.querySelector(".anchor-empty");
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain("暂无锚点");
  });
});

