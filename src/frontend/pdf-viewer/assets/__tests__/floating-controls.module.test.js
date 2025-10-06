/**
 * @file 测试浮动控制面板脚本作为 ES 模块加载并正确工作
 */

import { jest } from '@jest/globals';
import '../floating-controls.js';

describe('floating-controls.js 作为模块加载', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <button id="controls-toggle-btn">收起</button>
        <div id="controls-content"></div>
      </div>
    `;
  });

  test('DOMContentLoaded 后可正常绑定并切换折叠状态', async () => {
    // 触发 DOMContentLoaded 以执行脚本中的初始化逻辑
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const toggleBtn = document.getElementById('controls-toggle-btn');
    const controlsContent = document.getElementById('controls-content');

    expect(toggleBtn).toBeTruthy();
    expect(controlsContent).toBeTruthy();

    // 初始为展开（无 collapsed 类）
    expect(controlsContent.classList.contains('collapsed')).toBe(false);
    expect(toggleBtn.textContent).toBe('收起');

    // 第一次点击 → 收起
    toggleBtn.click();
    expect(controlsContent.classList.contains('collapsed')).toBe(true);
    expect(toggleBtn.textContent).toBe('展开');

    // 第二次点击 → 展开
    toggleBtn.click();
    expect(controlsContent.classList.contains('collapsed')).toBe(false);
    expect(toggleBtn.textContent).toBe('收起');
  });
});
