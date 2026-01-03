import { AnchorSidebarUI } from "../anchor-sidebar-ui.js";
import eventBus from "../../../../../common/event/event-bus.js";

describe("AnchorSidebarUI toolbar cleanup", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("destroy should remove document click listener added by toolbar", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";

    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const ui = new AnchorSidebarUI(eventBus);
    ui.initialize();
    document.getElementById("root").appendChild(ui.getContentElement());

    const addedClick = addSpy.mock.calls.find(([type]) => type === "click");
    expect(addedClick).toBeTruthy();
    const handler = addedClick[1];
    expect(typeof handler).toBe("function");

    ui.destroy();

    const removedSame = removeSpy.mock.calls.some(([type, fn]) => type === "click" && fn === handler);
    expect(removedSame).toBe(true);
  });
});

