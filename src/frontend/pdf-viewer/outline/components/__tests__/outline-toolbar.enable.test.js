/**
 * @file 回归测试：选中大纲后，OutlineToolbar 的“编辑/删除”按钮应启用
 */
import eventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { OutlineToolbar } from "../outline-toolbar.js";

describe("OutlineToolbar — 选中后按钮状态", () => {
  let toolbar;
  let container;

  beforeEach(() => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    container = document.getElementById("root");
    toolbar = new OutlineToolbar({ eventBus });
    toolbar.initialize();
    container.appendChild(toolbar.getElement());
  });

  test("初始状态下编辑/删除为禁用", () => {
    const delBtn = container.querySelector(".outline-btn-delete");
    const editBtn = container.querySelector(".outline-btn-edit");
    expect(delBtn).toBeTruthy();
    expect(editBtn).toBeTruthy();
    expect(delBtn.disabled).toBe(true);
    expect(editBtn.disabled).toBe(true);
  });

  test("收到 OUTLINE.SELECT.CHANGED 后启用编辑/删除", () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
      { outlineItemId: "outlineItem-123", outlineItem: { id: "outlineItem-123", name: "章节1" } },
      { actorId: "test" }
    );
    const delBtn = container.querySelector(".outline-btn-delete");
    const editBtn = container.querySelector(".outline-btn-edit");
    expect(delBtn.disabled).toBe(false);
    expect(editBtn.disabled).toBe(false);
  });
});

