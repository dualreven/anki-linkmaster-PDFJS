/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：首次安装 SidebarManagerFeature 时不应自动弹出任何侧边栏
 */

import globalEventBus from "../../../../common/event/event-bus.js";
import { SidebarManagerFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("SidebarManagerFeature - 安装时不自动打开侧边栏", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<main><div id=\"viewerContainer\"></div></main>";
    // 清理本地存储对宽度偏好的影响
    try { localStorage.clear(); } catch {}
  });

  test("install 后不应存在任何已打开的 [data-sidebar-id] 面板", async () => {
    const container = createContainer({
      // 不提供任何侧栏UI（使用占位内容），仅验证“未自动打开”
      annotationSidebarUI: null,
      cardSidebarUI: null,
      translatorSidebarUI: null,
    });

    const feature = new SidebarManagerFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    const openedPanels = document.querySelectorAll("[data-sidebar-id]");
    expect(openedPanels.length).toBe(0);
  });
});

