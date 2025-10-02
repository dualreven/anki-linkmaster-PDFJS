/**
 * URL Navigation Feature 配置文件
 * @module URLNavigationFeatureConfig
 */

export const URLNavigationFeatureConfig = {
  /**
   * Feature名称
   * @type {string}
   */
  name: 'url-navigation',

  /**
   * Feature版本号
   * @type {string}
   */
  version: '1.0.0',

  /**
   * 依赖的Features
   * @type {string[]}
   */
  dependencies: ['app-core', 'pdf-manager'],

  /**
   * 功能描述
   * @type {string}
   */
  description: 'URL参数解析与自动导航功能，支持通过URL参数打开指定PDF并跳转到指定页面和位置',

  /**
   * 开发阶段
   * @type {string}
   */
  phase: 'Phase 1',

  /**
   * 优先级
   * @type {string}
   */
  priority: '中',

  /**
   * 功能配置选项
   * @type {Object}
   */
  options: {
    /**
     * 解析超时时间(ms)
     * @type {number}
     */
    parseTimeout: 50,

    /**
     * 导航超时时间(ms)
     * @type {number}
     */
    navigationTimeout: 5000,

    /**
     * 位置滚动动画持续时间(ms)
     * @type {number}
     */
    scrollDuration: 300,

    /**
     * 是否启用调试日志
     * @type {boolean}
     */
    enableDebugLog: true,

    /**
     * 支持的URL参数名称
     * @type {Object}
     */
    paramNames: {
      pdfId: 'pdf-id',
      pageAt: 'page-at',
      position: 'position',
    },
  },
};

export default URLNavigationFeatureConfig;
