/**
 * @file PDFManagerCore 单元测试
 * @description 测试 PDFManagerCore 的 openPDF 方法，验证新旧两种数据格式
 */

import { PDFManagerCore } from '../pdf-manager-core.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../event/event-constants.js';

describe('PDFManagerCore - openPDF Method', () => {
  let manager;
  let mockEventBus;
  let emittedEvents;

  beforeEach(() => {
    // 重置测试数据
    emittedEvents = [];

    // 创建模拟的 EventBus
    mockEventBus = {
      emit: jest.fn((eventName, payload, metadata) => {
        emittedEvents.push({ eventName, payload, metadata });
      }),
      on: jest.fn(() => () => {}), // 返回取消订阅函数
    };

    // 创建 PDFManagerCore 实例
    manager = new PDFManagerCore(mockEventBus);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('向后兼容 - 旧格式（string）', () => {
    test('应该接受字符串参数（旧格式）', () => {
      const filename = 'sample.pdf';

      manager.openPDF(filename);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: { file_id: filename }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确处理不带扩展名的文件名', () => {
      const filename = 'sample';

      manager.openPDF(filename);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: { file_id: filename }
        },
        { actorId: 'PDFManager' }
      );
    });
  });

  describe('新格式 - 对象参数（带 needNavigate）', () => {
    test('应该接受对象参数（仅 filename，无 needNavigate）', () => {
      const data = { filename: 'sample.pdf' };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: { file_id: 'sample.pdf' }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确传递 needNavigate.pageAt 参数', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: { pageAt: 5 }
      };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: { pageAt: 5 }
          }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确传递 needNavigate.pageAt + position 参数', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: {
          pageAt: 5,
          position: 50
        }
      };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: {
              pageAt: 5,
              position: 50
            }
          }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确传递 needNavigate.pdfanchor 参数', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: {
          pdfanchor: 'pdfanchor-abc123def456'
        }
      };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: {
              pdfanchor: 'pdfanchor-abc123def456'
            }
          }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确传递 needNavigate.pdfannotation 参数', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: {
          pdfannotation: 'pdfannotation-xyz789'
        }
      };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: {
              pdfannotation: 'pdfannotation-xyz789'
            }
          }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确传递包含多个 needNavigate 字段的参数', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: {
          pageAt: 10,
          position: 75,
          pdfanchor: 'pdfanchor-test12345678'
        }
      };

      manager.openPDF(data);

      const expectedData = {
        file_id: 'sample.pdf',
        needNavigate: {
          pageAt: 10,
          position: 75,
          pdfanchor: 'pdfanchor-test12345678'
        }
      };

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: expectedData
        },
        { actorId: 'PDFManager' }
      );
    });
  });

  describe('错误处理', () => {
    test('应该拒绝无效的参数类型（number）', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF(12345);

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该拒绝无效的参数类型（null）', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF(null);

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该拒绝无效的参数类型（undefined）', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF(undefined);

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该拒绝对象参数中缺少 filename 字段', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF({ needNavigate: { pageAt: 5 } });

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该拒绝对象参数中 filename 为空字符串', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF({ filename: '', needNavigate: { pageAt: 5 } });

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该拒绝对象参数中 filename 为 null', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.openPDF({ filename: null, needNavigate: { pageAt: 5 } });

      expect(mockEventBus.emit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('边界情况', () => {
    test('应该正确处理 needNavigate 为空对象', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: {}
      };

      manager.openPDF(data);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: {}
          }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确处理 needNavigate 为 null', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: null
      };

      manager.openPDF(data);

      // needNavigate 为 null，不应该添加到 data 中
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: { file_id: 'sample.pdf' }
        },
        { actorId: 'PDFManager' }
      );
    });

    test('应该正确处理 needNavigate 为 undefined', () => {
      const data = {
        filename: 'sample.pdf',
        needNavigate: undefined
      };

      manager.openPDF(data);

      // needNavigate 为 undefined，不应该添加到 data 中
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: { file_id: 'sample.pdf' }
        },
        { actorId: 'PDFManager' }
      );
    });
  });

  describe('数据隔离 - 验证深拷贝', () => {
    test('应该对 needNavigate 进行深拷贝，防止外部修改影响内部数据', () => {
      const needNavigate = { pageAt: 5, position: 50 };
      const data = {
        filename: 'sample.pdf',
        needNavigate
      };

      manager.openPDF(data);

      // 修改原始对象
      needNavigate.pageAt = 999;
      needNavigate.position = 999;

      // 验证发送的数据没有被修改
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
          data: {
            file_id: 'sample.pdf',
            needNavigate: {
              pageAt: 5,   // 应该保持原始值
              position: 50 // 应该保持原始值
            }
          }
        },
        { actorId: 'PDFManager' }
      );
    });
  });
});
