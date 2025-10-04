/**
 * 翻译服务管理器
 * @file 管理多个翻译引擎，提供统一的翻译接口，支持缓存和引擎切换
 * @module TranslationService
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { MyMemoryEngine } from './MyMemoryEngine.js';

/**
 * 翻译服务类
 * @class TranslationService
 * @description 使用策略模式管理多个翻译引擎，提供统一的翻译接口
 */
export class TranslationService {
  #logger;
  #engines = new Map();       // 存储所有可用的翻译引擎
  #currentEngine = null;      // 当前使用的引擎
  #cache = new Map();         // 翻译缓存
  #cacheConfig = {
    enabled: true,
    maxSize: 1000,           // 最多缓存 1000 条
    ttl: 86400000            // 缓存有效期 24 小时
  };
  #requestQueue = [];        // 请求队列（用于防抖和限流）
  #isProcessing = false;     // 是否正在处理请求

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} [options.defaultEngine='mymemory'] - 默认引擎
   * @param {Object} [options.cacheConfig] - 缓存配置
   */
  constructor(options = {}) {
    this.#logger = getLogger('TranslationService');

    // 注册默认引擎
    this.registerEngine(new MyMemoryEngine());

    // 设置默认引擎
    const defaultEngine = options.defaultEngine || 'mymemory';
    this.setEngine(defaultEngine);

    // 应用缓存配置
    if (options.cacheConfig) {
      this.#cacheConfig = { ...this.#cacheConfig, ...options.cacheConfig };
    }

    this.#logger.info('TranslationService initialized', {
      defaultEngine,
      cacheEnabled: this.#cacheConfig.enabled
    });
  }

  /**
   * 注册翻译引擎
   * @param {ITranslationEngine} engine - 翻译引擎实例
   */
  registerEngine(engine) {
    if (!engine || !engine.name) {
      throw new Error('Invalid translation engine');
    }

    this.#engines.set(engine.name, engine);
    this.#logger.info(`Engine registered: ${engine.displayName} (${engine.name})`);
  }

  /**
   * 设置当前使用的引擎
   * @param {string} engineName - 引擎名称
   * @returns {boolean} 是否成功切换
   */
  setEngine(engineName) {
    const engine = this.#engines.get(engineName);
    if (!engine) {
      this.#logger.warn(`Engine not found: ${engineName}`);
      return false;
    }

    this.#currentEngine = engine;
    this.#logger.info(`Switched to engine: ${engine.displayName}`);
    return true;
  }

  /**
   * 获取当前引擎
   * @returns {ITranslationEngine|null}
   */
  getCurrentEngine() {
    return this.#currentEngine;
  }

  /**
   * 获取所有可用引擎
   * @returns {Array<{name: string, displayName: string, requiresApiKey: boolean}>}
   */
  getAvailableEngines() {
    return Array.from(this.#engines.values()).map(engine => ({
      name: engine.name,
      displayName: engine.displayName,
      requiresApiKey: engine.requiresApiKey
    }));
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} [sourceLang='auto'] - 源语言代码
   * @param {Object} [options] - 翻译选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @returns {Promise<TranslationResult>}
   */
  async translate(text, targetLang, sourceLang = 'auto', options = {}) {
    const useCache = options.useCache !== false;

    try {
      // 参数验证
      if (!text || text.trim().length === 0) {
        throw new Error('文本不能为空');
      }

      if (!this.#currentEngine) {
        throw new Error('未设置翻译引擎');
      }

      // 检查缓存
      if (useCache && this.#cacheConfig.enabled) {
        const cached = this.#getFromCache(text, targetLang, sourceLang);
        if (cached) {
          this.#logger.info('Translation result from cache');
          return cached;
        }
      }

      // 调用翻译引擎
      this.#logger.info(`Translating with ${this.#currentEngine.displayName}...`);
      const result = await this.#currentEngine.translate(text, targetLang, sourceLang);

      // 存入缓存
      if (useCache && this.#cacheConfig.enabled) {
        this.#addToCache(text, targetLang, sourceLang, result);
      }

      return result;

    } catch (error) {
      this.#logger.error('Translation failed:', error);
      throw error;
    }
  }

  /**
   * 批量翻译
   * @param {string[]} texts - 要翻译的文本数组
   * @param {string} targetLang - 目标语言代码
   * @param {string} [sourceLang='auto'] - 源语言代码
   * @returns {Promise<TranslationResult[]>}
   */
  async translateBatch(texts, targetLang, sourceLang = 'auto') {
    const results = [];

    for (const text of texts) {
      try {
        const result = await this.translate(text, targetLang, sourceLang);
        results.push(result);

        // 添加延迟以避免超过频率限制
        await this.#delay(1000); // 1秒延迟
      } catch (error) {
        this.#logger.error(`Batch translation failed for text: "${text}"`, error);
        results.push({
          original: text,
          translation: null,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 检测语言
   * @param {string} text - 要检测的文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    if (!this.#currentEngine) {
      throw new Error('未设置翻译引擎');
    }

    return await this.#currentEngine.detectLanguage(text);
  }

  /**
   * 获取缓存键
   * @private
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言
   * @param {string} sourceLang - 源语言
   * @returns {string}
   */
  #getCacheKey(text, targetLang, sourceLang) {
    return `${sourceLang}:${targetLang}:${text}`;
  }

  /**
   * 从缓存获取翻译结果
   * @private
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言
   * @param {string} sourceLang - 源语言
   * @returns {TranslationResult|null}
   */
  #getFromCache(text, targetLang, sourceLang) {
    const key = this.#getCacheKey(text, targetLang, sourceLang);
    const cached = this.#cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - cached.timestamp > this.#cacheConfig.ttl) {
      this.#cache.delete(key);
      this.#logger.debug('Cache expired:', key);
      return null;
    }

    return cached.result;
  }

  /**
   * 添加到缓存
   * @private
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言
   * @param {string} sourceLang - 源语言
   * @param {TranslationResult} result - 翻译结果
   */
  #addToCache(text, targetLang, sourceLang, result) {
    const key = this.#getCacheKey(text, targetLang, sourceLang);

    // 检查缓存大小限制
    if (this.#cache.size >= this.#cacheConfig.maxSize) {
      // 删除最旧的条目（FIFO策略）
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
      this.#logger.debug('Cache size limit reached, removed oldest entry');
    }

    this.#cache.set(key, {
      result,
      timestamp: Date.now()
    });

    this.#logger.debug('Added to cache:', key);
  }

  /**
   * 清除缓存
   * @param {Object} [options] - 清除选项
   * @param {string} [options.targetLang] - 仅清除特定目标语言的缓存
   */
  clearCache(options = {}) {
    if (options.targetLang) {
      // 清除特定语言的缓存
      for (const [key, value] of this.#cache.entries()) {
        if (key.includes(`:${options.targetLang}:`)) {
          this.#cache.delete(key);
        }
      }
      this.#logger.info(`Cache cleared for target language: ${options.targetLang}`);
    } else {
      // 清除所有缓存
      this.#cache.clear();
      this.#logger.info('All cache cleared');
    }
  }

  /**
   * 获取缓存统计
   * @returns {Object}
   */
  getCacheStats() {
    return {
      size: this.#cache.size,
      maxSize: this.#cacheConfig.maxSize,
      enabled: this.#cacheConfig.enabled
    };
  }

  /**
   * 延迟函数
   * @private
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证当前引擎配置
   * @returns {Promise<boolean>}
   */
  async validateCurrentEngine() {
    if (!this.#currentEngine) {
      return false;
    }

    try {
      return await this.#currentEngine.validateConfig();
    } catch (error) {
      this.#logger.error('Engine validation failed:', error);
      return false;
    }
  }

  /**
   * 获取当前引擎限制
   * @returns {Object|null}
   */
  getCurrentEngineLimits() {
    if (!this.#currentEngine) {
      return null;
    }

    return this.#currentEngine.getLimits();
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.#logger.info('Destroying TranslationService...');
    this.clearCache();
    this.#engines.clear();
    this.#currentEngine = null;
  }
}
