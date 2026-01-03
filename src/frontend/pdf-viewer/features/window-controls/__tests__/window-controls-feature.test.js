/**
 * WindowControlsFeature 集成测试
 *
 * 测试功能域的集成和配置：
 * 1. Feature 元数据（name, version, dependencies）
 * 2. 从容器获取依赖（wsClient）
 * 3. 动态获取 clientId
 * 4. 组件创建和挂载
 * 5. 错误处理（严格模式）
 */

import { WindowControlsFeature } from "../../../../common/features/window-controls/index.js";

describe("WindowControlsFeature", () => {
  let feature;
  let mockContext;
  let mockContainer;
  let mockWsClient;
  let mockLogger;

  beforeEach(() => {
    // 重置 DOM
    document.body.innerHTML = `
      <div class="toolbar-right"></div>
    `;

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Mock WebSocket 客户端
    mockWsClient = {
      send: jest.fn().mockResolvedValue(undefined),
      getClientName: jest.fn().mockReturnValue("pdf-viewer-0c251de0e2ac"),
      getIdentity: jest.fn().mockReturnValue({
        client_name: "pdf-viewer-0c251de0e2ac",
        client_id: "0c251de0e2ac",
        module: "pdf-viewer"
      })
    };

    // Mock 容器
    mockContainer = {
      get: jest.fn((key) => {
        if (key === "wsClient") {return mockWsClient;}
        return null;
      })
    };

    // Mock 上下文
    mockContext = {
      container: mockContainer,
      logger: mockLogger
    };

    // Mock QWebChannel
    global.window.qt = {
      webChannelTransport: {}
    };

    global.window.QWebChannel = jest.fn((transport, callback) => {
      callback({
        objects: {
          pdfViewerBridge: {
            minimizeWindow: jest.fn(() => true),
            maximizeWindow: jest.fn(() => true),
            startWindowDrag: jest.fn(),
            stopWindowDrag: jest.fn()
          }
        }
      });
    });

    // Mock fetch
    global.fetch = jest.fn((url) => {
      if (url.includes("window-controls.html")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <div class="window-controls">
              <button id="window-drag-btn"></button>
              <button id="window-minimize-btn"></button>
              <button id="window-maximize-btn"></button>
              <button id="window-close-btn"></button>
            </div>
          `)
        });
      }
      if (url.includes("window-controls.css")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("")
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    feature = new WindowControlsFeature({
      bridgeName: "pdfViewerBridge",
      containerSelector: ".toolbar-right"
    });
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall(mockContext);
      feature = null;
    }
    delete global.window.qt;
    delete global.window.QWebChannel;
    jest.clearAllMocks();
  });

  // ==================== Feature 元数据测试 ====================

  describe("Feature 元数据", () => {
    test("应该有正确的 name", () => {
      expect(feature.name).toBe("window-controls");
    });

    test("应该有版本号", () => {
      expect(feature.version).toBeDefined();
      expect(typeof feature.version).toBe("string");
      expect(feature.version).toMatch(/^\d+\.\d+\.\d+$/);  // semver 格式
    });

    test("应该声明依赖 infra-app", () => {
      expect(feature.dependencies).toContain("infra-app");
    });
  });

  // ==================== 安装测试 ====================

  describe("install()", () => {
    test("应该成功安装并挂载组件", async () => {
      await feature.install(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Installing")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("installed successfully")
      );

      const dragBtn = document.querySelector("#window-drag-btn");
      expect(dragBtn).not.toBeNull();
    });

    test("应该从容器获取 wsClient", async () => {
      await feature.install(mockContext);

      expect(mockContainer.get).toHaveBeenCalledWith("wsClient");
    });

    test("应该从 wsClient 获取 clientName", async () => {
      await feature.install(mockContext);

      expect(mockWsClient.getClientName).toHaveBeenCalled();
    });

    test("应该使用正确的 clientId 创建组件", async () => {
      await feature.install(mockContext);

      // 验证通过检查日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("clientId=\"pdf-viewer-0c251de0e2ac\"")
      );
    });

    test("应该使用正确的 bridgeName", async () => {
      await feature.install(mockContext);

      // bridgeName 只有在触发具体窗口控制动作时才会用到（会创建 QWebChannel 并调用桥接方法）
      const minimizeBtn = document.querySelector("#window-minimize-btn");
      expect(minimizeBtn).not.toBeNull();
      minimizeBtn.click();

      await new Promise(r => setTimeout(r, 0));

      expect(global.window.QWebChannel).toHaveBeenCalled();
    });
  });

  // ==================== 严格模式错误处理测试 ====================

  describe("严格模式错误处理", () => {
    test("wsClient 不存在时应该抛出错误", async () => {
      mockContainer.get = jest.fn(() => null);  // 返回 null

      await expect(feature.install(mockContext)).rejects.toThrow(
        "wsClient not found in container"
      );
    });

    test("getClientName 返回 null 时应该抛出错误", async () => {
      mockWsClient.getClientName = jest.fn().mockReturnValue(null);

      await expect(feature.install(mockContext)).rejects.toThrow(
        "getClientName() returned null"
      );
    });

    test("getClientName 方法不存在时应该抛出错误", async () => {
      delete mockWsClient.getClientName;

      await expect(feature.install(mockContext)).rejects.toThrow(
        "getClientName() returned null"
      );
    });

    test("工具栏容器不存在时应该记录错误", async () => {
      document.body.innerHTML = "";  // 移除工具栏容器

      // 不应该抛出错误，但应该记录错误
      await expect(feature.install(mockContext)).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Toolbar container")
      );
    });
  });

  // ==================== 卸载测试 ====================

  describe("uninstall()", () => {
    test("应该成功卸载组件", async () => {
      await feature.install(mockContext);
      await feature.uninstall(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Uninstalling")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("uninstalled")
      );
    });

    test("卸载后应该移除 DOM 元素", async () => {
      await feature.install(mockContext);

      const dragBtnBefore = document.querySelector("#window-drag-btn");
      expect(dragBtnBefore).not.toBeNull();

      await feature.uninstall(mockContext);

      const dragBtnAfter = document.querySelector("#window-drag-btn");
      expect(dragBtnAfter).toBeNull();
    });

    test("未安装时卸载不应该抛出错误", async () => {
      await expect(feature.uninstall(mockContext)).resolves.not.toThrow();
    });
  });

  // ==================== DOM 就绪等待测试 ====================

  describe("DOM 就绪等待", () => {
    test("当 DOM 未加载时应该等待 DOMContentLoaded", async () => {
      // Mock document.readyState 为 'loading'
      Object.defineProperty(document, "readyState", {
        writable: true,
        value: "loading"
      });

      const addEventListenerSpy = jest.spyOn(document, "addEventListener");

      const installPromise = feature.install(mockContext);

      // 应该添加了事件监听器
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "DOMContentLoaded",
        expect.any(Function),
        expect.objectContaining({ once: true })
      );

      // 手动触发 DOMContentLoaded
      Object.defineProperty(document, "readyState", {
        writable: true,
        value: "complete"
      });
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      await installPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("installed successfully")
      );

      addEventListenerSpy.mockRestore();
    });

    test("当 DOM 已加载时应该立即安装", async () => {
      // Mock document.readyState 为 'complete'
      Object.defineProperty(document, "readyState", {
        writable: true,
        value: "complete"
      });

      const addEventListenerSpy = jest.spyOn(document, "addEventListener");

      await feature.install(mockContext);

      // 不应该添加 DOMContentLoaded 监听器
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "DOMContentLoaded",
        expect.any(Function),
        expect.any(Object)
      );

      addEventListenerSpy.mockRestore();
    });
  });

  // ==================== 多次安装测试 ====================

  describe("防止重复安装", () => {
    test("多次安装应该只创建一个组件实例", async () => {
      await feature.install(mockContext);
      const firstInstall = document.querySelectorAll(".window-controls").length;

      // 第二次安装（实际应该由 FeatureRegistry 防止，但这里测试 Feature 行为）
      await feature.install(mockContext);
      const secondInstall = document.querySelectorAll(".window-controls").length;

      // 应该只有一个实例（第二次安装会覆盖第一次）
      expect(firstInstall).toBe(1);
      expect(secondInstall).toBe(1);
    });
  });

  // ==================== 集成场景测试 ====================

  describe("集成场景", () => {
    test("完整的安装-使用-卸载流程", async () => {
      // 1. 安装
      await feature.install(mockContext);
      expect(document.querySelector("#window-drag-btn")).not.toBeNull();

      // 2. 使用（模拟点击拖拽按钮）
      const dragBtn = document.querySelector("#window-drag-btn");
      const mouseDownEvent = new MouseEvent("mousedown", {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseDownEvent);

      // 3. 卸载
      await feature.uninstall(mockContext);
      expect(document.querySelector("#window-drag-btn")).toBeNull();
    });

    test("在真实的 Feature 上下文中应该正确初始化", async () => {
      // 模拟真实的 Feature 上下文
      const realContext = {
        container: {
          get: (key) => {
            if (key === "wsClient") {
              return {
                send: jest.fn().mockResolvedValue(undefined),
                getClientName: () => "pdf-viewer-sample"
              };
            }
            return null;
          }
        },
        logger: mockLogger
      };

      await feature.install(realContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("clientId=\"pdf-viewer-sample\"")
      );
    });
  });
});
