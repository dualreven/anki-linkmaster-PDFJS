/**
 * @jest-environment jsdom
 */
// 必须先 mock，避免被 logger.js 的 import.meta 解析影响
jest.mock("../../../../../common/utils/logger.js", () => {
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLevel: jest.fn(),
  };
  return {
    getLogger: () => mockLogger,
    setModuleLogLevel: jest.fn(),
    LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
  };
});

import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";
import { getLogger } from "../../../../../common/utils/logger.js";
import { ObservableState } from "../../../../../common/utils/observable.js";

class StubEventBus {
  on() { return () => {}; }
  onGlobal() { return () => {}; }
  emit() {}
  emitGlobal() {}
}

test("点击无 data-annotation-id 的跳转按钮应记录错误日志（toast）", () => {
  const bus = new StubEventBus();
  const store = new ObservableState({ annotations: [] }, { name: "TestAnnotationStore" });
  const ui = new AnnotationSidebarUI(bus, { annotationManager: { store } });

  // 获取logger实例并监视error方法
  const logger = getLogger("AnnotationSidebarUI");
  const errorSpy = jest.spyOn(logger, "error");

  ui.initialize();
  // 将容器附加到DOM以便事件委托正常工作
  document.body.appendChild(ui.getContentElement());

  // 在内容容器中插入一个缺少 data-annotation-id 的跳转按钮
  const root = ui.getContentElement();
  const content = root.querySelector(".annotation-sidebar-content");
  const btn = document.createElement("button");
  btn.className = "jump-btn";
  content.appendChild(btn);

  // 触发点击事件
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  // 期望记录错误日志（logger.error 被调用）
  expect(errorSpy).toHaveBeenCalled();
  errorSpy.mockRestore();
  // 清理
  document.body.removeChild(ui.getContentElement());
});
