/* @jest-environment jsdom */
/**
 * 回归目标：
 * - 拖拽开始（mousedown）后，如果立刻 destroy，也必须清理 document mousemove/mouseup 监听。
 */

import { DraggableResizer } from "../draggable-resizer.js";

describe("DraggableResizer cleanup", () => {
  test("destroy during dragging should remove document listeners", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const handle = document.createElement("div");
    document.body.appendChild(handle);

    const onWidth = jest.fn();
    const resizer = new DraggableResizer({
      handle,
      getWidth: () => 100,
      onWidth,
    });

    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, bubbles: true }));

    const mousemoveHandler = addSpy.mock.calls.find((c) => c[0] === "mousemove")?.[1];
    const mouseupHandler = addSpy.mock.calls.find((c) => c[0] === "mouseup")?.[1];
    expect(typeof mousemoveHandler).toBe("function");
    expect(typeof mouseupHandler).toBe("function");

    resizer.destroy();

    expect(removeSpy).toHaveBeenCalledWith("mousemove", mousemoveHandler);
    expect(removeSpy).toHaveBeenCalledWith("mouseup", mouseupHandler);
  });
});

