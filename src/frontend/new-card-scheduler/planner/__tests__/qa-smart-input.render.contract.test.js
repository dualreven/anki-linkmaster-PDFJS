import { createCardsEngine } from "../cards-model.js";
import { createPlannerWorkspaceUI } from "../ui/workspace.js";

describe("card-planner qa smart input (F) - render contract", () => {
  test("渲染时：[[ann_id]] 会以高亮 token 形式出现", () => {
    document.body.innerHTML = `<div id="planner-workspace"></div>`;

    const engine = createCardsEngine();
    const tempId = engine.createEmptyCardOrThrow();
    engine.dispatchIngest({
      op: { kind: "all-to-one", target: { kind: "card-id", tempId }, face: "Q" },
      annotationIds: ["ann_1"]
    });

    const root = document.getElementById("planner-workspace");
    const ui = createPlannerWorkspaceUI({
      root,
      engine,
      getCardMetaPreview: () => ({ Q: [], A: [] }),
      notification: { showInfo: jest.fn(), showError: jest.fn() }
    });

    const row = root.querySelector(`[data-temp-id="${tempId}"]`);
    expect(row).toBeTruthy();

    const qTextarea = row.querySelector("[data-testid='qa-smart-textarea-Q']");
    expect(qTextarea).toBeTruthy();
    expect(qTextarea.value).toContain("[[ann_1]]");

    const tokenEl = row.querySelector('[data-anno-id="ann_1"]');
    expect(tokenEl).toBeTruthy();
    expect(tokenEl.textContent).toBe("[[ann_1]]");

    ui.dispose();
    document.body.innerHTML = "";
  });
});

