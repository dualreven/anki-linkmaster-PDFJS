/**
 * @file PDF.js配置管理
 * @module PDFConfig
 * @description 管理PDF.js的配置选项和初始化设置
 */

/**
 * PDF.js 默认配置
 */
export const PDFJS_CONFIG = {
  // Worker配置 - 使用本地worker文件 (通过Vite别名 @pdfjs)
  workerSrc: new URL('@pdfjs/build/pdf.worker.min.mjs', import.meta.url).href,

  // CMap配置 - 禁用CMap支持以优化性能和兼容性
  cMapUrl: null,
  cMapPacked: false,

  // 跨域资源加载配置
  withCredentials: false,

  // 内存优化配置
  maxImageSize: -1, // 无限制
  disableAutoFetch: false,
  disableStream: false,
  disableRange: false,

  // QtWebEngine兼容性配置
  isEvalSupported: true,
  useSystemFonts: false,

  // 渲染配置
  useOnlyCssZoom: false,
  textLayerMode: 1, // 启用文本层

  // 缓存配置
  cacheSize: 10 * 1024 * 1024, // 10MB缓存

  // 性能配置
  enablePrintAutoRotate: true,
  useWorkerFetch: false
};

/**
 * 加载配置
 */
export const LOADING_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 500,
  timeoutMs: 30000, // 30秒超时
  progressUpdateInterval: 100 // 进度更新间隔（毫秒）
};

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  maxCacheSize: 10, // 最大缓存页面数
  preloadRange: 2,  // 预加载范围（前后各几页）
  keepRange: 3,     // 保留范围（清理缓存时）
  cleanupInterval: 60000 // 自动清理间隔（毫秒）
};

/**
 * 文件路径配置
 */
export const PATH_CONFIG = {
  // 默认PDF文件路径（开发环境）
  defaultPdfPath: '/pdf/',

  // 代理路径配置
  proxyPath: '/pdf-files/',

  // 支持的文件扩展名
  supportedExtensions: ['.pdf', '.PDF']
};

/**
 * 根据环境获取配置
 * @param {string} env - 环境标识（development/production）
 * @returns {Object} 合并后的配置
 */
export function getEnvironmentConfig(env = 'development') {
  const baseConfig = { ...PDFJS_CONFIG };

  if (env === 'production') {
    // 生产环境配置调整
    baseConfig.disableAutoFetch = true; // 禁用自动获取以节省带宽
    baseConfig.cacheSize = 20 * 1024 * 1024; // 增加缓存到20MB
  } else {
    // 开发环境配置
    baseConfig.verbosity = 1; // 启用详细日志
  }

  return baseConfig;
}

/**
 * 检测WebGL支持并返回优化配置
 * @returns {Object} WebGL相关配置
 */
export function getWebGLConfig() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (gl) {
    return {
      enableWebGL: true,
      preferWebGL: true,
      maxCanvasPixels: 16777216 // 16MP
    };
  } else {
    return {
      enableWebGL: false,
      preferWebGL: false,
      maxCanvasPixels: 8388608 // 8MP (降低以提高兼容性)
    };
  }
}

/**
 * 获取完整的PDF.js配置
 * @param {Object} customConfig - 自定义配置
 * @returns {Object} 合并后的完整配置
 */
export function getPDFJSConfig(customConfig = {}) {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = getEnvironmentConfig(env);
  const webglConfig = getWebGLConfig();

  return {
    ...envConfig,
    ...webglConfig,
    ...customConfig
  };
}