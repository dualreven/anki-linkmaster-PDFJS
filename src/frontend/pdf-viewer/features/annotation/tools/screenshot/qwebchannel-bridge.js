/**
 * QWebChannel截图桥接器
 * 与PyQt端通信，保存截图
 *
 * 工作原理:
 * - PyQt模式: 通过QWebChannel调用PyQt端的screenshotHandler对象
 * - Mock模式: 浏览器环境下模拟PyQt行为，返回mock数据
 */
import { getLogger } from '../../../../../common/utils/logger.js';

export class QWebChannelScreenshotBridge {
  #pyqtObject = null;
  #isAvailable = false;
  #logger;
  #initPromise = null;

  constructor() {
    this.#logger = getLogger('QWebChannelBridge');
    this.#initPromise = this.#initialize();
  }

  /**
   * 初始化QWebChannel
   * @private
   * @returns {Promise<void>}
   */
  async #initialize() {
    // 检查QWebChannel是否可用
    if (typeof qt === 'undefined' || !qt.webChannelTransport) {
      this.#logger.warn('[QWebChannel] Not available, using mock mode');
      this.#isAvailable = false;
      return;
    }

    try {
      // 连接到QWebChannel
      await new Promise((resolve, reject) => {
        // 检查QWebChannel全局对象是否存在
        if (typeof QWebChannel === 'undefined') {
          reject(new Error('QWebChannel is not defined'));
          return;
        }

        new QWebChannel(qt.webChannelTransport, (channel) => {
          if (channel.objects && channel.objects.screenshotHandler) {
            this.#pyqtObject = channel.objects.screenshotHandler;
            this.#isAvailable = true;
            this.#logger.info('[QWebChannel] Connected to PyQt screenshotHandler');
            resolve();
          } else {
            reject(new Error('screenshotHandler not found in QWebChannel'));
          }
        });
      });
    } catch (error) {
      this.#logger.error('[QWebChannel] Connection failed:', error);
      this.#isAvailable = false;
    }
  }

  /**
   * 等待初始化完成
   * @private
   */
  async #waitForInit() {
    if (this.#initPromise) {
      await this.#initPromise;
    }
  }

  /**
   * 保存截图到PyQt端
   * @param {string} base64Image - base64图片数据 (格式: data:image/png;base64,...)
   * @returns {Promise<{success: boolean, path: string, hash: string}>}
   *
   * @throws {Error} 如果保存失败
   *
   * @example
   * const result = await bridge.saveScreenshot('data:image/png;base64,...');
   * // { success: true, path: '/data/screenshots/abc123.png', hash: 'abc123' }
   */
  async saveScreenshot(base64Image) {
    // 等待初始化完成
    await this.#waitForInit();

    if (!this.#isAvailable || !this.#pyqtObject) {
      // Mock模式（浏览器模式）
      return this.#mockSaveScreenshot(base64Image);
    }

    return new Promise((resolve, reject) => {
      try {
        // 验证base64格式
        if (!this.#validateBase64Image(base64Image)) {
          reject(new Error('Invalid base64 image format'));
          return;
        }

        // 调用PyQt方法（PyQt的@pyqtSlot会自动转换为Promise）
        this.#pyqtObject.saveScreenshot(base64Image, (result) => {
          // QWebChannel会将PyQt的返回值通过回调传递
          if (result && result.success) {
            this.#logger.info('[QWebChannel] Screenshot saved:', result.path);
            resolve({
              success: true,
              path: result.path,
              hash: result.hash
            });
          } else {
            const errorMsg = result?.error || 'Unknown error';
            this.#logger.error('[QWebChannel] Save failed:', errorMsg);
            reject(new Error(errorMsg));
          }
        });

        // 设置超时（10秒）
        setTimeout(() => {
          reject(new Error('Screenshot save timeout (10s)'));
        }, 10000);

      } catch (error) {
        this.#logger.error('[QWebChannel] Call failed:', error);
        reject(error);
      }
    });
  }

  /**
   * 验证base64图片格式
   * @private
   */
  #validateBase64Image(base64Image) {
    if (typeof base64Image !== 'string') {
      return false;
    }

    // 检查是否以data:image/开头
    if (!base64Image.startsWith('data:image/')) {
      return false;
    }

    // 检查是否包含base64标记
    if (!base64Image.includes('base64,')) {
      return false;
    }

    return true;
  }

  /**
   * Mock保存（浏览器模式）
   * @private
   * @param {string} base64Image
   * @returns {Promise<{success: boolean, path: string, hash: string}>}
   */
  async #mockSaveScreenshot(base64Image) {
    this.#logger.info('[QWebChannel] Using mock save (browser mode)');

    // 验证输入
    if (!this.#validateBase64Image(base64Image)) {
      throw new Error('Invalid base64 image format');
    }

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200));

    // 生成mock数据
    const timestamp = Date.now();
    const mockHash = this.#generateMockHash(base64Image);

    const result = {
      success: true,
      path: `/data/screenshots/${mockHash}.png`,
      hash: mockHash
    };

    this.#logger.debug('[QWebChannel] Mock save result:', result);

    return result;
  }

  /**
   * 生成mock哈希值（模拟MD5）
   * @private
   */
  #generateMockHash(base64Image) {
    // 简单哈希算法（仅用于mock）
    let hash = 0;
    const str = base64Image.substring(0, 1000); // 只取前1000字符

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // 转换为16进制并添加时间戳
    const timestamp = Date.now().toString(16).substr(-6);
    return Math.abs(hash).toString(16) + timestamp;
  }

  /**
   * 检查QWebChannel是否可用
   * @returns {boolean}
   */
  isAvailable() {
    return this.#isAvailable;
  }

  /**
   * 获取当前模式
   * @returns {string} 'pyqt' | 'mock'
   */
  getMode() {
    return this.#isAvailable ? 'pyqt' : 'mock';
  }
}
