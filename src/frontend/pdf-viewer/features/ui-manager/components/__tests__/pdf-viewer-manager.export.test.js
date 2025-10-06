/**
 * @file 测试 PDFViewerManager 是否以命名导出方式提供
 */

import { jest } from '@jest/globals';

// Mock 外部依赖，避免在 Node/JSDOM 环境下真实加载 PDF.js

jest.mock('pdfjs-dist/build/pdf', () => ({}), { virtual: true });

jest.mock('@pdfjs/web/pdf_viewer.mjs', () => ({
  EventBus: class {},
  PDFViewer: class { constructor() {} update() {} },
  PDFLinkService: class { constructor() {} setViewer() {} setDocument() {} },
  ScrollMode: {},
  SpreadMode: {},
}), { virtual: true });

import * as mod from '../pdf-viewer-manager.js';

describe('PDFViewerManager 导出', () => {
  test('应提供命名导出 PDFViewerManager', () => {
    expect(mod).toBeTruthy();
    expect(typeof mod.PDFViewerManager).toBe('function');
  });
});
