/**
 * @file 窗口控制功能域
 * @module WindowControlsFeature
 * @description 管理自定义窗口控制按钮(最小化、最大化、关闭),使用公共窗口控制组件
 */

import { getLogger } from "../../../common/utils/logger.js";
import { WindowControlsComponent } from "../../../common/components/window-controls/window-controls.js";

const logger = getLogger("WindowControlsFeature");

/**
 * 窗口控制功能域
 * @class WindowControlsFeature
 * @implements {IFeature}
 */
export class WindowControlsFeature {
  #windowControls = null;

  /** 功能名称 */
  get name() {
    return "window-controls";
  }

  /** 版本号 */
  get version() {
    return "2.0.0";  // 升级到2.0.0，使用公共组件
  }

  /** 依赖的功能 */
  get dependencies() {
    return ["infra-app"]; // 依赖 infra-app 以获取 wsClient
  }

  /**
   * 安装功能
   * @param {FeatureContext} context - 功能上下文
   * @throws {Error} 如果无法获取必需的 wsClient 或 appContext
   */
  async install(context) {
    const { container, logger: contextLogger } = context;

    logger.info("Installing WindowControlsFeature...");

    // 严格模式：必须获取 wsClient
    const wsClient = container.get("wsClient");
    if (!wsClient) {
      throw new Error("WindowControlsFeature: wsClient not found in container");
    }

    // 严格模式：从 wsClient 获取 clientName（用于后端识别窗口）
    const clientName = wsClient.getClientName?.();
    if (!clientName) {
      throw new Error("WindowControlsFeature: wsClient.getClientName() returned null (identity not available)");
    }

    logger.info(`WindowControlsFeature: using clientId="${clientName}"`);

    // 创建公共窗口控制组件，传递正确的 clientId
    this.#windowControls = new WindowControlsComponent({
      bridgeName: 'pdfViewerBridge',  // PDF-Viewer 使用 pdfViewerBridge
      clientId: clientName,  // 使用 wsClient 的 client_name（如 pdf-viewer-c83c60c58ad2）
      wsClient: wsClient,
      autoLoad: true  // 自动加载 CSS
    });

    // 挂载到工具栏容器
    try {
      // 等待DOM加载完成
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // 挂载到窗口控制按钮容器
      const container = document.querySelector('.toolbar-right');
      if (container) {
        await this.#windowControls.mount(container);
        logger.info("WindowControlsFeature installed successfully");
      } else {
        logger.error("Toolbar container not found, cannot mount window controls");
      }
    } catch (error) {
      logger.error("Failed to mount window controls:", error);
    }
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger: contextLogger } = context;

    logger.info("Uninstalling WindowControlsFeature...");

    // 销毁组件
    if (this.#windowControls) {
      this.#windowControls.destroy();
      this.#windowControls = null;
    }

    logger.info("WindowControlsFeature uninstalled");
  }
}
