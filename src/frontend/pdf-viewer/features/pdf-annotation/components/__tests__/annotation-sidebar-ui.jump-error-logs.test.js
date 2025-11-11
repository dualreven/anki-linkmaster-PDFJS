/**
 * @jest-environment jsdom
 */
import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";

class StubEventBus {
  on() { return () => {}; }
  emit() {}
  emitGlobal() {}
}

test("点击无 data-annotation-id 的跳转按钮应记录错误日志（toast）", () => {
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const bus = new StubEventBus();
  const ui = new AnnotationSidebarUI(bus);
  ui.initialize();

  // 在内容容器中插入一个缺少 data-annotation-id 的跳转按钮
  const root = ui.getContentElement();
  const content = root.querySelector(".annotation-sidebar-content");
  const btn = document.createElement("button");
  btn.className = "jump-btn";
  content.appendChild(btn);

  // 触发点击事件
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  // 期望记录错误日志（logger.error → console.error）
  expect(errorSpy).toHaveBeenCalled();
  errorSpy.mockRestore();
});

