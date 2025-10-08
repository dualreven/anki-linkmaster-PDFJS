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
      this.#logger.error('[QWebChannel] Error message:', error.message);
      this.#logger.error('[QWebChannel] Error stack:', error.stack);
      this.#logger.error('[QWebChannel] qt available:', typeof qt !== 'undefined');
      this.#logger.error('[QWebChannel] qt.webChannelTransport:', typeof qt !== 'undefined' ? (qt.webChannelTransport ? 'exists' : 'null') : 'qt undefined');
      this.#logger.error('[QWebChannel] QWebChannel class:', typeof QWebChannel !== 'undefined' ? 'exists' : 'undefined');
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

    try {
      // 验证base64格式
      if (!this.#validateBase64Image(base64Image)) {
        throw new Error('Invalid base64 image format');
      }

      this.#logger.debug('[QWebChannel] Calling PyQt saveScreenshot...');

      // QWebChannel会自动将带有result参数的PyQt slot转换为返回Promise的方法
      // 因此直接await即可，不需要回调函数
      // 注意: PyQt返回的是JSON字符串，需要parse
      const resultStr = await Promise.race([
        this.#pyqtObject.saveScreenshot(base64Image),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Screenshot save timeout (10s)')), 10000)
        )
      ]);

      this.#logger.debug('[QWebChannel] Received result string from PyQt:', typeof resultStr, resultStr);

      // 解析JSON字符串
      let result;
      try {
        result = JSON.parse(resultStr);
        this.#logger.debug('[QWebChannel] Parsed result:', result);
      } catch (parseError) {
        this.#logger.error('[QWebChannel] Failed to parse result JSON:', parseError);
        throw new Error(`Invalid JSON response from PyQt: ${resultStr}`);
      }

      if (result && result.success) {
        this.#logger.info('[QWebChannel] Screenshot saved:', result.path);
        return {
          success: true,
          path: result.path,
          hash: result.hash
        };
      } else {
        const errorMsg = result?.error || 'Unknown error';
        this.#logger.error('[QWebChannel] Save failed:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error) {
      this.#logger.error('[QWebChannel] Call failed:', error);
      throw error;
    }
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
    const mockHash = await this.#generateHex32(base64Image);

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
  async #generateHex32(base64Image) {
    try {
      // 优先使用 WebCrypto 生成 16 字节随机数 → 32位十六进制
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (_) {}

    // 兼容回退：基于输入内容构造一个 32位十六进制（非加密，仅用于通过后端格式校验）
    const src = (typeof base64Image === 'string' ? base64Image : String(base64Image)).slice(0, 1024);
    let a = 0x12345678, b = 0x9abcdef0, c = 0xdeadbeef, d = 0x10203040;
    for (let i = 0; i < src.length; i++) {
      const ch = src.charCodeAt(i);
      a = (a ^ ch) + ((a << 5) | (a >>> 27));
      b = (b + ch) ^ ((b << 7) | (b >>> 25));
      c = (c ^ (ch << 3)) + ((c << 9) | (c >>> 23));
      d = (d + (ch << 1)) ^ ((d << 11) | (d >>> 21));
      a |= 0; b |= 0; c |= 0; d |= 0;
    }
    const toHex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');
    const hex32 = (toHex8(a) + toHex8(b) + toHex8(c) + toHex8(d)).slice(0, 32).toLowerCase();
    return hex32;
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
