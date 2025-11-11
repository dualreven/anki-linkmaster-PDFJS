/* @jest-environment jsdom */
/**
 * 防回归：Hosted 模式下 pdf-home 的 WS URL 必须指向 IPv4 回环 127.0.0.1
 * 规范约束：
 * - 所有输出应为 UTF-8 且换行使用 \n
 */

const UTF8 = 'utf-8';

describe('pdf-home bootstrap WS URL (IPv4 loopback)', () => {
  let capturedUrl = null;

  beforeAll(() => {
    // 显式设置运行时端口，避免依赖 window.location 解析
    // 严格使用 UTF-8 输出（测试本身不做文件 IO）
    // eslint-disable-next-line no-undef
    window.RUNTIME_CONFIG = { msgCenter_port: 8765 };
  });

  beforeEach(() => {
    capturedUrl = null;
    jest.resetModules();
  });

  it('should construct ws://127.0.0.1:<port> for msg center', async () => {
    // Mock 端口解析，避免命中 import.meta
    jest.doMock('../../utils/ws-port-resolver.js', () => {
      return {
        resolveWebSocketPortSync: () => 8765,
        DEFAULT_WS_PORT: 8765
      };
    });
    jest.doMock('../../core/pdf-home-app-v2.js', () => {
      return {
        PDFHomeAppV2: jest.fn().mockImplementation((opts) => {
          capturedUrl = opts?.wsUrl ?? null;
          return {
            initialize: jest.fn().mockResolvedValue(undefined),
            getState: () => ({ features: { installed: [] } }),
            getRegistry: jest.fn(),
            getStateManager: jest.fn(),
            getFeatureFlagManager: jest.fn(),
            getContainer: jest.fn(),
            destroy: jest.fn(),
            enableFeature: jest.fn(),
            disableFeature: jest.fn()
          };
        })
      };
    });

    const mod = await import('../app-bootstrap-v2.js');
    await mod.bootstrapPDFHomeAppV2({ environment: 'production' });
    expect(capturedUrl).toBe('ws://127.0.0.1:8765');
  });
});
