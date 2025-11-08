/**
 * 真实侧边栏注册
 * @file 注册实际使用的侧边栏（大纲、批注、卡片、翻译）到SidebarManager
 * @module RealSidebars
 */

import { getLogger } from "../../../common/utils/logger.js";
import { createSidebarConfig } from "./sidebar-config.js";
import OutlineSidebarUIClassic from "../../ui/outline-sidebar-ui.js";
const logger = getLogger("RealSidebars");

/**
 * 注册所有真实侧边栏到SidebarManager
 * @param {SidebarManagerFeature} sidebarManager - 侧边栏管理器实例
 * @param {EventBus} eventBus - 全局事件总线
 * @param {Object} container - 依赖容器
 */
export async function registerRealSidebars(sidebarManager, eventBus, container) {
  logger.info("Registering real sidebars...");

  // 0. 锚点侧边栏（与书签并列）→ 从容器获取（避免跨特性直接 import）
  let anchorUI = null;
  try {
    anchorUI = container?.get?.("anchorSidebarUI") || null;
    if (!anchorUI) {
      logger.warn("anchorSidebarUI not found in container; skip anchor sidebar registration");
    } else {
      anchorUI.initialize?.();
    }
  } catch (e) {
    logger.warn("Failed to get anchorSidebarUI from container; skip", e);
  }

  const anchorConfig = createSidebarConfig({
    id: "anchor",
    title: "锚点",
    contentRenderer: () => {
      if (anchorUI?.getContentElement) { return anchorUI.getContentElement(); }
      const placeholder = document.createElement("div");
      placeholder.style.cssText = "padding: 20px; color: #999; text-align: center;";
      placeholder.innerHTML = "<div>锚点功能未启用</div>";
      return placeholder;
    },
    defaultWidth: 320,
    minWidth: 220,
    maxWidth: 520,
    resizable: true
  });
  sidebarManager.registerSidebar(anchorConfig);
  logger.info("Anchor sidebar registered");

  // 1. 大纲侧边栏（优先从容器获取 OutlineSidebarUI；若缺失，创建经典实现 OutlineSidebarUIClassic）
  let outlineUI = null;
  try {
    outlineUI = container?.get?.("outlineSidebarUI") || null;
  } catch (e) {
    logger.warn("Failed to get outlineSidebarUI from container", e);
  }
  if (!outlineUI) {
    outlineUI = new OutlineSidebarUIClassic(eventBus);
    logger.warn("outlineSidebarUI not found; using OutlineSidebarUIClassic");
  }
  try {
    // 由 pdf-outline Feature 负责创建并初始化 OutlineSidebarUI；此处只使用
    logger.info("outlineSidebarUI obtained from container; skip initialize");
  } catch (e) {
    logger.warn("outlineSidebarUI usage guard failed", e);
  }

  const outlineConfig = createSidebarConfig({
    id: "outline",
    title: "大纲",
    contentRenderer: () => outlineUI.getContentElement(),
    defaultWidth: 280,
    minWidth: 200,
    maxWidth: 500,
    resizable: true
  });
  sidebarManager.registerSidebar(outlineConfig);
  logger.info("Outline sidebar registered");

  // 2. 批注侧边栏（延迟获取，首次调用时从容器获取并缓存）
  let annotationUIInstance = null;

  const annotationConfig = createSidebarConfig({
    id: "annotation",
    title: "标注",
    contentRenderer: () => {
      // 首次调用时从容器获取并缓存
      if (!annotationUIInstance && container) {
        annotationUIInstance = container.get("annotationSidebarUI");
        logger.info(`Retrieved annotationSidebarUI from container: ${!!annotationUIInstance}`);
      }

      if (annotationUIInstance) {
        const contentElement = annotationUIInstance.getContentElement();
        logger.info("Returned AnnotationSidebarUI content element");
        return contentElement;
      } else {
        logger.warn("AnnotationSidebarUI still not available, showing placeholder");
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "padding: 20px; color: #999; text-align: center;";
        placeholder.innerHTML = "<div>标注功能加载中...</div>";
        return placeholder;
      }
    },
    defaultWidth: 350,
    minWidth: 250,
    maxWidth: 600,
    resizable: true
  });
  sidebarManager.registerSidebar(annotationConfig);
  logger.info("Annotation sidebar registered (will load from container on first open)");

  // 3. 卡片侧边栏（延迟获取，首次调用时从容器获取并缓存）
  let cardUIInstance = null;

  const cardConfig = createSidebarConfig({
    id: "card",
    title: "卡片",
    contentRenderer: () => {
      // 首次调用时从容器获取并缓存
      if (!cardUIInstance && container) {
        cardUIInstance = container.get("cardSidebarUI");
        logger.info(`Retrieved cardSidebarUI from container: ${!!cardUIInstance}`);
      }

      if (cardUIInstance) {
        const contentElement = cardUIInstance.getContentElement();
        logger.info("Returned CardSidebarUI content element");
        return contentElement;
      } else {
        logger.warn("CardSidebarUI still not available, showing placeholder");
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "padding: 20px; color: #999; text-align: center;";
        placeholder.innerHTML = "<div>卡片功能加载中...</div>";
        return placeholder;
      }
    },
    defaultWidth: 350,
    minWidth: 250,
    maxWidth: 600,
    resizable: true
  });
    // 4. AI 助手侧边栏（延迟获取）
  let aiAssistantUIInstance = null;

  const aiAssistantConfig = createSidebarConfig({
    id: "ai-assistant",
    title: "AI 助手",
    contentRenderer: () => {
      if (!aiAssistantUIInstance && container) {
        aiAssistantUIInstance = container.get("aiAssistantSidebarUI");
        logger.info(`Retrieved aiAssistantSidebarUI from container: ${!!aiAssistantUIInstance}`);
      }

      if (aiAssistantUIInstance) {
        const contentElement = aiAssistantUIInstance.getContentElement();
        logger.info("Returned AiAssistantSidebarUI content element");
        return contentElement;
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "padding: 20px; color: #999; text-align: center;";
        placeholder.innerHTML = "<div>AI助手加载中...</div>";
        return placeholder;
      }
    },
    defaultWidth: 360,
    minWidth: 260,
    maxWidth: 600,
    resizable: true
  });
  sidebarManager.registerSidebar(aiAssistantConfig);
  logger.info("AI assistant sidebar registered (lazy loads from container)");

  sidebarManager.registerSidebar(cardConfig);
  logger.info("Card sidebar registered (will load from container on first open)");

  // 5. 翻译侧边栏（延迟获取，首次调用时从容器获取并缓存）
  let translatorUIInstance = null;

  const translateConfig = createSidebarConfig({
    id: "translate",
    title: "翻译",
    contentRenderer: () => {
      // 首次调用时从容器获取并缓存
      if (!translatorUIInstance && container) {
        translatorUIInstance = container.get("translatorSidebarUI");
        logger.info(`Retrieved translatorSidebarUI from container: ${!!translatorUIInstance}`);
      }

      if (translatorUIInstance) {
        const contentElement = translatorUIInstance.getContentElement();
        logger.info("Returned TranslatorSidebarUI content element");
        return contentElement;
      } else {
        logger.warn("TranslatorSidebarUI still not available, showing placeholder");
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "padding: 20px; color: #999; text-align: center;";
        placeholder.innerHTML = "<div>翻译功能加载中...</div>";
        return placeholder;
      }
    },
    defaultWidth: 350,
    minWidth: 250,
    maxWidth: 600,
    resizable: true
  });
  sidebarManager.registerSidebar(translateConfig);
  logger.info("Translate sidebar registered (will load from container on first open)");

  // 5. 反向链接侧边栏（占位）
  const backlinkConfig = createSidebarConfig({
    id: "backlink",
    title: "反向链接",
    contentRenderer: () => {
      const content = document.createElement("div");
      content.style.cssText = "padding: 20px; color: #666; text-align: center;";
      content.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 16px;">🔗</div>
                <div style="font-size: 16px; margin-bottom: 8px;">反向链接功能</div>
                <div style="font-size: 14px; color: #999;">功能开发中...</div>
            `;
      return content;
    },
    defaultWidth: 350,
    minWidth: 250,
    maxWidth: 600,
    resizable: true
  });
  sidebarManager.registerSidebar(backlinkConfig);
  logger.info("Backlink sidebar registered (placeholder)");

  logger.info("All real sidebars registered successfully");
}

/**
 * 创建侧边栏按钮
 * @param {EventBus} eventBus - 全局事件总线
 */
export function createRealSidebarButtons(eventBus) {
  logger.info("Creating real sidebar toggle buttons...");

  // 查找按钮容器
  let buttonContainer = document.getElementById("pdf-viewer-button-container");
  if (!buttonContainer) {
    logger.warn("Button container not found, creating fallback container");
    buttonContainer = document.createElement("div");
    buttonContainer.id = "pdf-viewer-button-container";
    buttonContainer.style.cssText = [
      "position: fixed",
      "left: 8px",
      "top: 80px",
      "z-index: 1000",
      "display: flex",
      "flex-direction: column",
      "gap: 8px"
    ].join(";");
    document.body.appendChild(buttonContainer);
  }

  // 定义按钮配置
  const buttons = [
    { id: "anchor", label: "⚓ 锚点", title: "打开锚点侧边栏" },
    { id: "outline", label: "≡ 大纲", title: "打开大纲侧边栏" },
    { id: "annotation", label: "📝 标注", title: "打开标注侧边栏" },
    { id: "card", label: "📇 卡片", title: "打开卡片侧边栏" },
    { id: "ai-assistant", label: "🤖 AI", title: "打开AI助手侧边栏" },
    { id: "translate", label: "🌐 翻译", title: "打开翻译侧边栏" },
    { id: "backlink", label: "🔗 反链", title: "打开反向链接侧边栏" }
  ];

  // 创建按钮
  buttons.forEach(config => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `${config.id}-sidebar-button`;
    button.textContent = config.label;
    button.title = config.title;
    button.className = "btn";

    // 样式（如果不在header中）
    const inHeader = buttonContainer.closest("header") !== null;
    if (!inHeader) {
      button.style.cssText = [
        "padding: 4px 8px",
        "border: 1px solid #ddd",
        "border-radius: 4px",
        "background: #fff",
        "cursor: pointer",
        "box-shadow: 0 1px 2px rgba(0,0,0,0.06)",
        "font-size: 13px",
        "white-space: nowrap"
      ].join(";");
    }

    // 点击事件：发出toggle事件
    button.addEventListener("click", () => {
      logger.info(`[Button] Toggle sidebar requested: ${config.id}`);
      import("../../../common/event/pdf-viewer-constants.js").then(({ PDF_VIEWER_EVENTS }) => {
        eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED, { sidebarId: config.id }, { actorId: "RealSidebarButtons" });
      }).catch(() => {
        // 动态导入失败时不发事件，避免误用字面量；仅记录日志
        logger.warn("Failed to emit toggle due to constants import failure");
      });
    });

    buttonContainer.appendChild(button);
    logger.debug(`Button created: ${config.id}`);
  });

  logger.info("Real sidebar buttons created successfully");
}

