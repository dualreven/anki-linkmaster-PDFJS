import { PDFManager } from '../../src/frontend/pdf-viewer/pdf-manager.js';
import { EventBus } from '../../src/frontend/common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../src/frontend/common/event/pdf-viewer-constants.js';

describe('PDFManager', () => {
  let eventBus;
  let pdfManager;

  beforeEach(() => {
    eventBus = new EventBus();
    pdfManager = new PDFManager(eventBus);
    // 模拟 loadPDF 方法
    pdfManager.loadPDF = jest.fn();
  });

  test('should call loadPDF when PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED is emitted', async () => {
    // 模拟事件
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, { path: 'test_pdf_files\\test.pdf' });

    // 等待异步事件处理
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(pdfManager.loadPDF).toHaveBeenCalledWith({ url: 'test_pdf_files/test.pdf' });
  });

  test('should log warning if path is missing', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, {});
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('received without path'));
    consoleWarn.mockRestore();
  });
});