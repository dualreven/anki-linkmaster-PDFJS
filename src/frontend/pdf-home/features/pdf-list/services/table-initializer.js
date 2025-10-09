/**
 * @file Tabulator 初始化服务（最小桩实现）
 * @description 保证构建与运行不依赖 Tabulator，始终处于回退模式。
 */

export class TableInitializer {
  tableWrapper;
  fallbackMode = true;

  constructor(container, _options = {}) {
    try {
      if (typeof container === 'string') {
        this.tableWrapper = document.querySelector(container) || document.body || document.documentElement;
      } else if (container instanceof HTMLElement) {
        this.tableWrapper = container;
      } else {
        this.tableWrapper = document.body || document.documentElement;
      }
    } catch (_) {
      this.tableWrapper = document.body || document.documentElement;
    }
    this.fallbackMode = true;
  }

  initializeSync() {
    return null;
  }
}

export default TableInitializer;

