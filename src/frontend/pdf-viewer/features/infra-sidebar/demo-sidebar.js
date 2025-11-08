/**
 * 演示侧边栏 - 用于测试SidebarManager功能
 * @file demo-sidebar.js
 */

import { getLogger } from "../../../common/utils/logger.js";
import { createSidebarConfig } from "./sidebar-config.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
const logger = getLogger("DemoSidebar");

/**
 * 创建测试侧边栏1的配置
 * @param {EventBus} eventBus - 事件总线
 * @returns {SidebarConfig}
 */
export function createDemoSidebar1(eventBus) {
  return createSidebarConfig({
    id: "demo-sidebar-1",
    title: "测试侧边栏 1",
    priority: 100,
    defaultWidth: 300,
    resizable: true,
    contentRenderer: () => {
      const content = document.createElement("div");
      content.style.cssText = "padding: 20px; color: #333;";

      content.innerHTML = `
                <h3 style="margin-top:0;color:#2196f3;">演示侧边栏 1</h3>
                <p>这是第一个演示侧边栏，用于测试 SidebarManager 的功能。</p>
                <ul style="line-height: 1.8;">
                    <li>✅ 支持宽度调整</li>
                    <li>✅ 支持关闭按钮</li>
                    <li>✅ 支持多侧边栏布局</li>
                </ul>
                <button id="demo-open-sidebar-2" style="
                    padding: 8px 16px;
                    background: #4caf50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 12px;
                ">打开测试侧边栏 2</button>
            `;

      // 添加按钮事件
      setTimeout(() => {
        const btn = content.querySelector("#demo-open-sidebar-2");
        if (btn) {
          btn.addEventListener("click", () => {
            logger.info("Opening demo sidebar 2");
            eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED, {
              sidebarId: "demo-sidebar-2"
            }, { actorId: "DemoSidebar1" });
          });
        }
      }, 0);

      return content;
    }
  });
}

/**
 * 创建测试侧边栏2的配置
 * @param {EventBus} eventBus - 事件总线
 * @returns {SidebarConfig}
 */
export function createDemoSidebar2(eventBus) {
  return createSidebarConfig({
    id: "demo-sidebar-2",
    title: "测试侧边栏 2",
    priority: 200,
    defaultWidth: 350,
    resizable: true,
    contentRenderer: () => {
      const content = document.createElement("div");
      content.style.cssText = "padding: 20px; background: #f5f5f5; color: #333; height: 100%;";

      content.innerHTML = `
                <h3 style="margin-top:0;color:#ff5722;">演示侧边栏 2</h3>
                <p>这是第二个演示侧边栏，可以与第一个同时显示。</p>
                <div style="
                    background: white;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 15px 0;
                    border-left: 4px solid #ff5722;
                ">
                    <strong>提示：</strong>
                    <br/>尝试拖动右侧边缘调整宽度！
                </div>
                <div style="margin-top: 20px;">
                    <p><strong>功能演示：</strong></p>
                    <ol style="line-height: 1.8;">
                        <li>多侧边栏同时打开</li>
                        <li>左向流式布局</li>
                        <li>独立宽度调整</li>
                        <li>宽度偏好持久化</li>
                    </ol>
                </div>
            `;

      return content;
    }
  });
}

/**
 * 注册演示侧边栏到SidebarManager
 * @param {SidebarManagerFeature} sidebarManager - 侧边栏管理器
 * @param {EventBus} eventBus - 事件总线
 */
export function registerDemoSidebars(sidebarManager, eventBus) {
  try {
    const sidebar1 = createDemoSidebar1(eventBus);
    const sidebar2 = createDemoSidebar2(eventBus);

    sidebarManager.registerSidebar(sidebar1);
    sidebarManager.registerSidebar(sidebar2);

    logger.info("Demo sidebars registered successfully");
  } catch (error) {
    logger.error("Failed to register demo sidebars:", error);
  }
}

/**
 * 创建演示按钮
 * @param {EventBus} eventBus - 事件总线
 */
export function createDemoButtons(eventBus) {
  const buttonContainer = document.getElementById("pdf-viewer-button-container");
  if (!buttonContainer) {
    logger.warn("Button container not found");
    return;
  }

  // 创建测试按钮1
  const demoBtn1 = document.createElement("button");
  demoBtn1.id = "demo-sidebar-1-toggle";
  demoBtn1.textContent = "📝 测试1";
  demoBtn1.className = "btn";
  demoBtn1.title = "打开测试侧边栏 1";
  demoBtn1.addEventListener("click", () => {
    eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED, {
      sidebarId: "demo-sidebar-1"
    }, { actorId: "DemoButton" });
  });

  // 创建测试按钮2
  const demoBtn2 = document.createElement("button");
  demoBtn2.id = "demo-sidebar-2-toggle";
  demoBtn2.textContent = "📌 测试2";
  demoBtn2.className = "btn";
  demoBtn2.title = "打开测试侧边栏 2";
  demoBtn2.addEventListener("click", () => {
    eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED, {
      sidebarId: "demo-sidebar-2"
    }, { actorId: "DemoButton" });
  });

  buttonContainer.appendChild(demoBtn1);
  buttonContainer.appendChild(demoBtn2);

  logger.info("Demo buttons created");
}
