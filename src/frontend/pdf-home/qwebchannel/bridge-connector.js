/**
 * @file QWebChannel桥接连接器
 * @module BridgeConnector
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * QWebChannel桥接连接器类
 */
export class BridgeConnector {
  #logger;
  #channel = null;
  #bridge = null;
  #isReady = false;
  #eventBus = null;

  constructor(eventBus) {
    this.#logger = getLogger("BridgeConnector");
    this.#eventBus = eventBus;
  }

  /**
   * 连接到QWebChannel
   * @param {Object} waitConfig - 等待配置
   * @param {Object} environment - 环境信息
   * @returns {Promise<Object>} 桥接对象
   */
  async connect(waitConfig, environment) {
    if (typeof QWebChannel === 'undefined') {
      throw new Error(`QWebChannel script not loaded - ${environment.recommendation}`);
    }

    this.#logger.info(`Waiting for qt.webChannelTransport (timeout: ${waitConfig.timeout}ms)...`);

    return new Promise((resolve, reject) => {
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
              this.#eventBus.emit('qwebchannel:initialized:ready', this.#bridge, {
                actorId: 'BridgeConnector'
              });
              resolve(this.#bridge);
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
  }

  /**
   * 设置信号监听器
   * @private
   */
  #setupSignalListeners() {
    if (!this.#bridge) return;

    try {
      // 监听PDF列表更新信号
      this.#bridge.pdfListUpdated.connect((pdfList) => {
        this.#logger.info("Received pdfListUpdated signal:", pdfList);
        this.#eventBus.emit('pdf:list:updated', pdfList, {
          actorId: 'BridgeConnector'
        });
      });

      this.#logger.info("QWebChannel signal listeners setup complete");
    } catch (error) {
      this.#logger.error("Failed to setup signal listeners:", error);
    }
  }

  /**
   * 检查是否已就绪
   * @returns {boolean} 是否已就绪
   */
  isReady() {
    return this.#isReady && this.#bridge !== null;
  }

  /**
   * 获取桥接对象
   * @returns {Object} 桥接对象
   */
  getBridge() {
    return this.#bridge;
  }

  /**
   * 销毁连接
   */
  destroy() {
    this.#logger.info("Destroying QWebChannel connection");
    this.#isReady = false;
    this.#bridge = null;
    this.#channel = null;
  }
}