import { TextLayerManager } from "../text-layer-manager.js";

const createSelectionMock = (text) => ({
  rangeCount: 1,
  toString: () => text,
  getRangeAt: () => ({
    getClientRects: () => []
  })
});

const dispatchSelectionChange = () => {
  document.dispatchEvent(new Event("selectionchange"));
};

describe("TextLayerManager 选择事件绑定", () => {
  let originalGetSelection;
  let addSpy;
  let removeSpy;

  beforeAll(() => {
    originalGetSelection = window.getSelection;
  });

  beforeEach(() => {
    addSpy = jest.spyOn(document, "addEventListener");
    removeSpy = jest.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    window.getSelection = originalGetSelection;
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test("替换容器后仅在当前容器触发 selectionchanged", () => {
    const containerA = document.createElement("div");
    const containerB = document.createElement("div");
    const manager = new TextLayerManager({ container: containerA });
    const handlerA = jest.fn();
    const handlerB = jest.fn();
    containerA.addEventListener("selectionchanged", handlerA);
    containerB.addEventListener("selectionchanged", handlerB);

    window.getSelection = jest.fn(() => createSelectionMock("from-a"));
    dispatchSelectionChange();
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();

    handlerA.mockReset();
    manager.setContainer(containerB);
    window.getSelection = jest.fn(() => createSelectionMock("from-b"));
    dispatchSelectionChange();
    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerB.mock.calls[0][0].detail.text).toBe("from-b");

    manager.destroy();
  });

  test("destroy 会移除 document 上的 selectionchange 监听", () => {
    const container = document.createElement("div");
    const manager = new TextLayerManager({ container });
    const handler = jest.fn();
    container.addEventListener("selectionchanged", handler);

    window.getSelection = jest.fn(() => createSelectionMock("before destroy"));
    dispatchSelectionChange();
    expect(handler).toHaveBeenCalledTimes(1);

    handler.mockReset();
    manager.destroy();

    window.getSelection = jest.fn(() => createSelectionMock("after destroy"));
    dispatchSelectionChange();
    expect(handler).not.toHaveBeenCalled();
  });

  test("不允许多实例并存：第二次 new 必须 throw，destroy 后允许再次创建", () => {
    const containerA = document.createElement("div");
    const containerB = document.createElement("div");

    const manager = new TextLayerManager({ container: containerA });

    const selectionAdds = addSpy.mock.calls.filter(([evt]) => evt === "selectionchange");
    expect(selectionAdds.length).toBe(1);

    expect(() => new TextLayerManager({ container: containerB })).toThrow(/TextLayerManager/i);

    manager.destroy();
    const selectionRemoves = removeSpy.mock.calls.filter(([evt]) => evt === "selectionchange");
    expect(selectionRemoves.length).toBe(1);

    const manager2 = new TextLayerManager({ container: containerB });
    manager2.destroy();
  });
});
