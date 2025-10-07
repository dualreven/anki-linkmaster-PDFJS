/**
 * URLNavigationFeature集成测试
 * @file url-navigation-feature.test.js
 */

import { URLNavigationFeature } from '../index.js';
import { SimpleDependencyContainer } from '../../../container/simple-dependency-container.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

describe('URLNavigationFeature', () => {
  let feature;
  let container;
  let mockEventBus;
  let originalLocation;

  beforeEach(() => {
    // 保存原始location
    originalLocation = window.location;

    // 创建mock EventBus
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
    };

    // 创建容器并注册依赖
    container = new SimpleDependencyContainer();
    container.register('eventBus', mockEventBus);

    // 创建Feature实例
    feature = new URLNavigationFeature();

    // Mock window.location - 删除并重新定义
    delete window.location;
    window.location = {
      href: 'http://localhost:3000/',
      search: '',
      hash: '',
      pathname: '/',
      hostname: 'localhost',
      port: '3000',
      protocol: 'http:',
    };
  });

  afterEach(() => {
    // 恢复原始location
    window.location = originalLocation;
    jest.clearAllMocks();
  });

  describe('Feature基本信息', () => {
    test('应该正确定义Feature名称', () => {
      expect(feature.name).toBe('url-navigation');
    });

    test('应该正确定义版本号', () => {
      expect(feature.version).toBe('1.0.0');
    });

    test('应该正确定义依赖项', () => {
      expect(feature.dependencies).toEqual(['app-core', 'pdf-manager']);
    });
  });

  describe('Feature生命周期', () => {
    test('应该成功安装Feature（无URL参数）', async () => {
      window.location.href = 'http://localhost:3000/';
      window.location.search = '';

      await expect(feature.install(container)).resolves.not.toThrow();

      // 验证EventBus监听器被注册
      expect(mockEventBus.on).toHaveBeenCalled();
    });

    test('应该成功安装Feature（有URL参数）', async () => {
      window.location.href = 'http://localhost:3000/?pdf-id=sample&page-at=5';
      window.location.search = '?pdf-id=sample&page-at=5';

      await expect(feature.install(container)).resolves.not.toThrow();

      // 验证发出PARSED事件
      const emitCalls = mockEventBus.emit.mock.calls;
      const parsedEvent = emitCalls.find(
        (call) => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED
      );
      expect(parsedEvent).toBeDefined();
      expect(parsedEvent[1]).toMatchObject({
        pdfId: 'sample',
        pageAt: 5,
      });
    });

    test('应该正确卸载Feature', async () => {
      window.location.href = 'http://localhost:3000/';
      window.location.search = '';

      await feature.install(container);
      await expect(feature.uninstall()).resolves.not.toThrow();
    });

    test('安装时缺少EventBus应该抛出错误', async () => {
      const emptyContainer = new SimpleDependencyContainer();

      await expect(feature.install(emptyContainer)).rejects.toThrow('EventBus未在容器中注册');
    });
  });

  describe('URL参数处理', () => {
    test('应该监听FILE.LOAD.SUCCESS事件', async () => {
      window.location.href = 'http://localhost:3000/?pdf-id=test&page-at=5';
      window.location.search = '?pdf-id=test&page-at=5';

      await feature.install(container);

      const onCalls = mockEventBus.on.mock.calls;
      const hasFileLoadListener = onCalls.some(
        (call) => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS
      );

      expect(hasFileLoadListener).toBe(true);
    });

    test('应该监听FILE.LOAD.FAILED事件', async () => {
      window.location.href = 'http://localhost:3000/?pdf-id=test';
      window.location.search = '?pdf-id=test';

      await feature.install(container);

      const onCalls = mockEventBus.on.mock.calls;
      const hasFileLoadFailedListener = onCalls.some(
        (call) => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.FAILED
      );

      expect(hasFileLoadFailedListener).toBe(true);
    });

    test('应该监听URL_PARAMS.REQUESTED事件', async () => {
      await feature.install(container);

      const onCalls = mockEventBus.on.mock.calls;
      const hasRequestedListener = onCalls.some(
        (call) => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED
      );

      expect(hasRequestedListener).toBe(true);
    });

    test('有pdf-id参数时应该触发PDF加载', async () => {
      window.location.href = 'http://localhost:3000/?pdf-id=sample';
      window.location.search = '?pdf-id=sample';

      await feature.install(container);

      const emitCalls = mockEventBus.emit.mock.calls;
      const loadRequestEvent = emitCalls.find(
        (call) => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED
      );

      expect(loadRequestEvent).toBeDefined();
      expect(loadRequestEvent[1]).toMatchObject({
        filename: 'sample',
        source: 'url-navigation',
      });
    });

    test('无URL参数时不应该触发PDF加载', async () => {
      window.location.href = 'http://localhost:3000/';
      window.location.search = '';

      await feature.install(container);

      const emitCalls = mockEventBus.emit.mock.calls;
      const loadRequestEvent = emitCalls.find(
        (call) => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED
      );

      expect(loadRequestEvent).toBeUndefined();
    });

    test('无效的URL参数应该发出FAILED事件', async () => {
      window.location.href = 'http://localhost:3000/?pdf-id=&page-at=abc';
      window.location.search = '?pdf-id=&page-at=abc';

      await feature.install(container);

      const emitCalls = mockEventBus.emit.mock.calls;
      const failedEvent = emitCalls.find(
        (call) => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED
      );

      expect(failedEvent).toBeDefined();
      expect(failedEvent[1].stage).toBe('parse');
    });
  });

  describe('事件处理', () => {
    test('Feature信息应该包含正确的元数据', () => {
      expect(feature.name).toBe('url-navigation');
      expect(feature.version).toBe('1.0.0');
      expect(feature.dependencies).toContain('app-core');
      expect(feature.dependencies).toContain('pdf-manager');
    });
  });

  describe('边界情况', () => {
    test('未安装直接卸载不应该抛出错误', async () => {
      await expect(feature.uninstall()).resolves.not.toThrow();
    });
  });
});
