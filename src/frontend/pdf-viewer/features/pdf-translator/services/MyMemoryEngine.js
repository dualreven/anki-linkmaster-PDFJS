/**
 * MyMemory 翻译引擎实现
 * @file 基于 MyMemory Translation API 的免费翻译引擎
 * @module MyMemoryEngine
 * @description
 * - 完全免费，无需 API Key
 * - 每日限制：1000 次请求
 * - 支持多种语言对
 * - API 文档：https://mymemory.translated.net/doc/spec.php
 */

import { ITranslationEngine } from './ITranslationEngine.js';
import { getLogger } from '../../../../common/utils/logger.js';

/**
 * MyMemory 翻译引擎
 * @class MyMemoryEngine
 * @extends ITranslationEngine
 */
export class MyMemoryEngine extends ITranslationEngine {
  #logger;
  #apiEndpoint = 'https://api.mymemory.translated.net/get';

  /**
   * 语言代码映射（标准代码 -> MyMemory代码）
   * @private
   */
  #languageMap = {
    'zh': 'zh-CN',  // 中文简体
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW', // 中文繁体
    'en': 'en-US',   // 英语
    'ja': 'ja-JP',   // 日语
    'ko': 'ko-KR',   // 韩语
    'fr': 'fr-FR',   // 法语
    'de': 'de-DE',   // 德语
    'es': 'es-ES',   // 西班牙语
    'ru': 'ru-RU',   // 俄语
    'it': 'it-IT',   // 意大利语
    'pt': 'pt-PT',   // 葡萄牙语
    'ar': 'ar-SA',   // 阿拉伯语
  };

  constructor() {
    super();
    this.#logger = getLogger('MyMemoryEngine');
  }

  /**
   * 引擎名称
   * @returns {string}
   */
  get name() {
    return 'mymemory';
  }

  /**
   * 引擎显示名称
   * @returns {string}
   */
  get displayName() {
    return 'MyMemory (免费)';
  }

  /**
   * 是否需要 API Key
   * @returns {boolean}
   */
  get requiresApiKey() {
    return false;
  }

  /**
   * 支持的语言列表
   * @returns {string[]}
   */
  getSupportedLanguages() {
    return Object.keys(this.#languageMap);
  }

  /**
   * 语言代码转换（标准代码 -> MyMemory代码）
   * @private
   * @param {string} langCode - 标准语言代码
   * @returns {string} MyMemory 语言代码
   */
  #convertLanguageCode(langCode) {
    return this.#languageMap[langCode] || langCode;
  }

  /**
   * 检测文本语言
   * @param {string} text - 要检测的文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    // MyMemory API 不直接支持语言检测
    // 使用简单的启发式方法
    const chineseRegex = /[\u4e00-\u9fa5]/;
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    const koreanRegex = /[\uAC00-\uD7AF]/;

    if (chineseRegex.test(text)) return 'zh';
    if (japaneseRegex.test(text)) return 'ja';
    if (koreanRegex.test(text)) return 'ko';

    // 默认假设为英语
    return 'en';
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} [sourceLang='auto'] - 源语言代码
   * @returns {Promise<TranslationResult>}
   */
  async translate(text, targetLang, sourceLang = 'auto') {
    try {
      // 检查文本长度
      const limits = this.getLimits();
      if (text.length > limits.maxTextLength) {
        throw new Error(`文本长度超过限制（最大 ${limits.maxTextLength} 字符）`);
      }

      // 如果源语言是 auto，先检测语言
      let detectedSourceLang = sourceLang;
      if (sourceLang === 'auto') {
        detectedSourceLang = await this.detectLanguage(text);
        this.#logger.info(`Detected source language: ${detectedSourceLang}`);
      }

      // 转换语言代码
      const sourceCode = this.#convertLanguageCode(detectedSourceLang);
      const targetCode = this.#convertLanguageCode(targetLang);

      // 构建 API 请求 URL
      const url = new URL(this.#apiEndpoint);
      url.searchParams.set('q', text);
      url.searchParams.set('langpair', `${sourceCode}|${targetCode}`);

      this.#logger.info(`Translating: "${text.substring(0, 50)}..." from ${sourceCode} to ${targetCode}`);

      // 发送 API 请求
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 检查响应状态
      if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || 'Translation failed');
      }

      // 检查配额
      if (data.quotaFinished === true) {
        throw new Error('每日翻译配额已用完，请明天再试');
      }

      // 提取翻译结果
      const translatedText = data.responseData?.translatedText;
      if (!translatedText) {
        throw new Error('Translation result is empty');
      }

      const confidence = data.responseData?.match || 0;

      this.#logger.info(`Translation completed: "${translatedText.substring(0, 50)}..." (confidence: ${confidence})`);

      // 返回标准格式的翻译结果
      return {
        original: text,
        translation: translatedText,
        engine: this.name,
        language: {
          source: detectedSourceLang,
          target: targetLang
        },
        extras: {
          confidence: parseFloat(confidence),
          provider: 'MyMemory Translation API'
        }
      };

    } catch (error) {
      this.#logger.error('Translation failed:', error);
      throw new Error(`翻译失败: ${error.message}`);
    }
  }

  /**
   * 验证配置是否正确
   * @returns {Promise<boolean>}
   */
  async validateConfig() {
    try {
      // 尝试翻译一个简单的测试文本
      const result = await this.translate('test', 'zh', 'en');
      return result && result.translation.length > 0;
    } catch (error) {
      this.#logger.error('Config validation failed:', error);
      return false;
    }
  }

  /**
   * 获取使用限制信息
   * @returns {Object}
   */
  getLimits() {
    return {
      maxTextLength: 500,     // 单次最大 500 字符
      rateLimit: 1,           // 每秒 1 次请求
      dailyLimit: 1000        // 每日 1000 次请求
    };
  }
}
