// 必须先 mock，避免被 logger.js 的 import.meta 解析影响
jest.mock("../../../common/utils/logger.js", () => {
  return {
    getLogger: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  };
});

import { KeyboardHandler } from "../keyboard-handler.js";

describe("KeyboardHandler leak guard", () => {
  let addSpy;
  let removeSpy;

  beforeEach(() => {
    addSpy = jest.spyOn(document, "addEventListener");
    removeSpy = jest.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  function createBus() {
    return { emit: jest.fn(() => true), emitGlobal: jest.fn(() => true), on: jest.fn(() => () => {}), onGlobal: jest.fn(() => () => {}) };
  }

  test("重复 setupEventListener（无 DomEventHub）不应重复注册 document keydown", () => {
    const handler = new KeyboardHandler(createBus());
    handler.setupEventListener();
    handler.setupEventListener();

    const keydownAdds = addSpy.mock.calls.filter(([evt]) => evt === "keydown");
    expect(keydownAdds.length).toBe(1);

    handler.destroy();
    const keydownRemoves = removeSpy.mock.calls.filter(([evt]) => evt === "keydown");
    expect(keydownRemoves.length).toBe(1);
  });

  test("从 document 模式切换到 DomEventHub 模式应移除旧 document 监听，且重复 setup 幂等", () => {
    const handler = new KeyboardHandler(createBus());
    handler.setupEventListener(); // document

    const unsub = jest.fn();
    const domEventHub = { onDocumentKeydown: jest.fn(() => unsub) };
    handler.setupEventListener(domEventHub); // switch to hub
    handler.setupEventListener(domEventHub); // idempotent

    // document 监听：只 add 1 次；切换到 hub 时 remove 1 次
    const keydownAdds = addSpy.mock.calls.filter(([evt]) => evt === "keydown");
    const keydownRemoves = removeSpy.mock.calls.filter(([evt]) => evt === "keydown");
    expect(keydownAdds.length).toBe(1);
    expect(keydownRemoves.length).toBe(1);

    // hub 监听：只注册 1 次（第二次 setup 不应重复注册）
    expect(domEventHub.onDocumentKeydown).toHaveBeenCalledTimes(1);

    handler.destroy();
    expect(unsub).toHaveBeenCalledTimes(1);

    // destroy 不应再额外 remove document（已经在切换时清理）
    const keydownRemovesAfterDestroy = removeSpy.mock.calls.filter(([evt]) => evt === "keydown");
    expect(keydownRemovesAfterDestroy.length).toBe(1);
  });

  test("destroy 后触发 keydown 不应再 emit", () => {
    const bus = createBus();
    const handler = new KeyboardHandler(bus);
    handler.setupEventListener(); // document

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(bus.emit).toHaveBeenCalledTimes(1);

    handler.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(bus.emit).toHaveBeenCalledTimes(1);
  });
});
