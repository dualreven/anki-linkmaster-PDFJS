import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { setupGlobalSearchShortcut } from "../search-shortcut/index.js";

describe("SearchShortcutHelper", () => {
  beforeEach(() => {
    // 清理可能残留的监听（防止测试间相互影响）
    // 这里不强制移除所有监听，仅依赖每次调用返回的 disposer。
  });

  it("在 Ctrl+F 时应调用 onOpen 回调", () => {
    const onOpen = jest.fn();
    const disposer = setupGlobalSearchShortcut({ onOpen });

    const evt = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(evt);

    expect(onOpen).toHaveBeenCalledTimes(1);
    disposer();
  });

  it("在调用 disposer 后不再触发 onOpen", () => {
    const onOpen = jest.fn();
    const disposer = setupGlobalSearchShortcut({ onOpen });

    disposer();

    const evt = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(evt);

    expect(onOpen).not.toHaveBeenCalled();
  });
});

