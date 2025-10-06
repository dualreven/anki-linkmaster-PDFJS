import { getLogger } from '../../common/utils/logger.js';
const logger = getLogger('FloatingControls');
/**
 * 浮动控制面板的展开/收起功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('controls-toggle-btn');
  const controlsContent = document.getElementById('controls-content');

  if (!toggleBtn || !controlsContent) {
    logger.warn('Floating controls elements not found');
    return;
  }

  // 默认展开状态
  let isCollapsed = false;

  toggleBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      // 收起状态
      controlsContent.classList.add('collapsed');
      toggleBtn.textContent = '展开';
    } else {
      // 展开状态
      controlsContent.classList.remove('collapsed');
      toggleBtn.textContent = '收起';
    }
  });

  logger.info('[FloatingControls] Initialized');
});

