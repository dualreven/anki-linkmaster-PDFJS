import { EventBus } from "../../common/event/event-bus.js";
import { createCardsEngine } from "../planner/cards-model.js";
import { createCardPlannerApp } from "../planner/app.js";

describe("new-card-scheduler bootstrap/lifecycle (I) - contract regression", () => {
  function setupDom() {
    document.body.innerHTML = `
      <div id="planner-layout-switcher"></div>
      <div id="planner-workspace"></div>
    `;
    return {
      root: document.getElementById("planner-workspace")
    };
  }

  test("main entry can be imported with auto bootstrap disabled", async () => {
    const { root } = setupDom();
    globalThis.__NCS_DISABLE_AUTO_BOOTSTRAP__ = true;

    const mod = await import("../main.js");
    expect(typeof mod.createPlannerEngineOrThrow).toBe("function");

    // import 不应自动挂载 UI（因为禁用 auto bootstrap）
    expect(root.childElementCount).toBe(0);

    delete globalThis.__NCS_DISABLE_AUTO_BOOTSTRAP__;
  });

  test("planner app returns dispose() and dispose is idempotent", () => {
    const { root } = setupDom();
    const engine = createCardsEngine();
    engine.createCardOrThrow();

    const wsClient = { send: jest.fn(), connect: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const notification = { showInfo: jest.fn(), showError: jest.fn() };

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      notification
    });

    expect(typeof app.destroy).toBe("undefined");
    expect(typeof app.dispose).toBe("function");

    // 已挂载：root 有内容
    expect(root.childElementCount).toBeGreaterThan(0);

    // destroy/dispose 生命周期：dispose 后 root 不残留
    expect(() => app.dispose()).not.toThrow();
    expect(root.innerHTML).toBe("");

    // 二次 dispose 不爆炸
    expect(() => app.dispose()).not.toThrow();
    expect(root.innerHTML).toBe("");

    eventBus.destroy();
  });

  test("mount -> dispose -> mount does not duplicate DOM", () => {
    const { root } = setupDom();
    const wsClient = { send: jest.fn(), connect: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };

    const mountOnce = () => {
      const engine = createCardsEngine();
      engine.createCardOrThrow();
      const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
      const app = createCardPlannerApp({
        root,
        engine,
        wsClient,
        eventBus,
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        notification
      });
      return { app, eventBus };
    };

    const first = mountOnce();
    const firstCount = root.childElementCount;
    expect(firstCount).toBeGreaterThan(0);
    first.app.dispose();
    first.eventBus.destroy();
    expect(root.innerHTML).toBe("");

    const second = mountOnce();
    const secondCount = root.childElementCount;
    expect(secondCount).toBeGreaterThan(0);
    expect(secondCount).toBe(firstCount);
    second.app.dispose();
    second.eventBus.destroy();
    expect(root.innerHTML).toBe("");
  });
});

