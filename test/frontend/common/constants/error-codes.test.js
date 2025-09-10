/**
 * @file 错误代码测试
 * @module ErrorCodesTest
 * @description 测试错误代码体系的功能，包括错误描述和错误类型判断
 */

import { describe, it, expect } from '@jest/globals';
import {
  NETWORK_ERRORS,
  FORMAT_ERRORS,
  RENDER_ERRORS,
  GENERAL_ERRORS,
  getErrorDescription,
  isNetworkError,
  isFormatError,
  isRenderError,
  isGeneralError
} from '../../../../src/frontend/common/constants/error-codes.js';

describe('ErrorCodes', () => {
  describe('错误代码常量', () => {
    it('应该定义网络错误代码', () => {
      // 验证结果
      expect(NETWORK_ERRORS.NETWORK_CONNECTION_FAILED).toBe(1001);
      expect(NETWORK_ERRORS.HTTP_REQUEST_FAILED).toBe(1002);
      expect(NETWORK_ERRORS.CORS_ERROR).toBe(1003);
      expect(NETWORK_ERRORS.FILE_NOT_FOUND).toBe(1004);
      expect(NETWORK_ERRORS.SERVER_ERROR).toBe(1005);
      expect(NETWORK_ERRORS.REQUEST_TIMEOUT).toBe(1006);
      expect(NETWORK_ERRORS.NETWORK_DISCONNECTED).toBe(1007);
      expect(NETWORK_ERRORS.SSL_CERTIFICATE_ERROR).toBe(1008);
      expect(NETWORK_ERRORS.DNS_RESOLUTION_FAILED).toBe(1009);
      expect(NETWORK_ERRORS.PROXY_ERROR).toBe(1010);
    });

    it('应该定义格式错误代码', () => {
      // 验证结果
      expect(FORMAT_ERRORS.INVALID_PDF_FORMAT).toBe(2001);
      expect(FORMAT_ERRORS.CORRUPTED_PDF).toBe(2002);
      expect(FORMAT_ERRORS.INVALID_FILE_HEADER).toBe(2003);
      expect(FORMAT_ERRORS.VERSION_INCOMPATIBLE).toBe(2004);
      expect(FORMAT_ERRORS.ENCRYPTED_PDF).toBe(2005);
      expect(FORMAT_ERRORS.UNSUPPORTED_COMPRESSION).toBe(2006);
      expect(FORMAT_ERRORS.FONT_FORMAT_ERROR).toBe(2007);
      expect(FORMAT_ERRORS.IMAGE_FORMAT_ERROR).toBe(2008);
      expect(FORMAT_ERRORS.METADATA_FORMAT_ERROR).toBe(2009);
      expect(FORMAT_ERRORS.BOOKMARK_FORMAT_ERROR).toBe(2010);
    });

    it('应该定义渲染错误代码', () => {
      // 验证结果
      expect(RENDER_ERRORS.PAGE_RENDER_FAILED).toBe(3001);
      expect(RENDER_ERRORS.FONT_RENDER_FAILED).toBe(3002);
      expect(RENDER_ERRORS.IMAGE_RENDER_FAILED).toBe(3003);
      expect(RENDER_ERRORS.WEBGL_RENDER_FAILED).toBe(3004);
      expect(RENDER_ERRORS.CANVAS_RENDER_FAILED).toBe(3005);
      expect(RENDER_ERRORS.MEMORY_RENDER_FAILED).toBe(3006);
      expect(RENDER_ERRORS.GPU_ACCELERATION_FAILED).toBe(3007);
      expect(RENDER_ERRORS.HIGH_RESOLUTION_RENDER_FAILED).toBe(3008);
      expect(RENDER_ERRORS.COLOR_SPACE_UNSUPPORTED).toBe(3009);
      expect(RENDER_ERRORS.TRANSPARENCY_RENDER_FAILED).toBe(3010);
    });

    it('应该定义通用错误代码', () => {
      // 验证结果
      expect(GENERAL_ERRORS.UNKNOWN_ERROR).toBe(9001);
      expect(GENERAL_ERRORS.PERMISSION_ERROR).toBe(9002);
      expect(GENERAL_ERRORS.MEMORY_ERROR).toBe(9003);
      expect(GENERAL_ERRORS.PARAMETER_ERROR).toBe(9004);
      expect(GENERAL_ERRORS.CONFIGURATION_ERROR).toBe(9005);
      expect(GENERAL_ERRORS.INITIALIZATION_FAILED).toBe(9006);
      expect(GENERAL_ERRORS.OPERATION_TIMEOUT).toBe(9007);
      expect(GENERAL_ERRORS.RESOURCE_NOT_FOUND).toBe(9008);
      expect(GENERAL_ERRORS.STATE_ERROR).toBe(9009);
      expect(GENERAL_ERRORS.UNSUPPORTED_OPERATION).toBe(9010);
    });
  });

  describe('错误描述获取', () => {
    it('应该返回网络错误的描述', () => {
      // 验证结果
      expect(getErrorDescription(NETWORK_ERRORS.NETWORK_CONNECTION_FAILED))
        .toBe('网络连接失败，请检查网络连接');
      expect(getErrorDescription(NETWORK_ERRORS.HTTP_REQUEST_FAILED))
        .toBe('HTTP请求失败，请检查URL是否正确');
      expect(getErrorDescription(NETWORK_ERRORS.CORS_ERROR))
        .toBe('跨域访问错误，请检查CORS配置');
      expect(getErrorDescription(NETWORK_ERRORS.FILE_NOT_FOUND))
        .toBe('文件未找到，请检查文件路径');
      expect(getErrorDescription(NETWORK_ERRORS.SERVER_ERROR))
        .toBe('服务器内部错误，请稍后重试');
      expect(getErrorDescription(NETWORK_ERRORS.REQUEST_TIMEOUT))
        .toBe('请求超时，请检查网络状况');
      expect(getErrorDescription(NETWORK_ERRORS.NETWORK_DISCONNECTED))
        .toBe('网络连接中断，请重新连接');
      expect(getErrorDescription(NETWORK_ERRORS.SSL_CERTIFICATE_ERROR))
        .toBe('SSL证书错误，请检查证书有效性');
      expect(getErrorDescription(NETWORK_ERRORS.DNS_RESOLUTION_FAILED))
        .toBe('DNS解析失败，请检查域名配置');
      expect(getErrorDescription(NETWORK_ERRORS.PROXY_ERROR))
        .toBe('代理服务器错误，请检查代理设置');
    });

    it('应该返回格式错误的描述', () => {
      // 验证结果
      expect(getErrorDescription(FORMAT_ERRORS.INVALID_PDF_FORMAT))
        .toBe('无效的PDF文件格式');
      expect(getErrorDescription(FORMAT_ERRORS.CORRUPTED_PDF))
        .toBe('PDF文件已损坏或格式不正确');
      expect(getErrorDescription(FORMAT_ERRORS.INVALID_FILE_HEADER))
        .toBe('文件头格式错误');
      expect(getErrorDescription(FORMAT_ERRORS.VERSION_INCOMPATIBLE))
        .toBe('PDF版本不兼容');
      expect(getErrorDescription(FORMAT_ERRORS.ENCRYPTED_PDF))
        .toBe('加密的PDF文件，需要密码');
      expect(getErrorDescription(FORMAT_ERRORS.UNSUPPORTED_COMPRESSION))
        .toBe('不支持的压缩格式');
      expect(getErrorDescription(FORMAT_ERRORS.FONT_FORMAT_ERROR))
        .toBe('字体格式错误');
      expect(getErrorDescription(FORMAT_ERRORS.IMAGE_FORMAT_ERROR))
        .toBe('图像格式错误');
      expect(getErrorDescription(FORMAT_ERRORS.METADATA_FORMAT_ERROR))
        .toBe('元数据格式错误');
      expect(getErrorDescription(FORMAT_ERRORS.BOOKMARK_FORMAT_ERROR))
        .toBe('书签格式错误');
    });

    it('应该返回渲染错误的描述', () => {
      // 验证结果
      expect(getErrorDescription(RENDER_ERRORS.PAGE_RENDER_FAILED))
        .toBe('页面渲染失败');
      expect(getErrorDescription(RENDER_ERRORS.FONT_RENDER_FAILED))
        .toBe('字体渲染失败');
      expect(getErrorDescription(RENDER_ERRORS.IMAGE_RENDER_FAILED))
        .toBe('图像渲染失败');
      expect(getErrorDescription(RENDER_ERRORS.WEBGL_RENDER_FAILED))
        .toBe('WebGL渲染失败');
      expect(getErrorDescription(RENDER_ERRORS.CANVAS_RENDER_FAILED))
        .toBe('Canvas渲染失败');
      expect(getErrorDescription(RENDER_ERRORS.MEMORY_RENDER_FAILED))
        .toBe('内存不足，无法完成渲染');
      expect(getErrorDescription(RENDER_ERRORS.GPU_ACCELERATION_FAILED))
        .toBe('GPU加速失败');
      expect(getErrorDescription(RENDER_ERRORS.HIGH_RESOLUTION_RENDER_FAILED))
        .toBe('分辨率过高，无法渲染');
      expect(getErrorDescription(RENDER_ERRORS.COLOR_SPACE_UNSUPPORTED))
        .toBe('不支持的色彩空间');
      expect(getErrorDescription(RENDER_ERRORS.TRANSPARENCY_RENDER_FAILED))
        .toBe('透明度渲染失败');
    });

    it('应该返回通用错误的描述', () => {
      // 验证结果
      expect(getErrorDescription(GENERAL_ERRORS.UNKNOWN_ERROR))
        .toBe('发生未知错误');
      expect(getErrorDescription(GENERAL_ERRORS.PERMISSION_ERROR))
        .toBe('权限不足，无法访问资源');
      expect(getErrorDescription(GENERAL_ERRORS.MEMORY_ERROR))
        .toBe('内存不足，无法完成操作');
      expect(getErrorDescription(GENERAL_ERRORS.PARAMETER_ERROR))
        .toBe('参数错误，请检查输入');
      expect(getErrorDescription(GENERAL_ERRORS.CONFIGURATION_ERROR))
        .toBe('配置错误，请检查设置');
      expect(getErrorDescription(GENERAL_ERRORS.INITIALIZATION_FAILED))
        .toBe('初始化失败');
      expect(getErrorDescription(GENERAL_ERRORS.OPERATION_TIMEOUT))
        .toBe('操作超时');
      expect(getErrorDescription(GENERAL_ERRORS.RESOURCE_NOT_FOUND))
        .toBe('资源未找到');
      expect(getErrorDescription(GENERAL_ERRORS.STATE_ERROR))
        .toBe('状态错误，操作无法执行');
      expect(getErrorDescription(GENERAL_ERRORS.UNSUPPORTED_OPERATION))
        .toBe('不支持的操作');
    });

    it('应该为未知错误代码返回默认描述', () => {
      // 验证结果
      expect(getErrorDescription(9999)).toBe('未知错误代码: 9999');
      expect(getErrorDescription(0)).toBe('未知错误代码: 0');
      expect(getErrorDescription(-1)).toBe('未知错误代码: -1');
    });
  });

  describe('错误类型判断', () => {
    it('应该正确判断网络错误', () => {
      // 验证结果
      expect(isNetworkError(NETWORK_ERRORS.NETWORK_CONNECTION_FAILED)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.HTTP_REQUEST_FAILED)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.CORS_ERROR)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.FILE_NOT_FOUND)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.SERVER_ERROR)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.REQUEST_TIMEOUT)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.NETWORK_DISCONNECTED)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.SSL_CERTIFICATE_ERROR)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.DNS_RESOLUTION_FAILED)).toBe(true);
      expect(isNetworkError(NETWORK_ERRORS.PROXY_ERROR)).toBe(true);
      
      // 边界值测试
      expect(isNetworkError(1000)).toBe(false);
      expect(isNetworkError(1999)).toBe(false);
      expect(isNetworkError(2000)).toBe(false);
    });

    it('应该正确判断格式错误', () => {
      // 验证结果
      expect(isFormatError(FORMAT_ERRORS.INVALID_PDF_FORMAT)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.CORRUPTED_PDF)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.INVALID_FILE_HEADER)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.VERSION_INCOMPATIBLE)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.ENCRYPTED_PDF)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.UNSUPPORTED_COMPRESSION)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.FONT_FORMAT_ERROR)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.IMAGE_FORMAT_ERROR)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.METADATA_FORMAT_ERROR)).toBe(true);
      expect(isFormatError(FORMAT_ERRORS.BOOKMARK_FORMAT_ERROR)).toBe(true);
      
      // 边界值测试
      expect(isFormatError(1999)).toBe(false);
      expect(isFormatError(2000)).toBe(false);
      expect(isFormatError(2999)).toBe(false);
      expect(isFormatError(3000)).toBe(false);
    });

    it('应该正确判断渲染错误', () => {
      // 验证结果
      expect(isRenderError(RENDER_ERRORS.PAGE_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.FONT_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.IMAGE_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.WEBGL_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.CANVAS_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.MEMORY_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.GPU_ACCELERATION_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.HIGH_RESOLUTION_RENDER_FAILED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.COLOR_SPACE_UNSUPPORTED)).toBe(true);
      expect(isRenderError(RENDER_ERRORS.TRANSPARENCY_RENDER_FAILED)).toBe(true);
      
      // 边界值测试
      expect(isRenderError(2999)).toBe(false);
      expect(isRenderError(3000)).toBe(false);
      expect(isRenderError(3999)).toBe(false);
      expect(isRenderError(4000)).toBe(false);
    });

    it('应该正确判断通用错误', () => {
      // 验证结果
      expect(isGeneralError(GENERAL_ERRORS.UNKNOWN_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.PERMISSION_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.MEMORY_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.PARAMETER_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.CONFIGURATION_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.INITIALIZATION_FAILED)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.OPERATION_TIMEOUT)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.RESOURCE_NOT_FOUND)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.STATE_ERROR)).toBe(true);
      expect(isGeneralError(GENERAL_ERRORS.UNSUPPORTED_OPERATION)).toBe(true);
      
      // 边界值测试
      expect(isGeneralError(8999)).toBe(false);
      expect(isGeneralError(9000)).toBe(false);
      expect(isGeneralError(9999)).toBe(false);
      expect(isGeneralError(10000)).toBe(false);
    });
  });
});