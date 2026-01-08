import { AnchorSidebarUI } from "../anchor-sidebar-ui.js";
import { AnchorManager } from "../../services/anchor.manager.js";
import eventBus from "../../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

describe("AnchorSidebarUI", () => {
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
  });

  test("should render toolbar buttons 添加/删除/修改/复制/激活/取消激活", () => {
    const bar = document.querySelector(".anchor-toolbar");
    expect(bar).toBeTruthy();
    const titles = Array.from(bar.querySelectorAll("button")).map(b => b.title);
    expect(titles).toEqual([
      "添加锚点（名称/页码/位置）",
      "删除选中锚点",
      "修改选中锚点（名称/页码/位置）",
      "复制/拷贝选项",
      "跳转并激活选中锚点",
      "取消选中锚点的激活状态"
    ]);
  });

  test("点击取消激活按钮应发出 ANCHOR.ACTIVATE(active:false)", () => {
    const bar = document.querySelector(".anchor-toolbar");
    const buttons = Array.from(bar.querySelectorAll("button"));
    const deactivateBtn = buttons.find(b => (b.title || "").startsWith("取消选中锚点的激活状态"));
    expect(deactivateBtn).toBeTruthy();

    const anchors = [
      { uuid: "aaaaaaaaaaaa", name: "示例锚点", page_at: 3, is_active: true },
    ];
    anchorManager.applyLoadedAnchors(anchors);
    anchorManager.setActive("aaaaaaaaaaaa", true);

    const row = document.querySelector("tbody[data-role=\"anchor-tbody\"] tr");
    row.click();

    const emitted = [];
    const off = eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      (payload) => emitted.push(payload),
      { subscriberId: "test-listener" }
    );

    deactivateBtn.click();

    expect(emitted.some(e => e && e.anchorId === "aaaaaaaaaaaa" && e.active === false)).toBe(true);
    off?.();
  });

  test("should render table with columns 名称/页码/页内位置(%) /是否激活 and rows", () => {
    // emit anchors loaded
    const anchors = [
      { uuid: "aaaaaaaaaaaa", name: "示例锚点", page_at: 3, is_active: true },
      { uuid: "bbbbbbbbbbbb", name: "第二个", page_at: 10, is_active: false },
    ];
    anchorManager.applyLoadedAnchors(anchors);
    anchorManager.setActive("aaaaaaaaaaaa", true);

    const ths = Array.from(document.querySelectorAll("thead th")).map(th => th.textContent.trim());
    expect(ths).toEqual(["名称","页码","页内位置(%)","是否激活"]);

    const rows = Array.from(document.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr"));
    expect(rows.length).toBe(2);
    const firstName = rows[0].querySelector("td").textContent.trim();
    expect(firstName).toBe("示例锚点");
  });

  test("destroy 后 store 更新不应再驱动 UI", () => {
    const root = ui.getContentElement();
    anchorManager.applyLoadedAnchors([{ uuid: "cccccccccccc", name: "C", page_at: 1 }]);
    expect(root.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr").length).toBe(1);

    ui.destroy();
    anchorManager.applyLoadedAnchors([
      { uuid: "cccccccccccc", name: "C", page_at: 1 },
      { uuid: "dddddddddddd", name: "D", page_at: 2 },
    ]);
    expect(root.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr").length).toBe(1);
  });
});
