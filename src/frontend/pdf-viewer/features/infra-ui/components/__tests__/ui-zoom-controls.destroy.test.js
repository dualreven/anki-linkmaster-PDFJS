import { UIZoomControls } from "../ui-zoom-controls.js";

function mountZoomControlsDOM() {
  document.body.innerHTML = `
    <div id="floating-controls" class="floating-controls">
      <div class="zoom-controls">
        <button id="zoom-out" class="btn">-</button>
        <span id="zoom-level">100%</span>
        <button id="zoom-in" class="btn">+</button>
      </div>
      <div class="page-controls">
        <button id="prev-page" class="btn">←</button>
        <input type="number" id="page-input" class="page-input" min="1" value="1" />
        <span id="page-total">/ 1</span>
        <button id="next-page" class="btn">→</button>
      </div>
      <div>
        <span id="page-info">1 / 1</span>
      </div>
    </div>
  `;
}

function createMockZoomManager() {
  const state = {
    scale: 1.0,
    minScale: 0.5,
    maxScale: 3.0,
    step: 0.1,
  };

  const store = {
    get: jest.fn(() => state),
    subscribe: jest.fn((arg1, arg2, arg3) => {
      const unsub = jest.fn();

      if (typeof arg2 === "function") {
        const selector = arg1;
        const onSelectedChange = arg2;
        const opts = arg3 || {};
        if (opts.fireImmediately) {
          onSelectedChange(selector(state));
        }
        return unsub;
      }

      const onStateChange = arg1;
      const opts = arg2 || {};
      if (opts.fireImmediately) {
        onStateChange(state, null);
      }
      return unsub;
    }),
  };

  return { store };
}

describe("UIZoomControls.destroy()", () => {
  beforeEach(() => {
    mountZoomControlsDOM();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("destroy() 会用同一 handler 引用解绑所有 DOM listener", async () => {
    const eventBus = { emit: jest.fn() };
    const zoomManager = createMockZoomManager();
    const ui = new UIZoomControls(eventBus, zoomManager);

    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    const prevPageBtn = document.getElementById("prev-page");
    const nextPageBtn = document.getElementById("next-page");
    const pageInput = document.getElementById("page-input");

    const spies = [
      [zoomInBtn, jest.spyOn(zoomInBtn, "addEventListener"), jest.spyOn(zoomInBtn, "removeEventListener")],
      [zoomOutBtn, jest.spyOn(zoomOutBtn, "addEventListener"), jest.spyOn(zoomOutBtn, "removeEventListener")],
      [prevPageBtn, jest.spyOn(prevPageBtn, "addEventListener"), jest.spyOn(prevPageBtn, "removeEventListener")],
      [nextPageBtn, jest.spyOn(nextPageBtn, "addEventListener"), jest.spyOn(nextPageBtn, "removeEventListener")],
      [pageInput, jest.spyOn(pageInput, "addEventListener"), jest.spyOn(pageInput, "removeEventListener")],
    ];

    await ui.setupZoomControls();

    const zoomInClick = spies[0][1].mock.calls.find((c) => c[0] === "click");
    const zoomOutClick = spies[1][1].mock.calls.find((c) => c[0] === "click");
    const prevClick = spies[2][1].mock.calls.find((c) => c[0] === "click");
    const nextClick = spies[3][1].mock.calls.find((c) => c[0] === "click");

    const pageKeydown = spies[4][1].mock.calls.find((c) => c[0] === "keydown");
    const pageBlur = spies[4][1].mock.calls.find((c) => c[0] === "blur");
    const pageChange = spies[4][1].mock.calls.find((c) => c[0] === "change");

    expect(zoomInClick).toBeDefined();
    expect(zoomOutClick).toBeDefined();
    expect(prevClick).toBeDefined();
    expect(nextClick).toBeDefined();

    expect(pageKeydown).toBeDefined();
    expect(pageBlur).toBeDefined();
    expect(pageChange).toBeDefined();

    const zoomInHandler = zoomInClick[1];
    const zoomOutHandler = zoomOutClick[1];
    const prevHandler = prevClick[1];
    const nextHandler = nextClick[1];
    const keydownHandler = pageKeydown[1];
    const blurHandler = pageBlur[1];
    const changeHandler = pageChange[1];

    ui.destroy();

    expect(spies[0][2].mock.calls.some((c) => c[0] === "click" && c[1] === zoomInHandler)).toBe(true);
    expect(spies[1][2].mock.calls.some((c) => c[0] === "click" && c[1] === zoomOutHandler)).toBe(true);
    expect(spies[2][2].mock.calls.some((c) => c[0] === "click" && c[1] === prevHandler)).toBe(true);
    expect(spies[3][2].mock.calls.some((c) => c[0] === "click" && c[1] === nextHandler)).toBe(true);

    expect(spies[4][2].mock.calls.some((c) => c[0] === "keydown" && c[1] === keydownHandler)).toBe(true);
    expect(spies[4][2].mock.calls.some((c) => c[0] === "blur" && c[1] === blurHandler)).toBe(true);
    expect(spies[4][2].mock.calls.some((c) => c[0] === "change" && c[1] === changeHandler)).toBe(true);
  });
});

