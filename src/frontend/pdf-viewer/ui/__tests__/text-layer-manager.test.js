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

  beforeAll(() => {
    originalGetSelection = window.getSelection;
  });

  afterEach(() => {
    window.getSelection = originalGetSelection;
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
});
