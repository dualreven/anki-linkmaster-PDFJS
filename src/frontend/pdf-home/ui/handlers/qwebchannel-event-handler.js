/**
 * @file QWebChannel事件处理器
 * @module QWebChannelEventHandler
 * @description 专门处理QWebChannel相关的事件
 */

import { DOMUtils } from "../../../common/utils/dom-utils.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * QWebChannel事件处理器类
 * @class QWebChannelEventHandler
 */
export class QWebChannelEventHandler {
  #eventBus;
  #logger;
  #unsubscribeFunctions = [];

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   */
  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("QWebChannelEventHandler");
  }

  /**
   * 设置QWebChannel事件监听器
   */
  setupEventListeners() {
    const listeners = [
      this.#eventBus.on('qwebchannel:status:ready', (bridge) => this.#handleQWebChannelReady(bridge)),
      this.#eventBus.on('qwebchannel:status:unavailable', (info) => this.#handleQWebChannelUnavailable(info)),
      this.#eventBus.on('qwebchannel:test:success', (result) => this.#handleQWebChannelTestSuccess(result)),
      this.#eventBus.on('qwebchannel:test:failed', (error) => this.#handleQWebChannelTestFailed(error)),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying QWebChannelEventHandler and cleaning up listeners.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 处理QWebChannel就绪状态
   * @param {Object} bridge - QWebChannel桥接对象
   * @private
   */
  #handleQWebChannelReady(bridge) {
    this.#logger.info("QWebChannel连通性测试 - 已连接:", bridge);

    try {
      const timestamp = new Date().toLocaleTimeString();
      const message = `✅ QWebChannel连通测试成功! (${timestamp})`;

      DOMUtils.showSuccess(message);
      console.log("🔗 [QWebChannel测试] 连接正常，bridge对象:", bridge);

      // 简化：延迟后再尝试调用PyQt方法，避免立即调用导致问题
      setTimeout(() => {
        try {
          this.#eventBus.emit('qwebchannel:test:request', {}, {
            actorId: 'QWebChannelEventHandler'
          });
          console.log("🔗 [QWebChannel测试] 已请求PyQt方法测试...");
        } catch (error) {
          console.log("🔗 [QWebChannel测试] PyQt方法测试请求失败:", error);
        }
      }, 100);

    } catch (error) {
      this.#logger.error("QWebChannel连通性测试过程中发生错误:", error);
      DOMUtils.showError(`QWebChannel测试过程出错: ${error.message}`);
    }
  }

  /**
   * 处理QWebChannel不可用状态
   * @param {Object} info - 不可用信息
   * @private
   */
  #handleQWebChannelUnavailable(info) {
    this.#logger.info("QWebChannel连通性测试 - 不可用:", info);

    const timestamp = new Date().toLocaleTimeString();
    const message = `❌ QWebChannel连通测试失败 (${timestamp}): ${info.reason || '未知原因'}`;

    DOMUtils.showError(message);
    console.log("🔗 [QWebChannel测试] 连接失败，详细信息:", info);
  }

  /**
   * 处理QWebChannel测试成功
   * @param {Object} result - 测试结果
   * @private
   */
  #handleQWebChannelTestSuccess(result) {
    this.#logger.info("PyQt连通性测试成功:", result);

    const message = `🎉 PyQt连通性测试成功! (${result.timestamp})`;
    DOMUtils.showSuccess(message);

    console.log("🔗 [PyQt测试] 详细结果:", result);
    if (result.message) {
      console.log("🔗 [PyQt测试] 消息:", result.message);
    }
  }

  /**
   * 处理QWebChannel测试失败
   * @param {Object} error - 错误信息
   * @private
   */
  #handleQWebChannelTestFailed(error) {
    this.#logger.error("PyQt连通性测试失败:", error);

    const message = `❌ PyQt连通性测试失败 (${error.timestamp}): ${error.error}`;
    DOMUtils.showError(message);

    console.log("🔗 [PyQt测试] 错误详情:", error);
  }
}