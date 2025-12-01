/**
 * WindowControlsFeature（pdf-home）安装行为测试
 * 目标：验证 install 时会从 DI 容器中获取 wsClient 并传递给 WindowControlsComponent，
 *      保证关闭按钮具备触发注销的能力。
 */

import { describe, it, expect, jest } from "@jest/globals";
import { WindowControlsFeature } from "../../../../common/features/window-controls/index.js";

const constructedOptions = [];

// Mock 公共窗口控制组件，仅记录构造参数并提供空的 mount/destroy
jest.mock("../../../../common/components/window-controls/window-controls.js", () => {
  const ctor = jest.fn().mockImplementation((options) => {
    constructedOptions.push(options);
    return {
      mount: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn()
    };
  });
  return { WindowControlsComponent: ctor, __esModule: true };
});

describe("WindowControlsFeature (pdf-home)", () => {
  it("install 时应将 wsClient 从容器传递给 WindowControlsComponent", async () => {
    const feature = new WindowControlsFeature({
      bridgeName: "pyqtBridge",
      containerSelector: ".toolbar-controls"
    });
    const fakeWsClient = { disconnect: jest.fn() };

    const context = {
      container: {
        get(name) {
          if (name === "wsClient") {
            return fakeWsClient;
          }
          throw new Error(`Unexpected service: ${name}`);
        }
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };

    // 准备 DOM：提供 toolbar 容器并模拟文档已就绪
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true
    });

    await feature.install(context);

    expect(constructedOptions.length).toBeGreaterThan(0);
    expect(constructedOptions[0].wsClient).toBe(fakeWsClient);
  });
});

