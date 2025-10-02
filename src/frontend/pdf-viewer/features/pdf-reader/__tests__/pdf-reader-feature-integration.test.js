/**
 * @file PDFReaderFeature架构集成测试
 * @description 测试StateManager、ScopedEventBus和服务生命周期的集成
 * @note 由于Jest对动态导入的限制，此测试主要验证配置和架构设计
 */

import { describe, it, expect } from '@jest/globals';
import { PDFReaderFeatureConfig } from '../feature.config.js';

describe('PDFReaderFeature架构集成测试', () => {

  describe('功能配置验证', () => {
    it('应该定义正确的功能名称', () => {
      expect(PDFReaderFeatureConfig.name).toBe('pdf-reader');
    });

    it('应该定义正确的版本号', () => {
      expect(PDFReaderFeatureConfig.version).toBe('1.0.0');
    });

    it('应该定义依赖列表', () => {
      expect(Array.isArray(PDFReaderFeatureConfig.dependencies)).toBe(true);
    });

    it('应该包含功能描述', () => {
      expect(PDFReaderFeatureConfig.description).toBeDefined();
      expect(typeof PDFReaderFeatureConfig.description).toBe('string');
    });

    it('应该定义功能能力列表', () => {
      expect(Array.isArray(PDFReaderFeatureConfig.capabilities)).toBe(true);
      expect(PDFReaderFeatureConfig.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('状态结构验证', () => {
    it('应该定义完整的状态结构', () => {
      const stateSchema = PDFReaderFeatureConfig.stateSchema;

      expect(stateSchema).toHaveProperty('currentFile');
      expect(stateSchema).toHaveProperty('pdfDocument');
      expect(stateSchema).toHaveProperty('currentPage');
      expect(stateSchema).toHaveProperty('totalPages');
      expect(stateSchema).toHaveProperty('zoomLevel');
      expect(stateSchema).toHaveProperty('loadingStatus');
      expect(stateSchema).toHaveProperty('pageCache');
    });

    it('状态初始值应该正确', () => {
      const stateSchema = PDFReaderFeatureConfig.stateSchema;

      expect(stateSchema.currentFile).toBe(null);
      expect(stateSchema.pdfDocument).toBe(null);
      expect(stateSchema.currentPage).toBe(1);
      expect(stateSchema.totalPages).toBe(0);
      expect(stateSchema.zoomLevel).toBe(1.0);
    });

    it('加载状态结构应该完整', () => {
      const loadingStatus = PDFReaderFeatureConfig.stateSchema.loadingStatus;

      expect(loadingStatus).toHaveProperty('isLoading');
      expect(loadingStatus).toHaveProperty('progress');
      expect(loadingStatus).toHaveProperty('error');
      expect(loadingStatus.isLoading).toBe(false);
      expect(loadingStatus.progress).toBe(0);
      expect(loadingStatus.error).toBe(null);
    });

    it('页面缓存配置应该合理', () => {
      const pageCache = PDFReaderFeatureConfig.stateSchema.pageCache;

      expect(pageCache).toHaveProperty('maxSize');
      expect(pageCache).toHaveProperty('cachedPages');
      expect(pageCache.maxSize).toBe(10);
      expect(Array.isArray(pageCache.cachedPages)).toBe(true);
    });
  });

  describe('事件定义验证', () => {
    it('应该定义事件配置对象', () => {
      expect(PDFReaderFeatureConfig.events).toBeDefined();
      expect(typeof PDFReaderFeatureConfig.events).toBe('object');
    });

    it('文件加载事件应该有正确的命名空间', () => {
      const events = PDFReaderFeatureConfig.events;
      expect(events.FILE_LOAD_REQUESTED).toBe('@pdf-reader/file:load:requested');
      expect(events.FILE_LOAD_STARTED).toBe('@pdf-reader/file:load:started');
      expect(events.FILE_LOAD_PROGRESS).toBe('@pdf-reader/file:load:progress');
      expect(events.FILE_LOAD_SUCCESS).toBe('@pdf-reader/file:load:success');
      expect(events.FILE_LOAD_ERROR).toBe('@pdf-reader/file:load:error');
    });

    it('页面导航事件应该有正确的命名空间', () => {
      const events = PDFReaderFeatureConfig.events;
      expect(events.PAGE_CHANGE_REQUESTED).toBe('@pdf-reader/page:change:requested');
      expect(events.PAGE_CHANGED).toBe('@pdf-reader/page:changed');
      expect(events.PAGE_RENDER_START).toBe('@pdf-reader/page:render:start');
      expect(events.PAGE_RENDER_SUCCESS).toBe('@pdf-reader/page:render:success');
      expect(events.PAGE_RENDER_ERROR).toBe('@pdf-reader/page:render:error');
    });

    it('缩放事件应该有正确的命名空间', () => {
      const events = PDFReaderFeatureConfig.events;
      expect(events.ZOOM_CHANGE_REQUESTED).toBe('@pdf-reader/zoom:change:requested');
      expect(events.ZOOM_CHANGED).toBe('@pdf-reader/zoom:changed');
    });

    it('所有事件都应该以@pdf-reader/开头', () => {
      const events = PDFReaderFeatureConfig.events;
      Object.values(events).forEach(eventName => {
        expect(eventName).toMatch(/^@pdf-reader\//);
      });
    });
  });

  describe('服务定义验证', () => {
    it('应该定义所有必要的服务', () => {
      expect(PDFReaderFeatureConfig.services).toBeDefined();
      expect(PDFReaderFeatureConfig.services.pdfLoader).toBe('pdf-loader-service');
      expect(PDFReaderFeatureConfig.services.documentManager).toBe('pdf-document-manager');
      expect(PDFReaderFeatureConfig.services.pageRenderer).toBe('pdf-page-renderer');
      expect(PDFReaderFeatureConfig.services.pageCacheManager).toBe('pdf-page-cache-manager');
    });
  });

  describe('元数据验证', () => {
    it('应该包含完整的元数据信息', () => {
      expect(PDFReaderFeatureConfig.metadata).toBeDefined();
      expect(PDFReaderFeatureConfig.metadata.author).toBe('Anki-Linkmaster Team');
      expect(PDFReaderFeatureConfig.metadata.phase).toBe('Phase 1');
      expect(PDFReaderFeatureConfig.metadata.priority).toBe('high');
      expect(PDFReaderFeatureConfig.metadata.createdAt).toBe('2025-10-02');
      expect(PDFReaderFeatureConfig.metadata.updatedAt).toBe('2025-10-02');
    });
  });

  describe('架构集成设计验证', () => {
    it('状态结构应该支持StateManager集成', () => {
      // StateManager需要状态结构是普通对象
      const stateSchema = PDFReaderFeatureConfig.stateSchema;
      expect(typeof stateSchema).toBe('object');
      expect(stateSchema).not.toBe(null);
    });

    it('事件命名应该支持ScopedEventBus隔离', () => {
      // 所有事件都应该有@pdf-reader/前缀，支持作用域隔离
      const events = PDFReaderFeatureConfig.events;
      const allEventsHaveNamespace = Object.values(events).every(
        eventName => typeof eventName === 'string' && eventName.startsWith('@pdf-reader/')
      );
      expect(allEventsHaveNamespace).toBe(true);
    });

    it('服务定义应该支持DependencyContainer注册', () => {
      // 服务名称应该是字符串，可以作为容器的键
      const services = PDFReaderFeatureConfig.services;
      Object.values(services).forEach(serviceName => {
        expect(typeof serviceName).toBe('string');
        expect(serviceName.length).toBeGreaterThan(0);
      });
    });

    it('配置应该遵循IFeature接口约定', () => {
      // 必需的IFeature元数据
      expect(PDFReaderFeatureConfig.name).toBeDefined();
      expect(PDFReaderFeatureConfig.version).toBeDefined();
      expect(PDFReaderFeatureConfig.dependencies).toBeDefined();

      // 类型验证
      expect(typeof PDFReaderFeatureConfig.name).toBe('string');
      expect(typeof PDFReaderFeatureConfig.version).toBe('string');
      expect(Array.isArray(PDFReaderFeatureConfig.dependencies)).toBe(true);
    });
  });
});
