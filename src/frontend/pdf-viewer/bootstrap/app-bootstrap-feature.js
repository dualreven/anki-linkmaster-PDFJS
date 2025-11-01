/**
 * @file PDF查看器应用启动引导程序（基于Feature Registry）
 * @module AppBootstrapFeature
 * @description 使用插件化架构启动PDF查看器应用
 */

import { getLogger, setModuleLogLevel, LogLevel } from "../../common/utils/logger.js";
import { FeatureRegistry } from "../../common/micro-service/feature-registry.js";
import { SimpleDependencyContainer } from "../container/simple-dependency-container.js";
import eventBusSingleton from "../../common/event/event-bus.js";

// 导入 Features
import { AppCoreFeature } from "../features/app-core/index.js";
import { PDFManagerFeature } from "../features/pdf-manager/index.js";
import { UIManagerFeature } from "../features/ui-manager/index.js";
import { CoreNavigationFeature } from "../features/core-navigation/index.js";
import { SearchFeature } from "../features/search/index.js";
import { URLNavigationFeature } from "../features/url-navigation/index.js";
import { AnnotationFeature } from "../features/annotation/index.js";
import { SidebarManagerFeature } from "../features/sidebar-manager/index.js";
import { PDFTranslatorFeature } from "../features/pdf-translator/index.js";
import { TextSelectionQuickActionsFeature } from "../features/text-selection-quick-actions/index.js";
import { PDFOutlineFeature } from "../features/pdf-outline/index.js";
import { PDFCardFeature } from "../features/pdf-card/index.js";
import { AiAssistantFeature } from "../features/ai-assistant/index.js";
import { PDFAnchorFeature } from "../features/pdf-anchor/index.js";
import { showInfo } from "../../common/utils/notification.js";
const logger = getLogger("pdf-viewer.bootstrap");

/**
 * 解析WebSocket端口
 * @returns {number} WebSocket端口号
 */
function resolveWebSocketPort() {
  // 1. 优先从URL参数获取
  const urlParams = new URLSearchParams(window.location.search);
  const msgCenterPort = urlParams.get("msgCenter");
  if (msgCenterPort) {
    return parseInt(msgCenterPort, 10);
  }

  // 2. 从环境或默认值
  return 8765;
}

/**
 * 解析PDF文件路径
 * @returns {string|null} PDF文件路径
 */
function resolvePDFPath() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. 优先检查window.PDF_PATH（通过script标签注入）
  if (window.PDF_PATH) {
    return window.PDF_PATH;
  }

  // 2. 检查URL参数file（通过launcher.py传递）
  const fileParam = urlParams.get("file");
  if (fileParam) {
    return decodeURIComponent(fileParam);
  }

  return null;
}

/**
 * 启动PDF查看器应用（基于Feature Registry）
 * @returns {Promise<FeatureRegistry>} Feature Registry 实例
 */
export async function bootstrapPDFViewerAppFeature() {
  logger.info("[Bootstrap] Starting PDF Viewer App initialization (Feature-based)...");

  try {
    // 1. 解析配置
    const wsPort = resolveWebSocketPort();
    const wsUrl = `ws://localhost:${wsPort}`;
    const pdfPath = resolvePDFPath();

    logger.info(`[Bootstrap] Configuration: wsUrl=${wsUrl}, pdfPath=${pdfPath}`);

    // 2. 创建依赖注入容器
    const container = new SimpleDependencyContainer("pdf-viewer");

    // 注册核心服务
    container.register("eventBus", eventBusSingleton);
    container.register("logger", logger);

    // 3. 创建 Feature Registry
    const registry = new FeatureRegistry({
      container,
      globalEventBus: eventBusSingleton,
      logger
    });

    // 打开 Outline 相关模块的“模块级日志过滤”并设为较详细级别，便于问题排查
    try {
      setModuleLogLevel("Feature.pdf-outline", LogLevel.ERROR);
      setModuleLogLevel("OutlineSidebarUI", LogLevel.ERROR);
    } catch (_) {}

    // 4. 注册核心 Features
    registry.register(new AppCoreFeature());
    registry.register(new PDFManagerFeature());
    registry.register(new UIManagerFeature());
    registry.register(new CoreNavigationFeature());  // 核心导航服务（需在url-navigation和annotation之前）
    registry.register(new SearchFeature());  // 注册搜索功能
    registry.register(new URLNavigationFeature());

    // 4.1 强制 Outline：关闭切换逻辑与回退路径，始终注册 pdf-outline
    try {
      registry.register(new PDFOutlineFeature());
      logger.warn("[Bootstrap] Outline feature enforced; pdf-outline registered (bookmark disabled)");
    } catch (e) {
      logger.error("[Bootstrap] Failed to register pdf-outline (enforced). Viewer may be degraded.", e);
    }
    registry.register(new PDFAnchorFeature());    // 锚点功能（复制/激活/URL集成），在sidebar-manager之前
    registry.register(new AnnotationFeature());
    registry.register(new PDFTranslatorFeature());  // 翻译功能
    registry.register(new TextSelectionQuickActionsFeature());  // 文本选择快捷操作
    registry.register(new PDFCardFeature());  // 卡片管理功能（需在sidebar-manager之前）
    registry.register(new AiAssistantFeature());  // AI 助手侧边栏（独立插件）
    registry.register(new SidebarManagerFeature());  // 侧边栏统一管理器（最后注册，依赖annotation、pdf-translator、pdf-bookmark和pdf-card）

    // 5. 安装所有 Features（自动解析依赖顺序）
    logger.info("[Bootstrap] Installing features...");
    await registry.installAll();

    // 5.1 禁用浏览器层面的 Ctrl+滚轮页面缩放（Qt WebEngine/Chromium 默认行为），避免 devicePixelRatio 变动影响标注坐标
    try {
      const shouldDisablePageZoom = true; // 可按需改为从 localStorage 读取
      if (shouldDisablePageZoom) {
        const wheelHandler = (e) => {
          try {
            if (e && e.ctrlKey) {
              e.preventDefault();
              e.stopPropagation();
              // 将 Ctrl+滚轮 转译为应用内的 PDF 缩放事件（避免浏览器层 page zoom）
              import("../../common/event/pdf-viewer-constants.js").then(({ PDF_VIEWER_EVENTS }) => {
                const direction = (e.deltaY || 0) < 0 ? "in" : "out";
                const evt = direction === "in" ? PDF_VIEWER_EVENTS.ZOOM.IN : PDF_VIEWER_EVENTS.ZOOM.OUT;
                // 使用较小的步进以获得平滑体验
                eventBusSingleton.emit(evt, { delta: 0.15 }, { actorId: "BootstrapZoomGuard" });
                logger.info(`[Bootstrap] Ctrl+Wheel intercepted → zoom ${direction}`);
              }).catch(() => {
                logger.warn("[Bootstrap] Failed to emit zoom event on Ctrl+Wheel");
              });
            }
          } catch (_) {}
        };
        const keydownHandler = (e) => {
          try {
            if (!e) {return;}
            const ctrl = !!(e.ctrlKey || e.metaKey); // macOS 下 meta 也可能触发
            const k = e.key || "";
            if (ctrl && (k === "+" || k === "-" || k === "0")) {
              e.preventDefault();
              e.stopPropagation();
              logger.info("[Bootstrap] Ctrl+Key page zoom prevented", { key: k });
            }
            // 处理部分键位编码（等号/减号/数字键盘）
            const code = e.code || "";
            if (ctrl && (code === "Equal" || code === "Minus" || code === "Digit0" || code === "NumpadAdd" || code === "NumpadSubtract" || code === "Numpad0")) {
              e.preventDefault();
              e.stopPropagation();
              logger.info("[Bootstrap] Ctrl+Key(code) page zoom prevented", { code });
            }
          } catch (_) {}
        };
        // 使用 passive:false 以允许 preventDefault 生效
        window.addEventListener("wheel", wheelHandler, { passive: false, capture: true });
        window.addEventListener("keydown", keydownHandler, { capture: true });
        // 保存到全局以便调试/卸载
        window.__PDFVIEWER_DISABLE_PAGE_ZOOM_GUARD__ = { wheelHandler, keydownHandler };
        logger.info("[Bootstrap] Page zoom (Ctrl+Wheel/Key) disabled at JS layer");
      }
    } catch (e) {
      logger.warn("[Bootstrap] Failed to install page-zoom guard (non-fatal)", e);
    }

    // 6. 设置全局引用（便于调试）
    window.pdfViewerApp = {
      registry,
      container,
      getFeature: (name) => {
        const record = registry.get(name);
        return record ? record.feature : null;
      },
      destroy: () => registry.uninstallAll(),
      eventBus: eventBusSingleton
    };

    // 7. 如果有PDF路径，自动加载（但当URL已提供 pdf-id 时，避免与 URLNavigationFeature 重复触发）
    const hasPdfIdParam = (() => { try { return !!new URLSearchParams(window.location.search).get("pdf-id"); } catch { return false; } })();
    if (pdfPath && !hasPdfIdParam) {
      logger.info(`[Bootstrap] Auto-loading PDF: ${pdfPath}`);

      // 从完整路径中提取文件名
      const filename = pdfPath.includes("\\") || pdfPath.includes("/")
        ? pdfPath.split(/[\\\/]/).pop()
        : pdfPath;

      // 通过事件系统请求加载PDF
      const { PDF_VIEWER_EVENTS } = await import("../../common/event/pdf-viewer-constants.js");
      // 以 warn 级别输出一次“将要触发加载”的跟踪日志，便于生产环境观察两次触发来源
      try {
        logger.warn("[TRACE] Emitting FILE.LOAD.REQUESTED from Bootstrap", {
          filename,
          pdfPath
        });
      } catch (_) {}
      eventBusSingleton.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, {
        filename: filename,
        file_path: pdfPath
      }, { actorId: "Bootstrap" });
    } else if (pdfPath && hasPdfIdParam) {
      logger.warn("[TRACE] Skip Bootstrap auto-load because 'pdf-id' present; URLNavigationFeature will handle loading.");
    }

    logger.info("[Bootstrap] PDF Viewer App started successfully");

    // 提示：当前为 Outline 模式（固定）
    try {
      showInfo("当前为 Outline 模式", 3000);
      logger.warn("[Bootstrap] Outline mode is active (enforced)");
    } catch (_) {}
    return registry;

  } catch (error) {
    logger.error("[Bootstrap] Failed to start PDF Viewer App:", error);
    logger.error("[Bootstrap] Error message:", error?.message);
    logger.error("[Bootstrap] Error stack:", error?.stack);
    logger.error("[Bootstrap] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}
