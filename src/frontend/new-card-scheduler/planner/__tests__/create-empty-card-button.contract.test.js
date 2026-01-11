import { EventBus } from "../../../common/event/event-bus.js";
import { createCardsEngine } from "../cards-model.js";
import { createCardPlannerApp } from "../app.js";

describe("card-planner create-empty-card button (H) - contract regression", () => {
  function setupDom() {
    document.body.innerHTML = `
      <div id="planner-layout-switcher"></div>
      <div id="planner-workspace"></div>
    `;
    return {
      root: document.getElementById("planner-workspace"),
      layout: document.getElementById("planner-layout-switcher"),
    };
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("layout-switcher 区域存在“创建空卡”；点击后新增草稿卡并选中，且 UI 刷新", () => {
    const { root, layout } = setupDom();
    const engine = createCardsEngine();
    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn() },
      notification
    });

    const btn = Array.from(layout.querySelectorAll("button")).find((b) => b.textContent === "创建空卡");
    expect(btn).toBeTruthy();

    expect(engine.getState().draftCardTempIds.length).toBe(0);
    expect(root.querySelectorAll("[data-temp-id]").length).toBe(0);

    btn.click();

    expect(engine.getState().draftCardTempIds.length).toBe(1);
    expect(engine.getState().selectedTempId).toBe(engine.getState().draftCardTempIds[0]);
    expect(root.querySelectorAll("[data-temp-id]").length).toBe(1);

    app.dispose();
    eventBus.destroy();
  });
});

