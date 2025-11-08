/**
 * 回归测试：容器必须允许指针事件，保证 hover 暂停/关闭按钮可交互
 * 要点：
 * - 调用 info() 时应创建 #izi-toast-root 且 pointer-events 为 auto
 * - 不做视觉断言，仅断言 DOM 与样式前置条件，避免 flaky
 */

import { info } from "../thirdparty-toast.js";

describe("thirdparty-toast hover pause preconditions", () => {
  test("izi-toast-root container allows pointer events", () => {
    // jsdom 环境下不真正渲染动画，但可检测样式字符串
    document.body.innerHTML = "<div id='app'></div>";

    // 触发一次 info，以便 ensureIziTarget() 创建容器
    info("hover-pause-check", 0);

    const container = document.getElementById("izi-toast-root");
    expect(container).toBeTruthy();
    // 关键：必须是 auto，若为 none 会导致 hover/click 无效
    expect(container.style.pointerEvents).toBe("auto");
  });
});

