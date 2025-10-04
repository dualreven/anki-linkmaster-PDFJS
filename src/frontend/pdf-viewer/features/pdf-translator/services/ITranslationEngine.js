/**
 * 翻译引擎接口
 * @file 定义翻译引擎的抽象接口，所有具体实现必须遵循此接口
 * @module ITranslationEngine
 */

/**
 * 翻译结果数据结构
 * @typedef {Object} TranslationResult
 * @property {string} original - 原文
 * @property {string} translation - 译文
 * @property {string} engine - 使用的引擎名称
 * @property {Object} language - 语言信息
 * @property {string} language.source - 源语言代码（如 'en'）
 * @property {string} language.target - 目标语言代码（如 'zh'）
 * @property {Object} [extras] - 额外信息（可选）
 * @property {string} [extras.pronunciation] - 发音
 * @property {string} [extras.partOfSpeech] - 词性
 * @property {string} [extras.context] - 上下文
 * @property {number} [extras.confidence] - 翻译置信度（0-1）
 */

/**
 * 翻译引擎接口
 * @interface ITranslationEngine
 * @description 所有翻译引擎必须实现此接口
 */
export class ITranslationEngine {
  /**
   * 引擎名称
   * @returns {string}
   */
  get name() {
    throw new Error('Method "name" must be implemented');
  }

  /**
   * 引擎显示名称
   * @returns {string}
   */
  get displayName() {
    throw new Error('Method "displayName" must be implemented');
  }

  /**
   * 是否需要API Key
   * @returns {boolean}
   */
  get requiresApiKey() {
    throw new Error('Method "requiresApiKey" must be implemented');
  }

  /**
   * 支持的语言列表
   * @returns {string[]} 语言代码数组（如 ['en', 'zh', 'ja']）
   */
  getSupportedLanguages() {
    throw new Error('Method "getSupportedLanguages" must be implemented');
  }

  /**
   * 检测文本语言
   * @param {string} text - 要检测的文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    throw new Error('Method "detectLanguage" must be implemented');
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} [sourceLang='auto'] - 源语言代码，默认自动检测
   * @returns {Promise<TranslationResult>}
   */
  async translate(text, targetLang, sourceLang = 'auto') {
    throw new Error('Method "translate" must be implemented');
  }

  /**
   * 设置API Key（如果需要）
   * @param {string} apiKey - API密钥
   */
  setApiKey(apiKey) {
    if (this.requiresApiKey) {
      throw new Error('Method "setApiKey" must be implemented');
    }
  }

  /**
   * 验证配置是否正确
   * @returns {Promise<boolean>} 配置是否有效
   */
  async validateConfig() {
    return true; // 默认实现：假设配置有效
  }

  /**
   * 获取使用限制信息
   * @returns {Object} 限制信息
   * @returns {number} .maxTextLength - 单次最大字符数
   * @returns {number} .rateLimit - 频率限制（请求/秒）
   * @returns {number} [.dailyLimit] - 每日限制（可选）
   */
  getLimits() {
    throw new Error('Method "getLimits" must be implemented');
  }
}
