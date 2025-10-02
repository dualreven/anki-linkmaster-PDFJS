/**
 * URL Navigation Feature
 * @module URLNavigationFeature
 * @description URL参数导航功能，支持通过URL参数自动打开PDF并跳转到指定位置
 * @implements {IFeature}
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { URLParamsParser } from './components/url-params-parser.js';
import { NavigationService } from './services/navigation-service.js';
import { URLNavigationFeatureConfig } from './feature.config.js';

/**
 * URL导航功能Feature
 * @class URLNavigationFeature
 * @implements {IFeature}
 */
export class URLNavigationFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = getLogger('URLNavigationFeature');

  /** @type {EventBus|null} */
  #eventBus = null;

  /** @type {NavigationService|null} */
  #navigationService = null;

  /** @type {Object|null} 解析出的URL参数 */
  #parsedParams = null;

  /** @type {boolean} 是否已处理URL参数 */
  #hasProcessedParams = false;

  /** @type {number|null} 导航开始时间戳 */
  #navigationStartTime = null;

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return URLNavigationFeatureConfig.name;
  }

  /**
   * Feature版本
   * @returns {string}
   */
  get version() {
    return URLNavigationFeatureConfig.version;
  }

  /**
   * Feature依赖
   * @returns {string[]}
   */
  get dependencies() {
    return URLNavigationFeatureConfig.dependencies;
  }

  /**
   * 安装Feature
   * @param {import('../../container/simple-dependency-container.js').SimpleDependencyContainer} container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(container) {
    this.#logger.info(`安装 ${this.name} Feature v${this.version}...`);

    // 1. 获取依赖（SimpleDependencyContainer使用get方法）
    this.#eventBus = container.get ? container.get('eventBus') : container.resolve('eventBus');
    if (!this.#eventBus) {
      throw new Error('EventBus未在容器中注册');
    }

    // 2. 初始化导航服务
    this.#navigationService = new NavigationService(this.#eventBus, URLNavigationFeatureConfig.options);

    // 3. 解析URL参数
    this.#parsedParams = URLParamsParser.parse();

    // 4. 如果有URL参数，发出解析完成事件
    if (this.#parsedParams.hasParams) {
      this.#logger.info('检测到URL导航参数:', this.#parsedParams);

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
        this.#parsedParams,
        { actorId: 'URLNavigationFeature' }
      );

      // 验证参数
      const validation = URLParamsParser.validate(this.#parsedParams);
      if (!validation.isValid) {
        this.#logger.error('URL参数验证失败:', validation.errors);
        this.#emitNavigationFailed(
          new Error(validation.errors.join('; ')),
          'parse'
        );
        return;
      }

      if (validation.warnings.length > 0) {
        this.#logger.warn('URL参数警告:', validation.warnings);
      }
    } else {
      this.#logger.debug('未检测到URL导航参数，Feature待命');
    }

    // 5. 设置事件监听器
    this.#setupEventListeners();

    // 6. 如果有pdf-id参数，触发PDF加载
    if (this.#parsedParams.pdfId) {
      this.#initiateNavigation();
    }

    this.#logger.info(`${this.name} Feature安装完成`);
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`卸载 ${this.name} Feature...`);

    if (this.#navigationService) {
      this.#navigationService.destroy();
      this.#navigationService = null;
    }

    this.#eventBus = null;
    this.#parsedParams = null;
    this.#hasProcessedParams = false;
    this.#navigationStartTime = null;

    this.#logger.info(`${this.name} Feature已卸载`);
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听PDF加载成功事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      this.#handlePDFLoadSuccess.bind(this),
      { subscriberId: 'URLNavigationFeature' }
    );

    // 监听PDF加载失败事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      this.#handlePDFLoadFailed.bind(this),
      { subscriberId: 'URLNavigationFeature' }
    );

    // 监听手动触发的URL参数导航请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      this.#handleNavigationRequested.bind(this),
      { subscriberId: 'URLNavigationFeature' }
    );
  }

  /**
   * 启动导航流程
   * @private
   */
  #initiateNavigation() {
    this.#navigationStartTime = performance.now();

    this.#logger.info(`启动URL导航: pdf-id=${this.#parsedParams.pdfId}`);

    // 触发PDF加载请求
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      {
        fileData: this.#parsedParams.pdfId,
        source: 'url-navigation'
      },
      { actorId: 'URLNavigationFeature' }
    );
  }

  /**
   * 处理PDF加载成功事件
   * @param {Object} data - 事件数据
   * @private
   */
  async #handlePDFLoadSuccess(data) {
    // 只处理一次URL参数导航
    if (this.#hasProcessedParams) {
      return;
    }

    // 检查是否有页面跳转需求
    const { pageAt, position } = this.#parsedParams;
    if (pageAt === null && position === null) {
      this.#logger.debug('无页面导航参数，跳过导航');
      this.#hasProcessedParams = true;
      return;
    }

    this.#logger.info('PDF加载成功，开始执行页面导航');

    try {
      // 标准化参数（使用PDF的实际总页数）
      const totalPages = this.#navigationService.getTotalPages();
      const normalizedParams = URLParamsParser.normalize(
        { pageAt, position },
        { maxPages: totalPages }
      );

      // 执行导航
      const result = await this.#navigationService.navigateTo({
        pageAt: normalizedParams.pageAt || 1,
        position: normalizedParams.position,
      });

      if (result.success) {
        const totalDuration = this.#navigationStartTime
          ? Math.round(performance.now() - this.#navigationStartTime)
          : result.duration;

        this.#emitNavigationSuccess({
          pdfId: this.#parsedParams.pdfId,
          pageAt: result.actualPage,
          position: result.actualPosition,
          duration: totalDuration,
        });
      } else {
        this.#emitNavigationFailed(
          new Error(result.error || '导航失败'),
          'navigate'
        );
      }
    } catch (error) {
      this.#logger.error('导航执行失败:', error);
      this.#emitNavigationFailed(error, 'navigate');
    } finally {
      this.#hasProcessedParams = true;
    }
  }

  /**
   * 处理PDF加载失败事件
   * @param {Object} data - 事件数据
   * @private
   */
  #handlePDFLoadFailed(data) {
    if (this.#hasProcessedParams) {
      return;
    }

    this.#logger.error('PDF加载失败，取消导航:', data);
    this.#emitNavigationFailed(
      new Error(data.message || 'PDF加载失败'),
      'load'
    );
    this.#hasProcessedParams = true;
  }

  /**
   * 处理手动触发的导航请求
   * @param {Object} params - 导航参数
   * @private
   */
  async #handleNavigationRequested(params) {
    this.#logger.info('收到手动导航请求:', params);

    const validation = URLParamsParser.validate(params);
    if (!validation.isValid) {
      this.#logger.error('导航参数验证失败:', validation.errors);
      this.#emitNavigationFailed(
        new Error(validation.errors.join('; ')),
        'parse'
      );
      return;
    }

    const startTime = performance.now();

    try {
      // 如果指定了pdfId，先加载PDF
      if (params.pdfId) {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
          { fileData: params.pdfId },
          { actorId: 'URLNavigationFeature' }
        );

        // 等待PDF加载（通过事件监听器处理后续导航）
        return;
      }

      // 否则直接执行页面导航
      const result = await this.#navigationService.navigateTo({
        pageAt: params.pageAt,
        position: params.position,
      });

      if (result.success) {
        this.#emitNavigationSuccess({
          pdfId: params.pdfId,
          pageAt: result.actualPage,
          position: result.actualPosition,
          duration: Math.round(performance.now() - startTime),
        });
      } else {
        this.#emitNavigationFailed(
          new Error(result.error || '导航失败'),
          'navigate'
        );
      }
    } catch (error) {
      this.#logger.error('手动导航失败:', error);
      this.#emitNavigationFailed(error, 'navigate');
    }
  }

  /**
   * 发出导航成功事件
   * @param {Object} data - 成功数据
   * @private
   */
  #emitNavigationSuccess(data) {
    this.#logger.info(`URL导航成功: ${JSON.stringify(data)}`);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
      data,
      { actorId: 'URLNavigationFeature' }
    );
  }

  /**
   * 发出导航失败事件
   * @param {Error} error - 错误对象
   * @param {string} stage - 失败阶段
   * @private
   */
  #emitNavigationFailed(error, stage) {
    this.#logger.error(`URL导航失败 (阶段: ${stage}):`, error);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED,
      {
        error,
        message: error.message,
        stage,
      },
      { actorId: 'URLNavigationFeature' }
    );
  }
}

export default URLNavigationFeature;
