import { installPlannerSidebarControllerOrThrow } from "../planner/ui/planner-sidebar-controller.js";

function setupDom() {
  document.body.innerHTML = `
    <div class="app-root new-card-scheduler-root">
      <header class="pdf-home-header">
        <div class="toolbar-controls">
          <div id="window-controls-slot"></div>
          <button id="planner-sidebar-toggle-btn" type="button"></button>
        </div>
      </header>
      <main class="pdf-home-main">
        <aside class="sidebar" id="planner-sidebar"></aside>
        <div class="main-content"></div>
      </main>
    </div>
  `;

  const sidebarEl = document.querySelector("#planner-sidebar");
  const mainEl = document.querySelector(".main-content");
  const toolbarEl = document.querySelector(".toolbar-controls");
  const toggleBtn = document.querySelector("#planner-sidebar-toggle-btn");

  return { sidebarEl, mainEl, toolbarEl, toggleBtn };
}

describe("new-card-scheduler sidebar push layout (F) - contract regression", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("安装后默认展开：主区域被推开", () => {
    const { sidebarEl, mainEl, toolbarEl } = setupDom();
    const controller = installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl });

    expect(controller.isCollapsed()).toBe(false);
    expect(sidebarEl.classList.contains("collapsed")).toBe(false);
    expect(mainEl.style.marginLeft).toBe("280px");
    expect(mainEl.style.width).toBe("calc(100% - 280px)");

    controller.dispose();
  });

  test("点击一次：侧边栏收起，主区域恢复", () => {
    const { sidebarEl, mainEl, toolbarEl, toggleBtn } = setupDom();
    const controller = installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl });

    toggleBtn.click();

    expect(controller.isCollapsed()).toBe(true);
    expect(sidebarEl.classList.contains("collapsed")).toBe(true);
    expect(mainEl.style.marginLeft).toBe("");
    expect(mainEl.style.width).toBe("");

    controller.dispose();
  });

  test("再点击：展开并再次推开", () => {
    const { sidebarEl, mainEl, toolbarEl, toggleBtn } = setupDom();
    const controller = installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl });

    toggleBtn.click();
    toggleBtn.click();

    expect(controller.isCollapsed()).toBe(false);
    expect(sidebarEl.classList.contains("collapsed")).toBe(false);
    expect(mainEl.style.marginLeft).toBe("280px");
    expect(mainEl.style.width).toBe("calc(100% - 280px)");

    controller.dispose();
  });

  test("dispose 后：再点击不再改动布局", () => {
    const { sidebarEl, mainEl, toolbarEl, toggleBtn } = setupDom();
    const controller = installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl });

    controller.dispose();

    const before = {
      collapsed: sidebarEl.classList.contains("collapsed"),
      marginLeft: mainEl.style.marginLeft,
      width: mainEl.style.width
    };

    toggleBtn.click();

    expect(sidebarEl.classList.contains("collapsed")).toBe(before.collapsed);
    expect(mainEl.style.marginLeft).toBe(before.marginLeft);
    expect(mainEl.style.width).toBe(before.width);
  });
});

