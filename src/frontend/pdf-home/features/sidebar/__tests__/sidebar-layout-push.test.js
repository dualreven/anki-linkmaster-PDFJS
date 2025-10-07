/**
 * 测试：侧边栏展开时推开右侧搜索结果区域，避免遮挡
 * 说明：
 * - 初始渲染应根据当前状态（默认未折叠）推开 .main-content
 * - 点击折叠按钮后恢复 .main-content 的宽度与边距
 * - 再次点击展开按钮后再次推开 .main-content
 */

import { SidebarContainer } from '../components/sidebar-container.js';

// 构造最小 logger 与 eventBus 桩对象
const logger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const eventBus = {
  emit: jest.fn(),
  on: jest.fn(() => () => {})
};

function setupDOM() {
  document.body.innerHTML = `
    <div class="layout-container">
      <aside id="sidebar" class="sidebar"></aside>
      <div class="main-content">
        <div id="pdf-table-container"></div>
      </div>
    </div>
  `;
}

describe('Sidebar 展开时推开主内容区域', () => {
  beforeEach(() => {
    // 每次测试前重置 DOM
    setupDOM();
    jest.clearAllMocks();
  });

  test('初次渲染：未折叠时应推开 main-content', () => {
    const sidebarEl = document.getElementById('sidebar');
    const container = new SidebarContainer(logger, eventBus);
    container.render(sidebarEl);

    const main = document.querySelector('.main-content');

    // 断言：首次渲染时 main-content 被推开（与侧边栏宽度保持一致）
    expect(main.style.marginLeft).toBe('280px');
    expect(main.style.width).toBe('calc(100% - 280px)');
  });

  test('点击折叠按钮：应恢复 main-content 的布局', () => {
    const sidebarEl = document.getElementById('sidebar');
    const container = new SidebarContainer(logger, eventBus);
    container.render(sidebarEl);

    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const main = document.querySelector('.main-content');

    // 折叠
    toggleBtn.click();

    expect(sidebarEl.classList.contains('collapsed')).toBe(true);
    expect(main.style.marginLeft).toBe('');
    expect(main.style.width).toBe('');
  });

  test('再次展开：应再次推开 main-content', () => {
    const sidebarEl = document.getElementById('sidebar');
    const container = new SidebarContainer(logger, eventBus);
    container.render(sidebarEl);

    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const main = document.querySelector('.main-content');

    // 先折叠
    toggleBtn.click();
    // 再展开
    toggleBtn.click();

    expect(sidebarEl.classList.contains('collapsed')).toBe(false);
    expect(main.style.marginLeft).toBe('280px');
    expect(main.style.width).toBe('calc(100% - 280px)');
  });
});

