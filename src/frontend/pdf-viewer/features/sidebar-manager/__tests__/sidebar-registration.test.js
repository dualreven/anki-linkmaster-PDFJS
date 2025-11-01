/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：验证 SidebarManagerFeature 安装后，可以成功注册并打开若干核心侧边栏（anchor/bookmark/annotation），
 * 确保侧边栏装配行为不走样（不验证内部获取方式，以功能结果为准）。
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

describe("SidebarManagerFeature - 注册与打开侧边栏", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = `<main><div id="viewerContainer"></div></main>`;
  });

  test("能够打开 anchor / bookmark / annotation 侧边栏并渲染容器 DOM", async () => {
    const container = createContainer({
      // 提供可能使用到的可选 UI（缺失时应走占位渲染，不报错）
      annotationSidebarUI: {
        initialize: jest.fn(),
        getContentElement: () => {
          const el = document.createElement("div");
          el.textContent = "annotation";
          return el;
        },
      },
      cardSidebarUI: null,
      translatorSidebarUI: null,
    });

    const feature = new SidebarManagerFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    // 依次打开若干侧边栏
    feature.openSidebar("anchor");
    feature.openSidebar("bookmark");
    feature.openSidebar("annotation");

    // 断言：DOM 中存在相应侧栏面板
    const panels = document.querySelectorAll("[data-sidebar-id]");
    const ids = Array.from(panels).map((p) => p.getAttribute("data-sidebar-id"));
    expect(ids).toEqual(expect.arrayContaining(["anchor", "bookmark", "annotation"]));
  });
});
