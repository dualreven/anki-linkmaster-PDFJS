import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../../common/event/event-bus.js';
import { ScopedEventBus } from '../../../../common/event/scoped-event-bus.js';
import { SearchResultsFeature } from '../index.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

const LAYOUT_KEY = 'pdf-home:search-results:layout';

describe('SearchResultsFeature 布局切换', () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;

  beforeEach(async () => {
    window.localStorage.clear();
    document.body.innerHTML = `
      <div class="main-content">
        <div class="search-results-header">
          <div class="result-count-badge"></div>
        </div>
        <div id="pdf-table-container" class="search-results-container"></div>
      </div>
    `;

    globalEventBus = new EventBus({ moduleName: 'search-results-test', enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, 'search-results-test');

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus
    };

    feature = new SearchResultsFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall();
      feature = null;
    }
    document.body.innerHTML = '';
  });

  it('默认使用单栏布局', () => {
    const container = document.querySelector('#pdf-table-container');
    expect(container.classList.contains('layout-single')).toBe(true);

    const singleBtn = document.querySelector('[data-layout="single"]');
    expect(singleBtn.classList.contains('is-active')).toBe(true);
  });

  it('切换双栏布局时容器类与本地存储更新', () => {
    const container = document.querySelector('#pdf-table-container');
    const doubleBtn = document.querySelector('[data-layout="double"]');

    doubleBtn.click();

    expect(container.classList.contains('layout-double')).toBe(true);
    expect(doubleBtn.classList.contains('is-active')).toBe(true);
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBe('double');
  });

  it('恢复本地存储的三栏布局', async () => {
    await feature.uninstall();
    window.localStorage.setItem(LAYOUT_KEY, 'triple');

    feature = new SearchResultsFeature();
    await feature.install(context);

    const container = document.querySelector('#pdf-table-container');
    expect(container.classList.contains('layout-triple')).toBe(true);

    const tripleBtn = document.querySelector('[data-layout="triple"]');
    expect(tripleBtn.classList.contains('is-active')).toBe(true);
  });
});


