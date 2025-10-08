import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../../common/event/event-bus.js';
import { ScopedEventBus } from '../../../../common/event/scoped-event-bus.js';
import { PDFSorterFeature } from '../index.js';

const createLoggerStub = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

describe('PDFSorterFeature 排序按钮交互', () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;
  let logger;

  beforeEach(async () => {
    document.body.innerHTML = `
      <header></header>
      <div id="content"></div>
      <div id="pdf-table-container"></div>
      <button id="sort-btn">排序</button>
    `;

    globalEventBus = new EventBus({ moduleName: 'TestBus', enableValidation: true, enableTracing: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, 'pdf-sorter-test');
    logger = createLoggerStub();

    feature = new PDFSorterFeature();
    context = {
      container: null,
      globalEventBus,
      scopedEventBus,
      logger,
      config: {}
    };

    await feature.install(context);
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall(context);
      feature = null;
    }
    document.body.innerHTML = '';
  });

  it('接收到 search:sort:requested 事件时应展示排序面板', () => {
    const panel = document.querySelector('.sorter-panel');
    expect(panel).toBeTruthy();
    expect(panel.classList.contains('active')).toBe(false);

    globalEventBus.emit('search:sort:requested');

    expect(panel.classList.contains('active')).toBe(true);

    const multiSortContainer = panel.querySelector('.sorter-multi-sort-container');
    expect(multiSortContainer.style.display).toBe('block');
  });

  it('接收到 header:sort:requested 事件时应展示排序面板', () => {
    const panel = document.querySelector('.sorter-panel');
    expect(panel).toBeTruthy();
    expect(panel.classList.contains('active')).toBe(false);

    globalEventBus.emit('header:sort:requested');

    expect(panel.classList.contains('active')).toBe(true);
  });
});
