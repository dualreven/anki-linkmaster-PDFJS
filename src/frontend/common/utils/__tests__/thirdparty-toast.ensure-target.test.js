// utf-8
/**
 * 防回归测试：确保 thirdparty-toast 的容器 target 为“DOM 元素”且不会因 null.style 导致异常
 */
import { success, info, error, pending, dismissById } from "../../utils/thirdparty-toast.js";

describe("thirdparty-toast ensureIziTarget", () => {
  test("should not throw when showing toasts and container is created automatically", () => {
    // 清理环境
    const exist = document.getElementById("izi-toast-root");
    if (exist) {
      exist.remove();
    }

    // 依次调用，确保不因 target=null 而抛出
    expect(() => {
      success("ok", 10);
      info("ok", 10);
      error("ok", 10);
    }).not.toThrow();

    // pending -> dismissById
    expect(() => {
      const id = pending("test-id", "doing", 10);
      dismissById(id);
    }).not.toThrow();

    // 容器应存在
    expect(document.getElementById("izi-toast-root")).toBeTruthy();
  });
});
