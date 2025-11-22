/**
 * PDF URL Loader Feature 配置文件
 * @module PDFUrlLoaderFeatureConfig
 */

export const PDFUrlLoaderFeatureConfig = {
  /**
   * Feature名称
   * @type {string}
   */
  name: "pdf-url-loader",

  /**
   * Feature版本号
   * @type {string}
   */
  version: "1.0.0",

  /**
   * 依赖的Features
   * @type {string[]}
   */
  dependencies: ["infra-app", "pdf-manager", "infra-nav-core"],

  /**
   * 功能描述
   * @type {string}
   */
  description: "从 URL 参数加载 PDF 文件，支持通过 ?pdf-id=xxx 打开指定 PDF",

  /**
   * 开发阶段
   * @type {string}
   */
  phase: "Phase 1",

  /**
   * 优先级
   * @type {string}
   */
  priority: "中",

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
     * 是否启用调试日志
     * @type {boolean}
     */
    enableDebugLog: true,

    /**
     * 支持的URL参数名称
     * @type {Object}
     */
    paramNames: {
      pdfId: "pdf-id",
      title: "title",
    },
  },
};

export default PDFUrlLoaderFeatureConfig;
