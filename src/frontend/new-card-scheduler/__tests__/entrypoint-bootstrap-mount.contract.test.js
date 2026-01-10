jest.mock("../bootstrap/app-bootstrap-feature.js", () => {
  return {
    __esModule: true,
    bootstrapNewCardSchedulerAppFeature: jest.fn(async (options = {}) => {
      const doc = globalThis.document;
      const rootEl = options.rootEl || doc.getElementById("planner-workspace");
      if (!rootEl) {
        throw new Error("missing #planner-workspace");
      }
      const marker = doc.createElement("div");
      marker.setAttribute("data-test", "mounted-by-bootstrap");
      rootEl.appendChild(marker);
      return { destroy: jest.fn() };
    }),
  };
});

describe("new-card-scheduler entrypoint bootstrap mount (F) - contract regression", () => {
  test("import index.js 会调用 bootstrap 并 mount 到 #planner-workspace", async () => {
    document.body.innerHTML = `
      <div class="toolbar-controls"><div id="window-controls-slot"></div></div>
      <aside id="planner-sidebar" class="sidebar"></aside>
      <div class="main-content"></div>
      <div id="planner-workspace"></div>
      <div id="izi-toast-root"></div>
    `;

    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });

    await import("../index.js");
    await new Promise((r) => setTimeout(r, 0));

    const root = document.getElementById("planner-workspace");
    expect(root).toBeTruthy();
    expect(root.childElementCount).toBeGreaterThan(0);
    expect(root.querySelector("[data-test=\"mounted-by-bootstrap\"]")).toBeTruthy();
  });
});
