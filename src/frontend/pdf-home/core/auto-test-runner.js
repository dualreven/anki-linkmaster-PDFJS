/**
 * @file 自动化测试运行器，用于PDF Home应用的自动化测试
 * @module AutoTestRunner
 */

import { PDF_MANAGEMENT_EVENTS } from "../../common/event/event-constants.js";

/**
 * 创建自动化测试运行器
 * @param {PDFHomeApp} app - PDF Home应用实例
 * @returns {Object} 自动化测试对象
 */
export function createAutoTestRunner(app) {
  const autoTest = {
    lastResult: null,

    /**
     * 运行自动化双击测试
     * @returns {Promise<Object>} 测试结果
     */
    run: async () => {
      const result = {
        startedAt: new Date().toISOString(),
        errors: [],
        openRequestedFired: false,
        usedMockData: false,
        notes: []
      };

      // 1) 捕获 window 错误与 console.error
      const errorHandler = (e) => {
        try {
          const msg = e?.message || e?.toString?.() || String(e);
          result.errors.push({ source: 'window.onerror', message: msg });
        } catch (_) {}
      };

      const origConsoleError = console.error;
      console.error = function(...args) {
        try {
          result.errors.push({
            source: 'console.error',
            message: args.map(a => (a && a.message) ? a.message : String(a)).join(' ')
          });
        } catch(_) {}
        return origConsoleError.apply(console, args);
      };

      window.addEventListener('error', errorHandler);

      // 2) 监听 OPEN.REQUESTED 事件是否触发
      const unsubscribeOpen = app.getEventBus().on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (payload) => {
        try {
          result.openRequestedFired = true;
          result.notes.push('OPEN.REQUESTED captured with payload: ' + JSON.stringify(payload));
        } catch (_) {}
      }, { subscriberId: 'AutoTest' });

      // 3) 等待 Tabulator DOM 渲染
      const waitForTableDom = async (timeoutMs = 5000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          try {
            const wrapper = app.tableWrapper?.tableWrapper ||
                            document.querySelector('#pdf-table-container .pdf-table-wrapper');
            if (wrapper) {
              const isTab = wrapper.classList?.contains?.('tabulator') ||
                           wrapper.querySelector('.tabulator, .tabulator-table');
              if (isTab) return wrapper;
            }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 50));
        }
        throw new Error('Tabulator DOM not ready within timeout');
      };

      // 4) 若没有数据则注入一条 mock 数据
      const ensureData = async () => {
        try {
          const dataLen = (() => {
            try {
              const d = app.tableWrapper?.tabulator?.getData?.();
              return Array.isArray(d) ? d.length : 0;
            } catch (_) { return 0; }
          })();
          if (dataLen === 0) {
            result.usedMockData = true;
            const mock = [{
              id: 'auto-test.pdf',
              filename: 'auto-test.pdf',
              title: 'Auto Test PDF',
              page_count: 1,
              cards_count: 0
            }];
            await app.tableWrapper.setData(mock);
            result.notes.push('Injected mock data for auto test');
          }
        } catch (e) {
          result.errors.push({ source: 'ensureData', message: e?.message || String(e) });
        }
      };

      // 5) 触发第一行的双击事件
      const dispatchDblClick = async () => {
        try {
          const wrapper = app.tableWrapper?.tableWrapper ||
                          document.querySelector('#pdf-table-container .pdf-table-wrapper');
          if (!wrapper) throw new Error('table wrapper not found');

          // 兼容 Tabulator 不同结构，尝试多种选择器
          const rowEl = wrapper.querySelector('.tabulator-row') ||
                       wrapper.querySelector('.tabulator-tableHolder .tabulator-table .tabulator-row');
          if (!rowEl) throw new Error('no tabulator row found to double click');

          const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
          rowEl.dispatchEvent(evt);
          result.notes.push('Dispatched dblclick on first row');
        } catch (e) {
          result.errors.push({ source: 'dispatchDblClick', message: e?.message || String(e) });
        }
      };

      // 执行测试流程
      try {
        await waitForTableDom(6000);
        await ensureData();
        await new Promise(r => setTimeout(r, 100)); // 给渲染留一点时间
        await dispatchDblClick();
        await new Promise(r => setTimeout(r, 200)); // 等待事件总线处理
      } catch (e) {
        result.errors.push({ source: 'autoTestFlow', message: e?.message || String(e) });
      }

      // 清理监听
      try { window.removeEventListener('error', errorHandler); } catch(_) {}
      try { console.error = origConsoleError; } catch(_) {}
      try { if (typeof unsubscribeOpen === 'function') unsubscribeOpen(); } catch(_) {}

      // 6) 判定成功条件：无 isSelected 错误，且 OPEN.REQUESTED 触发
      const hasIsSelectedError = result.errors.some(er => /isSelected/.test(er.message || ''));
      result.success = !hasIsSelectedError && result.openRequestedFired;
      result.finishedAt = new Date().toISOString();

      // 对外暴露结果并打印
      autoTest.lastResult = result;
      window.__lastAutoTestResult = result;

      if (result.success) {
        app.logger.info('[AutoTest] Success', result);
      } else {
        app.logger.warn('[AutoTest] Failed', result);
      }

      return result;
    }
  };

  return autoTest;
}

/**
 * 设置自动化测试环境
 * @param {PDFHomeApp} app - PDF Home应用实例
 */
export function setupAutoTestEnvironment(app) {
  try {
    // 创建自动化测试钩子
    const autoTest = createAutoTestRunner(app);

    // 暴露到 window
    window.__pdfHomeAutoTest = autoTest;

    // 若检测到环境变量（通过 window 注入的布尔值）则自动执行
    if (window.PDF_HOME_AUTO_TEST === true || window.PDF_HOME_AUTO_TEST === '1') {
      setTimeout(() => {
        try {
          autoTest.run();
        } catch (e) {
          app.logger.warn('AutoTest run failed to start', e);
        }
      }, 300);
    }
  } catch (e) {
    app.logger.warn('AutoTest hook init failed', e);
  }
}