/**
 * @file 错误代码常量定义
 * @module ErrorCodes
 * @description PDF查看器错误代码体系定义
 */

/**
 * 网络错误代码 (1000系列)
 * @namespace NETWORK_ERRORS
 */
export const NETWORK_ERRORS = {
  /** 网络连接失败 */
  NETWORK_CONNECTION_FAILED: 1001,
  /** HTTP请求失败 */
  HTTP_REQUEST_FAILED: 1002,
  /** CORS跨域错误 */
  CORS_ERROR: 1003,
  /** 文件未找到(404) */
  FILE_NOT_FOUND: 1004,
  /** 服务器错误(5xx) */
  SERVER_ERROR: 1005,
  /** 请求超时 */
  REQUEST_TIMEOUT: 1006,
  /** 网络中断 */
  NETWORK_DISCONNECTED: 1007,
  /** SSL证书错误 */
  SSL_CERTIFICATE_ERROR: 1008,
  /** DNS解析失败 */
  DNS_RESOLUTION_FAILED: 1009,
  /** 代理服务器错误 */
  PROXY_ERROR: 1010
};

/**
 * 格式错误代码 (2000系列)
 * @namespace FORMAT_ERRORS
 */
export const FORMAT_ERRORS = {
  /** 无效的PDF文件格式 */
  INVALID_PDF_FORMAT: 2001,
  /** PDF文件损坏 */
  CORRUPTED_PDF: 2002,
  /** 文件头格式错误 */
  INVALID_FILE_HEADER: 2003,
  /** 版本不兼容 */
  VERSION_INCOMPATIBLE: 2004,
  /** 加密的PDF文件 */
  ENCRYPTED_PDF: 2005,
  /** 不支持的压缩格式 */
  UNSUPPORTED_COMPRESSION: 2006,
  /** 字体格式错误 */
  FONT_FORMAT_ERROR: 2007,
  /** 图像格式错误 */
  IMAGE_FORMAT_ERROR: 2008,
  /** 元数据格式错误 */
  METADATA_FORMAT_ERROR: 2009,
  /** 书签格式错误 */
  BOOKMARK_FORMAT_ERROR: 2010
};

/**
 * 渲染错误代码 (3000系列)
 * @namespace RENDER_ERRORS
 */
export const RENDER_ERRORS = {
  /** 页面渲染失败 */
  PAGE_RENDER_FAILED: 3001,
  /** 字体渲染失败 */
  FONT_RENDER_FAILED: 3002,
  /** 图像渲染失败 */
  IMAGE_RENDER_FAILED: 3003,
  /** WebGL渲染失败 */
  WEBGL_RENDER_FAILED: 3004,
  /** Canvas渲染失败 */
  CANVAS_RENDER_FAILED: 3005,
  /** 内存不足渲染失败 */
  MEMORY_RENDER_FAILED: 3006,
  /** GPU加速失败 */
  GPU_ACCELERATION_FAILED: 3007,
  /** 分辨率过高渲染失败 */
  HIGH_RESOLUTION_RENDER_FAILED: 3008,
  /** 颜色空间不支持 */
  COLOR_SPACE_UNSUPPORTED: 3009,
  /** 透明度渲染失败 */
  TRANSPARENCY_RENDER_FAILED: 3010
};

/**
 * 通用错误代码 (9000系列)
 * @namespace GENERAL_ERRORS
 */
export const GENERAL_ERRORS = {
  /** 未知错误 */
  UNKNOWN_ERROR: 9001,
  /** 权限错误 */
  PERMISSION_ERROR: 9002,
  /** 内存不足 */
  MEMORY_ERROR: 9003,
  /** 参数错误 */
  PARAMETER_ERROR: 9004,
  /** 配置错误 */
  CONFIGURATION_ERROR: 9005,
  /** 初始化失败 */
  INITIALIZATION_FAILED: 9006,
  /** 操作超时 */
  OPERATION_TIMEOUT: 9007,
  /** 资源未找到 */
  RESOURCE_NOT_FOUND: 9008,
  /** 状态错误 */
  STATE_ERROR: 9009,
  /** 不支持的操作 */
  UNSUPPORTED_OPERATION: 9010
};

/**
 * 获取错误代码的描述信息
 * @param {number} errorCode - 错误代码
 * @returns {string} 错误描述
 */
export function getErrorDescription(errorCode) {
  const errorMap = {
    // 网络错误
    1001: '网络连接失败，请检查网络连接',
    1002: 'HTTP请求失败，请检查URL是否正确',
    1003: '跨域访问错误，请检查CORS配置',
    1004: '文件未找到，请检查文件路径',
    1005: '服务器内部错误，请稍后重试',
    1006: '请求超时，请检查网络状况',
    1007: '网络连接中断，请重新连接',
    1008: 'SSL证书错误，请检查证书有效性',
    1009: 'DNS解析失败，请检查域名配置',
    1010: '代理服务器错误，请检查代理设置',
    
    // 格式错误
    2001: '无效的PDF文件格式',
    2002: 'PDF文件已损坏或格式不正确',
    2003: '文件头格式错误',
    2004: 'PDF版本不兼容',
    2005: '加密的PDF文件，需要密码',
    2006: '不支持的压缩格式',
    2007: '字体格式错误',
    2008: '图像格式错误',
    2009: '元数据格式错误',
    2010: '书签格式错误',
    
    // 渲染错误
    3001: '页面渲染失败',
    3002: '字体渲染失败',
    3003: '图像渲染失败',
    3004: 'WebGL渲染失败',
    3005: 'Canvas渲染失败',
    3006: '内存不足，无法完成渲染',
    3007: 'GPU加速失败',
    3008: '分辨率过高，无法渲染',
    3009: '不支持的色彩空间',
    3010: '透明度渲染失败',
    
    // 通用错误
    9001: '发生未知错误',
    9002: '权限不足，无法访问资源',
    9003: '内存不足，无法完成操作',
    9004: '参数错误，请检查输入',
    9005: '配置错误，请检查设置',
    9006: '初始化失败',
    9007: '操作超时',
    9008: '资源未找到',
    9009: '状态错误，操作无法执行',
    9010: '不支持的操作'
  };
  
  return errorMap[errorCode] || `未知错误代码: ${errorCode}`;
}

/**
 * 判断错误代码是否属于网络错误
 * @param {number} errorCode - 错误代码
 * @returns {boolean}
 */
export function isNetworkError(errorCode) {
  return errorCode >= 1000 && errorCode < 2000;
}

/**
 * 判断错误代码是否属于格式错误
 * @param {number} errorCode - 错误代码
 * @returns {boolean}
 */
export function isFormatError(errorCode) {
  return errorCode >= 2000 && errorCode < 3000;
}

/**
 * 判断错误代码是否属于渲染错误
 * @param {number} errorCode - 错误代码
 * @returns {boolean}
 */
export function isRenderError(errorCode) {
  return errorCode >= 3000 && errorCode < 4000;
}

/**
 * 判断错误代码是否属于通用错误
 * @param {number} errorCode - 错误代码
 * @returns {boolean}
 */
export function isGeneralError(errorCode) {
  return errorCode >= 9000 && errorCode < 10000;
}

export default {
  NETWORK_ERRORS,
  FORMAT_ERRORS,
  RENDER_ERRORS,
  GENERAL_ERRORS,
  getErrorDescription,
  isNetworkError,
  isFormatError,
  isRenderError,
  isGeneralError
};