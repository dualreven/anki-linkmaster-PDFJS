/**
 * Core Navigation Feature 配置
 * @module CoreNavigationFeatureConfig
 * @description 核心导航功能配置文件
 */

export const CoreNavigationFeatureConfig = {
  /**
   * Feature 名称
   */
  name: 'core-navigation',

  /**
   * Feature 版本
   */
  version: '1.0.0',

  /**
   * Feature 依赖
   * @description 核心导航服务不依赖其他 feature，只依赖基础设施
   */
  dependencies: [],

  /**
   * NavigationService 配置选项
   */
  options: {
    /**
     * 导航超时时间(ms)
     * @type {number}
     */
    navigationTimeout: 5000,

    /**
     * 滚动动画持续时间(ms)
     * @type {number}
     */
    scrollDuration: 500,
  },
};

export default CoreNavigationFeatureConfig;
