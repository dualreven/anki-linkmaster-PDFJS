/**
 * @file QWebChannel管理器 - 协调器
 * @module QWebChannelManager
 */

import { getLogger } from "../common/utils/logger.js";
import { EnvironmentDetector } from "./qwebchannel/environment-detector.js";
import { BridgeConnector } from "./qwebchannel/bridge-connector.js";
import { ApiWrapper } from "./qwebchannel/api-wrapper.js";

export class QWebChannelManager {
  #logger;
  #eventBus = null;
  #environmentDetector;
  #bridgeConnector;
  #apiWrapper;

  constructor(eventBus) {
    this.#logger = getLogger("QWebChannelManager");
    this.#eventBus = eventBus;
    this.#environmentDetector = new EnvironmentDetector();
    this.#bridgeConnector = new BridgeConnector(eventBus);
    this.#apiWrapper = new ApiWrapper();
  }

  /**
   * 初始化QWebChannel连接
   */
  async initialize() {
    // 检测运行环境
    const environment = this.#environmentDetector.detectEnvironment();
    this.#logger.info(`Environment detected: ${environment.type} (${environment.description})`);

    try {
      // 根据环境类型调整等待策略
      const waitConfig = this.#environmentDetector.getWaitConfig(environment);

      // 连接到QWebChannel
      const bridge = await this.#bridgeConnector.connect(waitConfig, environment);
      this.#apiWrapper.setBridge(bridge);

      // 设置事件监听器
      this.#setupEventListeners();

      this.#logger.info("QWebChannel initialized successfully");
    } catch (error) {
      const severity = this.#environmentDetector.getErrorSeverity(error.message);
      this.#logger[severity]("QWebChannel initialization failed:", error.message);
      this.#logger.info("Running in browser-only mode without PyQt integration");
      this.#eventBus.emit('qwebchannel:initialized:unavailable', {
        reason: error.message,
        environment: environment.type
      }, {
        actorId: 'QWebChannelManager'
      });
    }
  }

  /**
   * 检查是否已就绪
   */
  isReady() {
    return this.#bridgeConnector.isReady();
  }

  /**
   * 选择PDF文件
   */
  async selectPdfFiles() {
    return await this.#apiWrapper.selectPdfFiles();
  }

  /**
   * 获取PDF列表
   */
  async getPdfList() {
    return await this.#apiWrapper.getPdfList();
  }

  /**
   * 添加PDF文件（通过Base64）
   */
  async addPdfFromBase64(filename, dataBase64) {
    return await this.#apiWrapper.addPdfFromBase64(filename, dataBase64);
  }

  /**
   * 批量添加PDF文件
   */
  async addPdfBatchFromBase64(items) {
    return await this.#apiWrapper.addPdfBatchFromBase64(items);
  }

  /**
   * 删除PDF文件
   */
  async removePdf(fileId) {
    return await this.#apiWrapper.removePdf(fileId);
  }

  /**
   * 打开PDF查看器
   */
  async openPdfViewer(fileId) {
    return await this.#apiWrapper.openPdfViewer(fileId);
  }

  /**
   * 测试PyQt连通性
   */
  async testConnection() {
    return await this.#apiWrapper.testConnection();
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听QWebChannel状态检查请求
    this.#eventBus.on('qwebchannel:check:request', () => {
      if (this.isReady()) {
        this.#eventBus.emit('qwebchannel:status:ready', this.#bridgeConnector.getBridge(), {
          actorId: 'QWebChannelManager'
        });
      } else {
        this.#eventBus.emit('qwebchannel:status:unavailable', {
          reason: 'QWebChannel not ready'
        }, {
          actorId: 'QWebChannelManager'
        });
      }
    });

    // 监听文件选择请求
    this.#eventBus.on('qwebchannel:selectFiles:request', async (options) => {
      try {
        const files = await this.selectPdfFiles();
        this.#logger.info("File selection completed:", files);

        // 如果选择了文件，将它们发送到后端
        if (files && files.length > 0) {
          this.#handleSelectedFiles(files);
        }
      } catch (error) {
        this.#logger.error("File selection failed:", error);
        this.#eventBus.emit('qwebchannel:selectFiles:error', {
          error: error.message
        }, {
          actorId: 'QWebChannelManager'
        });
      }
    });

    // 监听PyQt连通性测试请求
    this.#eventBus.on('qwebchannel:test:request', async () => {
      try {
        this.#logger.info("Received PyQt connection test request");

        // 检查是否就绪
        if (!this.isReady()) {
          throw new Error('QWebChannel not ready for testing');
        }

        const result = await this.testConnection();
        this.#logger.info("PyQt connection test completed:", result);

        const timestamp = new Date().toLocaleTimeString();
        this.#eventBus.emit('qwebchannel:test:success', {
          ...result,
          timestamp: timestamp
        }, {
          actorId: 'QWebChannelManager'
        });
      } catch (error) {
        this.#logger.error("PyQt connection test failed:", error);
        this.#eventBus.emit('qwebchannel:test:failed', {
          error: error.message,
          timestamp: new Date().toLocaleTimeString()
        }, {
          actorId: 'QWebChannelManager'
        });
      }
    });
  }

  /**
   * 处理选择的文件
   * @param {Array} files - 文件列表
   * @private
   */
  async #handleSelectedFiles(files) {
    this.#logger.info("Processing selected files:", files);

    try {
      // 读取文件并转换为Base64
      const fileItems = [];

      for (const filePath of files) {
        try {
          // 通过QWebChannel请求PyQt读取文件
          const result = await this.#apiWrapper.readFileAsBase64(filePath);
          if (result && result.success) {
            fileItems.push({
              filename: result.filename,
              data_base64: result.data_base64
            });
          }
        } catch (error) {
          this.#logger.error(`Failed to read file ${filePath}:`, error);
        }
      }

      if (fileItems.length > 0) {
        // 发送到后端处理
        if (fileItems.length === 1) {
          const item = fileItems[0];
          await this.addPdfFromBase64(item.filename, item.data_base64);
        } else {
          await this.addPdfBatchFromBase64(fileItems);
        }
      }
    } catch (error) {
      this.#logger.error("Failed to process selected files:", error);
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.#logger.info("Destroying QWebChannelManager");
    this.#bridgeConnector.destroy();
  }
}