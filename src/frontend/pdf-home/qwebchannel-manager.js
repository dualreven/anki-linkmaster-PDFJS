/**
 * QWebChannel管理器
 * 负责JS与PyQt层的通信
 */

import { getLogger } from "../common/utils/logger.js";

export class QWebChannelManager {
  #logger;
  #channel = null;
  #bridge = null;
  #isReady = false;
  #eventBus = null;

  constructor(eventBus) {
    this.#logger = getLogger("QWebChannelManager");
    this.#eventBus = eventBus;
  }

  /**
   * 初始化QWebChannel连接
   */
  async initialize() {
    // 检测运行环境
    const environment = this.#detectEnvironment();
    this.#logger.info(`Environment detected: ${environment.type} (${environment.description})`);

    try {
      if (typeof QWebChannel === 'undefined') {
        throw new Error(`QWebChannel script not loaded - ${environment.recommendation}`);
      }

      // 根据环境类型调整等待策略
      const waitConfig = this.#getWaitConfig(environment);
      this.#logger.info(`Waiting for qt.webChannelTransport (timeout: ${waitConfig.timeout}ms)...`);

      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = Math.ceil(waitConfig.timeout / waitConfig.interval);

        const interval = setInterval(() => {
          if (typeof qt !== 'undefined' && qt.webChannelTransport) {
            clearInterval(interval);
            this.#logger.info("qt.webChannelTransport found. Initializing QWebChannel.");
            this.#channel = new QWebChannel(qt.webChannelTransport, (channel) => {
              this.#logger.info("QWebChannel connected successfully");
              this.#bridge = channel.objects.pdfHomeBridge;
              if (this.#bridge) {
                this.#logger.info("Got pdfHomeBridge object from QWebChannel");
                this.#isReady = true;
                this.#setupSignalListeners();
                this.#eventBus.emit('qwebchannel:initialized:ready', this.#bridge, { actorId: 'QWebChannelManager' });
                resolve();
              } else {
                reject(new Error("pdfHomeBridge object not found in QWebChannel."));
              }
            });
          } else {
            attempts++;
            if (attempts > maxAttempts) {
              clearInterval(interval);
              reject(new Error(`Timed out waiting for qt.webChannelTransport after ${waitConfig.timeout}ms - ${environment.fallbackMessage}`));
            }
          }
        }, waitConfig.interval);
      });
    } catch (error) {
      const severity = this.#getErrorSeverity(error.message);
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
   * 检测运行环境
   */
  #detectEnvironment() {
    const userAgent = navigator.userAgent || '';
    const isElectron = /electron/i.test(userAgent);
    const isQtWebEngine = /qtwebengine/i.test(userAgent);
    const isChrome = /chrome/i.test(userAgent) && !isElectron;
    const isFirefox = /firefox/i.test(userAgent);
    const hasQt = typeof qt !== 'undefined';

    if (isQtWebEngine && hasQt) {
      return {
        type: 'qt-webengine-with-bridge',
        description: 'PyQt WebEngine with qt bridge available',
        recommendation: 'this should work normally',
        fallbackMessage: 'qt bridge may not be properly configured'
      };
    } else if (isQtWebEngine) {
      return {
        type: 'qt-webengine-no-bridge',
        description: 'PyQt WebEngine without qt bridge',
        recommendation: 'qt bridge not available, check PyQt setup',
        fallbackMessage: 'qt bridge initialization may be pending'
      };
    } else if (isElectron) {
      return {
        type: 'electron',
        description: 'Electron application',
        recommendation: 'QWebChannel not supported in Electron',
        fallbackMessage: 'use Electron IPC instead'
      };
    } else if (isChrome || isFirefox) {
      return {
        type: 'browser',
        description: `Standard web browser (${isChrome ? 'Chrome' : 'Firefox'})`,
        recommendation: 'QWebChannel not available in browser environment',
        fallbackMessage: 'this is expected behavior for web browsers'
      };
    } else {
      return {
        type: 'unknown',
        description: 'Unknown runtime environment',
        recommendation: 'environment not recognized',
        fallbackMessage: 'try running in a supported environment'
      };
    }
  }

  /**
   * 根据环境获取等待配置
   */
  #getWaitConfig(environment) {
    switch (environment.type) {
      case 'qt-webengine-with-bridge':
        return { timeout: 2000, interval: 100 }; // Qt环境，较短等待时间
      case 'qt-webengine-no-bridge':
        return { timeout: 5000, interval: 100 }; // Qt环境但无bridge，稍长等待
      case 'browser':
      case 'electron':
        return { timeout: 500, interval: 100 };  // 浏览器环境，快速失败
      default:
        return { timeout: 3000, interval: 100 }; // 未知环境，中等等待时间
    }
  }

  /**
   * 根据错误消息确定日志级别
   */
  #getErrorSeverity(errorMessage) {
    if (errorMessage.includes('not loaded') || errorMessage.includes('not available')) {
      return 'info'; // 脚本未加载或不可用是常见情况，使用info级别
    } else if (errorMessage.includes('Timed out') && errorMessage.includes('expected behavior')) {
      return 'debug'; // 预期的超时使用debug级别
    } else {
      return 'warn'; // 其他错误使用warn级别
    }
  }

  /**
   * 设置信号监听
   */
  #setupSignalListeners() {
    if (!this.#bridge) return;

    try {
      // 监听PDF列表更新信号
      this.#bridge.pdfListUpdated.connect((pdfList) => {
        this.#logger.info("Received pdfListUpdated signal:", pdfList);
        this.#eventBus.emit('pdf:list:updated', pdfList, {
          actorId: 'QWebChannelManager'
        });
      });

      // 设置事件监听器
      this.#setupEventListeners();

      this.#logger.info("QWebChannel signal listeners setup complete");
    } catch (error) {
      this.#logger.error("Failed to setup signal listeners:", error);
    }
  }

  /**
   * 检查QWebChannel是否就绪
   */
  isReady() {
    return this.#isReady && this.#bridge;
  }

  /**
   * 调用文件选择器
   */
  async selectPdfFiles() {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling selectPdfFiles via QWebChannel");
      const files = await this.#bridge.selectPdfFiles();
      this.#logger.info("selectPdfFiles returned:", files);
      return files;
    } catch (error) {
      this.#logger.error("selectPdfFiles failed:", error);
      throw error;
    }
  }

  /**
   * 获取PDF列表
   */
  async getPdfList() {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling getPdfList via QWebChannel");
      const list = await this.#bridge.getPdfList();
      this.#logger.info("getPdfList returned:", list);
      return list;
    } catch (error) {
      this.#logger.error("getPdfList failed:", error);
      throw error;
    }
  }

  /**
   * 添加PDF文件（通过Base64）
   */
  async addPdfFromBase64(filename, dataBase64) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling addPdfFromBase64 via QWebChannel:", filename);
      const result = await this.#bridge.addPdfFromBase64(filename, dataBase64);
      this.#logger.info("addPdfFromBase64 returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("addPdfFromBase64 failed:", error);
      throw error;
    }
  }

  /**
   * 批量添加PDF文件
   */
  async addPdfBatchFromBase64(items) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling addPdfBatchFromBase64 via QWebChannel:", items.length);
      const result = await this.#bridge.addPdfBatchFromBase64(items);
      this.#logger.info("addPdfBatchFromBase64 returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("addPdfBatchFromBase64 failed:", error);
      throw error;
    }
  }

  /**
   * 删除PDF文件
   */
  async removePdf(fileId) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling removePdf via QWebChannel:", fileId);
      const result = await this.#bridge.removePdf(fileId);
      this.#logger.info("removePdf returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("removePdf failed:", error);
      throw error;
    }
  }

  /**
   * 打开PDF查看器
   */
  async openPdfViewer(fileId) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling openPdfViewer via QWebChannel:", fileId);
      const result = await this.#bridge.openPdfViewer(fileId);
      this.#logger.info("openPdfViewer returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("openPdfViewer failed:", error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  #setupEventListeners() {
    // 监听QWebChannel状态检查请求
    this.#eventBus.on('qwebchannel:check:request', () => {
      if (this.#isReady) {
        this.#eventBus.emit('qwebchannel:status:ready', this.#bridge, {
          actorId: 'QWebChannelManager'
        });
      } else {
        this.#eventBus.emit('qwebchannel:status:unavailable', {
          reason: 'Not ready'
        }, {
          actorId: 'QWebChannelManager'
        });
      }
    }, { subscriberId: 'QWebChannelManager' });

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
          error: error.message,
          operation: 'selectFiles'
        }, {
          actorId: 'QWebChannelManager'
        });
      }
    }, { subscriberId: 'QWebChannelManager' });
  }

  /**
   * 处理选择的文件
   * @param {Array} files - 选择的文件路径数组
   */
  async #handleSelectedFiles(files) {
    this.#logger.info("Processing selected files:", files);

    try {
      // 读取文件并转换为Base64
      const fileItems = [];

      for (const filePath of files) {
        try {
          // 通过QWebChannel请求PyQt读取文件
          const result = await this.#bridge.readFileAsBase64(filePath);
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
   * 销毁QWebChannel连接
   */
  destroy() {
    this.#logger.info("Destroying QWebChannel connection");
    this.#isReady = false;
    this.#bridge = null;
    this.#channel = null;
  }
}