import { EventBus } from "../../common/event/event-bus.js";

import { createNewCardSchedulerAppOrThrow } from "../main.js";

function setupDom() {
  document.body.innerHTML = `
    <div class="app-root new-card-scheduler-root">
      <header class="pdf-home-header">
        <div class="toolbar-controls">
          <div id="window-controls-slot"></div>
        </div>
      </header>
      <main class="pdf-home-main">
        <aside class="sidebar" id="planner-sidebar">
          <div id="planner-layout-switcher"></div>
        </aside>
        <div class="main-content">
          <div id="planner-workspace"></div>
        </div>
      </main>
    </div>
  `;
}

describe("new-card-scheduler main export (H) - contract regression", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("createNewCardSchedulerAppOrThrow: 导出存在且可 destroy", async () => {
    setupDom();
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const app = await createNewCardSchedulerAppOrThrow({
      rootEl: document,
      clientId: "new-card-scheduler",
      wsUrl: "ws://localhost:8765",
      eventBus,
      wsClient: { send: jest.fn(), connect: jest.fn().mockResolvedValue(undefined), disconnect: jest.fn().mockResolvedValue(undefined), isConnected: () => false },
      engine: { getState: () => ({ draftCardTempIds: [], selectedTempId: null }), getCardsForView: () => [], getDraftCardsSnapshotOrThrow: () => [], toFinalCards: () => [] },
      notification: { showInfo: jest.fn(), showError: jest.fn() },
      autoConnect: false,
      mountControls: false,
      mountSidebar: false,
      mountPlanner: false,
      installRegistration: false,
    });

    expect(app).toBeTruthy();
    expect(typeof app.destroy).toBe("function");
    await expect(app.destroy()).resolves.toBeUndefined();

    eventBus.destroy();
  });
});
