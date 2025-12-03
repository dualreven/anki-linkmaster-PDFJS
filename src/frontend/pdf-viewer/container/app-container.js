/**
 * @file PDF查看器应用容器 - 依赖 AppContainerBase 的适配层
 * @module PDFViewerContainer
 * @description 通过通用 AppContainerBase 复用 WS/生命周期逻辑，容器自身仅负责 ConsoleBridge 等特有行为。
 */

import { setGlobalWebSocketClient } from "../../common/utils/logger.js";
import { createWsConsoleBridge } from "../../common/utils/console-websocket-bridge.js";
import { createAppContainerBase } from "../../common/containers/app-container-base.js";

/**
 * 创建PDF查看器应用容器
 * @param {Object} options - 配置选项
 * @param {string} [options.wsUrl] - WebSocket连接URL
 * @param {boolean} [options.enableValidation=true] - 是否启用事件验证（当前保留参数以兼容，未在容器层使用）
 * @param {Logger} [options.logger] - 外部日志实例（当前由 AppContainerBase 内部创建）
 * @returns {Object} 容器实例，包含connect/disconnect/getDependencies等方法
 */
export function createPDFViewerContainer({
  wsUrl = null,
  enableValidation = true,
  logger = null
} = {}) {
  let baseContainer = null;
  let consoleBridge = null;
  let earlyConsoleBridge = null;

  /**
   * 禁用 Console 桥接器，避免日志循环
   */
  function disableConsoleBridge() {
    const containerLogger = baseContainer ? baseContainer._getLogger() : null;
    try {
      if (earlyConsoleBridge && earlyConsoleBridge.enabled) {
        earlyConsoleBridge.disable();
        containerLogger?.info?.("[pdf-viewer] Early console bridge disabled");
      }
      if (consoleBridge && consoleBridge.enabled) {
        consoleBridge.disable();
        containerLogger?.info?.("[pdf-viewer] Console bridge disabled");
      }
      if (typeof window !== "undefined" && window.__earlyConsoleBridge) {
        delete window.__earlyConsoleBridge;
      }
    } catch (e) {
      containerLogger?.warn?.("[pdf-viewer] Error disabling console bridge:", e);
    }
  }

  /**
   * 使用 AppContainerBase 创建基础容器
   */
  baseContainer = createAppContainerBase({
    moduleName: "pdf-viewer",
    resolveInitialWsUrl: () => wsUrl,
    createIdentityOptions: () => {
      // 与历史实现一致：从 URL 中读取 pdf-id 构造身份
      const params = new URLSearchParams(window.location.search);
      const pdfId = params.get("pdf-id") || params.get("pdf_id") || "";
      const clientName = pdfId ? `pdf-viewer-${pdfId}` : "pdf-viewer";
      return {
        client_name: clientName,
        client_id: pdfId || "ui",
        module: "pdf-viewer"
      };
    },
    onWsClientCreated: ({ wsClient }) => {
      try {
        setGlobalWebSocketClient(wsClient);
      } catch (e) {
        // logger-guard
        void e;
      }
    },
    onBeforeConnect: () => {
      disableConsoleBridge();
    },
    onBeforeDisconnect: () => {
      disableConsoleBridge();
    }
  });

  /**
   * 设置 Console 桥接器（仅在首次获取依赖时创建）
   */
  function setupConsoleBridge() {
    const containerLogger = baseContainer._getLogger();
    const pdfViewerSkipPatterns = [
      "PDF\\.js.*worker.*ready",
      "Canvas.*render.*progress",
      "Page.*\\d+.*rendered",
      "Zoom.*level.*\\d+\\.\\d+",
      "Scroll.*position.*\\d+",
      "WebSocket.*ping.*pong",
      "Console log recorded successfully"
    ];

    earlyConsoleBridge = createWsConsoleBridge({
      source: "pdf-viewer",
      getWsClient: () => baseContainer._getWSClient(),
      skipPatterns: pdfViewerSkipPatterns,
      minLevel: "warn"
    });

    consoleBridge = createWsConsoleBridge({
      source: "pdf-viewer",
      getWsClient: () => baseContainer._getWSClient(),
      skipPatterns: pdfViewerSkipPatterns,
      minLevel: "warn"
    });

    if (typeof window !== "undefined") {
      window.__earlyConsoleBridge = earlyConsoleBridge;
    }
    containerLogger.info("[pdf-viewer] Console bridge setup completed with PDF-specific filters");
  }

  /**
   * 确保基础设施（ConsoleBridge）已初始化
   */
  function ensureInfra() {
    if (!consoleBridge && !earlyConsoleBridge) {
      setupConsoleBridge();
    }
  }

  /**
   * 包装后的 getDependencies：在首次访问时初始化 ConsoleBridge
   */
  function getDependencies() {
    ensureInfra();
    return baseContainer.getDependencies();
  }

  /**
   * 包装后的 dispose：在基础容器销毁后清理 ConsoleBridge 引用
   */
  function dispose() {
    baseContainer.dispose();
    consoleBridge = null;
    earlyConsoleBridge = null;
  }

  // 暴露与历史实现兼容的接口
  return {
    initialize: baseContainer.initialize,
    isInitialized: baseContainer.isInitialized,
    connect: baseContainer.connect,
    disconnect: baseContainer.disconnect,
    reloadData: baseContainer.reloadData,
    dispose,
    getDependencies,
    updateWebSocketUrl: baseContainer.updateWebSocketUrl
  };
}

