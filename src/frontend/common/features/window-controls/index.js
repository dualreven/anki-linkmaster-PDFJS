/**
 * @file 通用窗口控制功能域
 * @module WindowControlsFeature
 * @description 管理自定义窗口控制按钮(最小化、最大化、关闭)，可跨模块复用
 * @version 3.0.0 (统一版本，替代 pdf-viewer 和 pdf-home 的独立实现)
 */

import { getLogger } from "../../utils/logger.js";
import { WindowControlsComponent } from "../../components/window-controls/window-controls.js";

/**
 * 窗口控制功能域配置
 * @typedef {Object} WindowControlsFeatureConfig
 * @property {string} bridgeName - PyQt Bridge对象名称（如 'pdfViewerBridge' 或 'pyqtBridge'）
 * @property {string} containerSelector - 挂载容器的CSS选择器（如 '.toolbar-right' 或 '.toolbar-controls'）
 */

/**
 * 窗口控制功能域（通用版本）
 * @class WindowControlsFeature
 * @implements {IFeature}
 * @description 提供跨模块复用的窗口控制功能，通过构造函数参数配置差异
 */
export class WindowControlsFeature {
  #windowControls = null;
  #bridgeName = "";
  #containerSelector = "";
  #logger = null;
  #installed = false;

  /**
   * 构造函数
   * @param {WindowControlsFeatureConfig} config - 功能配置
   * @throws {Error} 如果缺少必需参数 bridgeName 或 containerSelector
   */
  constructor(config) {
    if (!config || !config.bridgeName || !config.containerSelector) {
      throw new Error(
        "WindowControlsFeature requires config with bridgeName and containerSelector"
      );
    }

    this.#bridgeName = config.bridgeName;
    this.#containerSelector = config.containerSelector;
    this.#logger = getLogger("WindowControlsFeature");
  }

  /** 功能名称 */
  get name() {
    return "window-controls";
  }

  /** 版本号 */
  get version() {
    return "3.0.0";  // 升级到3.0.0，统一 pdf-viewer 和 pdf-home
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
    const { container, logger } = context;

    // 优先使用 context 提供的 logger（便于测试 mock）
    if (logger) {
      this.#logger = logger;
    }

    this.#logger.info(`Installing WindowControlsFeature (bridgeName: ${this.#bridgeName})...`);

    if (this.#installed) {
      this.#logger.warn("WindowControlsFeature already installed; skip duplicate install");
      return;
    }

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

    this.#logger.info(`WindowControlsFeature: using clientId="${clientName}"`);

    // 创建公共窗口控制组件，传递正确的 clientId
    this.#windowControls = new WindowControlsComponent({
      bridgeName: this.#bridgeName,  // 从构造参数获取
      clientId: clientName,  // 使用 wsClient 的 client_name
      wsClient: wsClient,
      autoLoad: true  // 自动加载 CSS
    });

    // 挂载到工具栏容器
    try {
      // 等待DOM加载完成
      if (document.readyState === "loading") {
        await new Promise(resolve => {
          document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
      }

      // 挂载到窗口控制按钮容器
      const toolbarContainer = document.querySelector(this.#containerSelector);  // 从构造参数获取
      if (toolbarContainer) {
        await this.#windowControls.mount(toolbarContainer);
        this.#installed = true;
        this.#logger.info(`WindowControlsFeature installed successfully (container: ${this.#containerSelector})`);
      } else {
        this.#logger.error(`Toolbar container "${this.#containerSelector}" not found, cannot mount window controls`);
      }
    } catch (error) {
      this.#logger.error("Failed to mount window controls:", error);
    }
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    this.#logger.info("Uninstalling WindowControlsFeature...");

    // 销毁组件
    if (this.#windowControls) {
      this.#windowControls.destroy();
      this.#windowControls = null;
    }
    this.#installed = false;

    this.#logger.info("WindowControlsFeature uninstalled");
  }
}
