/**
 * 目的：验证 OutlineDialog 交互（添加/编辑/删除）在 jsdom 下的行为
 * - 输入校验（名称、页码必填）
 * - onConfirm/onCancel 触发与关闭 overlay
 */
import OutlineDialog from "../outline-dialog.js";

function clickButtonByText(root, text) {
  const btns = root.querySelectorAll("button");
  for (const b of btns) {
    if ((b.textContent || "").trim() === text) {
      b.click();
      return true;
    }
  }
  return false;
}

describe("OutlineDialog 行为", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("showAdd：无效输入阻止提交，填写后触发 onConfirm", () => {
    const dialog = new OutlineDialog();
    const calls = [];
    dialog.showAdd({
      currentPage: 3,
      onConfirm: (data) => calls.push({ type: "confirm", data }),
      onCancel: () => calls.push({ type: "cancel" })
    });
    const overlay = document.body.lastElementChild;
    expect(overlay).not.toBeNull();
    // 置空名称 → 点击“添加”应提示错误且不关闭
    const name = overlay.querySelector("#outline-name");
    const page = overlay.querySelector("#outline-page");
    name.value = "";
    page.value = "0";
    expect(clickButtonByText(overlay, "添加")).toBe(true);
    expect(calls.length).toBe(0);
    // 填写有效值 → 再次点击“添加”
    name.value = "Title";
    page.value = "5";
    const pos = overlay.querySelector("#outline-position");
    pos.value = "120"; // 将被 clamped 为 100
    expect(clickButtonByText(overlay, "添加")).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].data).toEqual({ name: "Title", pageAt: 5, position: 100 });
    // 关闭后 overlay 被移除
    expect(document.body.lastElementChild).not.toBe(overlay);
  });

  test("showEdit：修改并保存触发 onConfirm", () => {
    const dialog = new OutlineDialog();
    const calls = [];
    dialog.showEdit({
      outlineItem: { name: "Old", pageAt: 7, position: null },
      onConfirm: (data) => calls.push(data),
    });
    const overlay = document.body.lastElementChild;
    const name = overlay.querySelector("#outline-name");
    const page = overlay.querySelector("#outline-page");
    const pos = overlay.querySelector("#outline-position");
    name.value = " New ";
    page.value = "9";
    pos.value = "0";
    expect(clickButtonByText(overlay, "保存")).toBe(true);
    expect(calls[0]).toEqual({ name: "New", pageAt: 9, position: 0 });
  });

  test("showDelete：点击删除调用 onConfirm(true) 并关闭", () => {
    const dialog = new OutlineDialog();
    const calls = [];
    dialog.showDelete({
      outlineItem: { name: "X" },
      childCount: 2,
      onConfirm: (cascade) => calls.push(cascade),
    });
    const overlay = document.body.lastElementChild;
    expect(clickButtonByText(overlay, "删除")).toBe(true);
    expect(calls).toEqual([true]);
    // overlay 被移除
    expect(document.body.lastElementChild).not.toBe(overlay);
  });
});

