/**
 * PDF-Viewer 事件常量测试文件
 * @file 测试 PDF-Viewer 事件常量的正确性和完整性
 * @module PDFViewerEventsTest
 */

import { PDF_VIEWER_EVENTS } from '../../../../src/frontend/common/event/pdf-viewer-constants.js';

/**
 * 测试 PDF-Viewer 事件常量
 */
describe('PDF-Viewer 事件常量测试', () => {
  
  /**
   * 测试事件常量结构完整性
   */
  test('事件常量结构完整性', () => {
    expect(PDF_VIEWER_EVENTS).toBeDefined();
    expect(typeof PDF_VIEWER_EVENTS).toBe('object');
    
    // 检查主要命名空间
    expect(PDF_VIEWER_EVENTS.FILE).toBeDefined();
    expect(PDF_VIEWER_EVENTS.NAVIGATION).toBeDefined();
    expect(PDF_VIEWER_EVENTS.ZOOM).toBeDefined();
    expect(PDF_VIEWER_EVENTS.RENDER).toBeDefined();
    expect(PDF_VIEWER_EVENTS.TEXT).toBeDefined();
    expect(PDF_VIEWER_EVENTS.BOOKMARK).toBeDefined();
    expect(PDF_VIEWER_EVENTS.UI).toBeDefined();
    expect(PDF_VIEWER_EVENTS.STATE).toBeDefined();
  });

  /**
   * 测试文件操作事件常量
   */
  test('文件操作事件常量', () => {
    const { FILE } = PDF_VIEWER_EVENTS;
    
    expect(FILE.LOAD.REQUESTED).toBe('pdf-viewer:file:load:requested');
    expect(FILE.LOAD.SUCCESS).toBe('pdf-viewer:file:load:success');
    expect(FILE.LOAD.FAILED).toBe('pdf-viewer:file:load:failed');
    expect(FILE.LOAD.PROGRESS).toBe('pdf-viewer:file:load:progress');
    expect(FILE.CLOSE).toBe('pdf-viewer:file:close');
    expect(FILE.INFO_REQUESTED).toBe('pdf-viewer:file:info:requested');
    expect(FILE.INFO_RESPONSE).toBe('pdf-viewer:file:info:response');
    
    // 验证事件名称格式
    expect(FILE.LOAD.REQUESTED).toMatch(/^pdf-viewer:file:load:requested$/);
    expect(FILE.CLOSE).toMatch(/^pdf-viewer:file:close$/);
  });

  /**
   * 测试页面导航事件常量
   */
  test('页面导航事件常量', () => {
    const { NAVIGATION } = PDF_VIEWER_EVENTS;
    
    expect(NAVIGATION.PREVIOUS).toBe('pdf-viewer:navigation:previous');
    expect(NAVIGATION.NEXT).toBe('pdf-viewer:navigation:next');
    expect(NAVIGATION.GOTO).toBe('pdf-viewer:navigation:goto');
    expect(NAVIGATION.CHANGED).toBe('pdf-viewer:navigation:changed');
    expect(NAVIGATION.TOTAL_PAGES_UPDATED).toBe('pdf-viewer:navigation:total-pages-updated');
  });

  /**
   * 测试缩放控制事件常量
   */
  test('缩放控制事件常量', () => {
    const { ZOOM } = PDF_VIEWER_EVENTS;
    
    expect(ZOOM.IN).toBe('pdf-viewer:zoom:in');
    expect(ZOOM.OUT).toBe('pdf-viewer:zoom:out');
    expect(ZOOM.FIT_WIDTH).toBe('pdf-viewer:zoom:fit-width');
    expect(ZOOM.FIT_HEIGHT).toBe('pdf-viewer:zoom:fit-height');
    expect(ZOOM.ACTUAL_SIZE).toBe('pdf-viewer:zoom:actual-size');
    expect(ZOOM.CHANGED).toBe('pdf-viewer:zoom:changed');
  });

  /**
   * 测试视图渲染事件常量
   */
  test('视图渲染事件常量', () => {
    const { RENDER } = PDF_VIEWER_EVENTS;
    
    expect(RENDER.PAGE_REQUESTED).toBe('pdf-viewer:render:page:requested');
    expect(RENDER.PAGE_COMPLETED).toBe('pdf-viewer:render:page:completed');
    expect(RENDER.PAGE_FAILED).toBe('pdf-viewer:render:page:failed');
    expect(RENDER.QUALITY_CHANGED).toBe('pdf-viewer:render:quality:changed');
  });

  /**
   * 测试文本操作事件常量
   */
  test('文本操作事件常量', () => {
    const { TEXT } = PDF_VIEWER_EVENTS;
    
    expect(TEXT.SELECTED).toBe('pdf-viewer:text:selected');
    expect(TEXT.SEARCH_REQUESTED).toBe('pdf-viewer:text:search:requested');
    expect(TEXT.SEARCH_RESULT).toBe('pdf-viewer:text:search:result');
    expect(TEXT.SEARCH_COMPLETED).toBe('pdf-viewer:text:search:completed');
  });

  /**
   * 测试书签事件常量
   */
  test('书签事件常量', () => {
    const { BOOKMARK } = PDF_VIEWER_EVENTS;
    
    expect(BOOKMARK.ADD).toBe('pdf-viewer:bookmark:add');
    expect(BOOKMARK.REMOVE).toBe('pdf-viewer:bookmark:remove');
    expect(BOOKMARK.GOTO).toBe('pdf-viewer:bookmark:goto');
    expect(BOOKMARK.LIST_UPDATED).toBe('pdf-viewer:bookmark:list:updated');
  });

  /**
   * 测试UI控制事件常量
   */
  test('UI控制事件常量', () => {
    const { UI } = PDF_VIEWER_EVENTS;
    
    expect(UI.TOOLBAR_TOGGLE).toBe('pdf-viewer:ui:toolbar:toggle');
    expect(UI.SIDEBAR_TOGGLE).toBe('pdf-viewer:ui:sidebar:toggle');
    expect(UI.THUMBNAIL_TOGGLE).toBe('pdf-viewer:ui:thumbnail:toggle');
    expect(UI.FULLSCREEN_TOGGLE).toBe('pdf-viewer:ui:fullscreen:toggle');
  });

  /**
   * 测试应用状态事件常量
   */
  test('应用状态事件常量', () => {
    const { STATE } = PDF_VIEWER_EVENTS;
    
    expect(STATE.INITIALIZED).toBe('pdf-viewer:state:initialized');
    expect(STATE.DESTROYED).toBe('pdf-viewer:state:destroyed');
    expect(STATE.ERROR).toBe('pdf-viewer:state:error');
    expect(STATE.LOADING).toBe('pdf-viewer:state:loading');
  });

  /**
   * 测试事件名称唯一性
   */
  test('事件名称唯一性', () => {
    const allEvents = new Set();
    
    // 收集所有事件名称
    const collectEvents = (obj) => {
      if (typeof obj === 'string') {
        allEvents.add(obj);
        return;
      }
      if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(collectEvents);
      }
    };
    
    collectEvents(PDF_VIEWER_EVENTS);
    
    // 验证所有事件名称都是唯一的
    const eventArray = Array.from(allEvents);
    const uniqueEvents = new Set(eventArray);
    
    expect(eventArray.length).toBe(uniqueEvents.size);
    
    // 验证事件数量（根据定义的事件总数）
    expect(eventArray.length).toBe(35); // 当前定义的事件总数
  });

  /**
   * 测试事件名称格式规范
   */
  test('事件名称格式规范', () => {
    const allEvents = new Set();
    
    const collectEvents = (obj) => {
      if (typeof obj === 'string') {
        allEvents.add(obj);
        return;
      }
      if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(collectEvents);
      }
    };
    
    collectEvents(PDF_VIEWER_EVENTS);
    
    // 验证所有事件名称都符合命名规范
    Array.from(allEvents).forEach(eventName => {
      expect(eventName).toMatch(/^pdf-viewer:[a-z-]+:[a-z-]+(:[a-z-]+)*$/);
      expect(eventName).not.toMatch(/[A-Z]/); // 不允许大写字母
      expect(eventName).not.toMatch(/\s/);    // 不允许空格
    });
  });
});