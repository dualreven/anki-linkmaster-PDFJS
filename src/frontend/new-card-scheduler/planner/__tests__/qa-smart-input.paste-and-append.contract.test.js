import { createCardsEngine } from "../cards-model.js";
import { createPlannerWorkspaceUI } from "../ui/workspace.js";
import { installPasteWiring } from "../wiring/paste-wiring.js";

function createClipboardData(text) {
  return {
    getData: (type) => (type === "text/plain" ? text : "")
  };
}

describe("card-planner qa smart input (F) - paste append contract", () => {
  test("粘贴：支持空格/换行/[[token]]，并末尾追加到目标面且显示为 [[id]]", async () => {
    document.body.innerHTML = `<div id="planner-workspace"></div>`;

    const engine = createCardsEngine();
    const tempId = engine.createEmptyCardOrThrow();

    const root = document.getElementById("planner-workspace");
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const ui = createPlannerWorkspaceUI({
      root,
      engine,
      getCardMetaPreview: () => ({ Q: [], A: [] }),
      notification
    });

    const uninstallPaste = installPasteWiring({
      engine,
      getPasteFocus: () => ui.getPasteFocus(),
      render: () => ui.render(),
      notification
    });

    const row = root.querySelector(`[data-temp-id="${tempId}"]`);
    const qTextarea = row.querySelector("[data-testid='qa-smart-textarea-Q']");
    expect(qTextarea).toBeTruthy();

    qTextarea.focus();

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: createClipboardData("ann_1 ann_2\n[[ann_3]]")
    });
    document.dispatchEvent(paste);

    // 等待可能的微任务（当前实现无异步，但保持稳定）
    await new Promise((r) => setTimeout(r, 0));

    const snapshot = engine.getDraftCardsSnapshotOrThrow();
    const card = snapshot.find((c) => c.tempId === tempId);
    expect(card).toBeTruthy();
    expect(card.Q).toEqual(["ann_1", "ann_2", "ann_3"]);

    const afterRow = root.querySelector(`[data-temp-id="${tempId}"]`);
    const afterQ = afterRow.querySelector("[data-testid='qa-smart-textarea-Q']");
    expect(afterQ.value).toContain("[[ann_1]]");
    expect(afterQ.value).toContain("[[ann_3]]");

    uninstallPaste();
    ui.dispose();
    document.body.innerHTML = "";
  });
});

