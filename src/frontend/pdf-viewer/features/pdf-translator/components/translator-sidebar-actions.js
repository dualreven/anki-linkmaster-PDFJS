import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { showError, showInfo, showSuccess } from "../../../../common/utils/notification.js";

import { PDF_TRANSLATOR_EVENTS } from "../events.js";

export function createTranslatorSidebarActions({ eventBus, logger, getCurrentPageNumber }) {
  if (!eventBus) {
    throw new Error("[TranslatorSidebarUI] createTranslatorSidebarActions: eventBus is required");
  }
  if (!logger) {
    throw new Error("[TranslatorSidebarUI] createTranslatorSidebarActions: logger is required");
  }
  if (typeof getCurrentPageNumber !== "function") {
    throw new Error("[TranslatorSidebarUI] createTranslatorSidebarActions: getCurrentPageNumber is required");
  }

  function createAnnotationFromTranslation(translation) {
    logger.info("Creating annotation from translation...");

    if (!translation?.pageNumber || !translation?.position) {
      showError("无法创建标注：缺少位置信息", 4000);
      logger.warn("Cannot create annotation: missing pageNumber or position", translation);
      return;
    }

    if (!Array.isArray(translation?.rangeData) || translation.rangeData.length === 0) {
      showError("无法创建标注：缺少文本选择数据", 4000);
      logger.warn("Cannot create annotation: missing rangeData", translation);
      return;
    }

    const annotationContent =
      `📝 原文:\n${translation.original}\n\n` +
      `✅ 译文:\n${translation.translation}`;

    const annotationData = {
      type: "text-highlight",
      pageNumber: translation.pageNumber,
      data: {
        selectedText: translation.original,
        highlightColor: "yellow",
        textRanges: translation.rangeData,
        boundingBox: translation.position,
        comment: annotationContent
      }
    };

    logger.info("Annotation data prepared:", annotationData);

    eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      { annotation: annotationData },
      { actorId: "TranslatorSidebarUI" }
    );

    showSuccess("✅ 标注已创建", 2000);
    logger.info("Annotation creation requested");
  }

  function createCardFromTranslation(translation) {
    logger.info("Creating card from translation...");

    if (!translation || typeof translation !== "object") {
      throw new Error("[TranslatorSidebarUI] createCardFromTranslation: translation is required");
    }

    eventBus.emitGlobal(PDF_TRANSLATOR_EVENTS.CARD.CREATE_REQUESTED, {
      cardData: {
        front: translation.original,
        back: translation.translation,
        source: buildSourceInfo(translation),
        tags: ["翻译", "PDF", translation.language?.source || "unknown"],
        extras: translation.extras || {}
      },
      source: "translator"
    });

    showInfo("卡片创建请求已发送");
  }

  function copyTranslation(text) {
    if (typeof text !== "string") {
      throw new Error("[TranslatorSidebarUI] copyTranslation: text must be a string");
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        logger.info("Translation copied to clipboard");
        showSuccess("译文已复制到剪贴板", 2000);
      })
      .catch((err) => {
        logger.error("Failed to copy translation:", err);
        showError("复制失败", 3000);
      });
  }

  function speak(text) {
    if (typeof text !== "string") {
      throw new Error("[TranslatorSidebarUI] speak: text must be a string");
    }

    if (!("speechSynthesis" in window)) {
      logger.warn("Speech synthesis not supported");
      showError("浏览器不支持语音朗读", 3000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
    logger.info("Speaking text:", text);
  }

  function buildSourceInfo(translation) {
    const fileName = window.PDF_PATH?.split("/").pop() || "Unknown";

    const fromTranslation = translation?.pageNumber;
    if (typeof fromTranslation === "number" && Number.isFinite(fromTranslation) && fromTranslation > 0) {
      return `${fileName} - 第${fromTranslation}页`;
    }

    const pageNumber = getCurrentPageNumber();
    if (typeof pageNumber !== "number" || !Number.isFinite(pageNumber) || pageNumber <= 0) {
      throw new Error("[TranslatorSidebarUI] buildSourceInfo: getCurrentPageNumber() must return a positive number");
    }
    return `${fileName} - 第${pageNumber}页`;
  }

  return {
    createAnnotationFromTranslation,
    createCardFromTranslation,
    copyTranslation,
    speak
  };
}
