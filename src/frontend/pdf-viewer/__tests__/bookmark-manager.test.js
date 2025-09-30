/**
 * @file BookmarkManager 事件流测试
 */

import { EventBus } from '../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';
import { setCurrentPDFDocument, clearCurrentPDFDocument } from '../pdf/current-document-registry.js';

// 使用真实类，但替换数据提供者
import { BookmarkManager } from '../bookmark/bookmark-manager.js';

describe('BookmarkManager', () => {
  let eventBus;
  let manager;
  let mockProvider;
  let emitted;

  beforeEach(() => {
    emitted = [];
    eventBus = new EventBus({ enableValidation: false, moduleName: 'pdf-viewer' });
    const origEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (evt, data, ctx) => { emitted.push({ evt, data }); return origEmit(evt, data, ctx); };

    mockProvider = {
      getBookmarks: jest.fn(),
      parseDestination: jest.fn()
    };
    manager = new BookmarkManager(eventBus, { dataProvider: mockProvider });
    manager.initialize();
  });

  afterEach(() => {
    clearCurrentPDFDocument();
    manager.destroy();
  });

  test('在文档加载成功后自动加载书签并发布成功事件', async () => {
    setCurrentPDFDocument({});
    mockProvider.getBookmarks.mockResolvedValue([{ id: '0-0', title: 'A', dest: null, items: [], level: 0 }]);

    // 触发文档加载成功
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: 'test' });

    // 等待微任务
    await Promise.resolve();

    const success = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS);
    expect(success).toBeTruthy();
    expect(success.data.count).toBe(1);
  });

  test('无当前文档时发布 EMPTY', async () => {
    clearCurrentPDFDocument();
    eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.LOAD.REQUESTED, {}, { actorId: 'test' });
    await Promise.resolve();
    const empty = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY);
    expect(empty).toBeTruthy();
  });

  test('导航请求触发 NAVIGATION.GOTO 与 NAVIGATE.SUCCESS', async () => {
    setCurrentPDFDocument({});
    mockProvider.parseDestination.mockResolvedValue({ pageNumber: 3, x: 10, y: 20, zoom: null });

    eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED, { bookmark: { dest: ['p3'] } }, { actorId: 'test' });
    await Promise.resolve();

    const gotoEvt = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.NAVIGATION.GOTO);
    const okEvt = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.SUCCESS);
    expect(gotoEvt).toBeTruthy();
    expect(okEvt).toBeTruthy();
    expect(gotoEvt.data.pageNumber).toBe(3);
  });
});

