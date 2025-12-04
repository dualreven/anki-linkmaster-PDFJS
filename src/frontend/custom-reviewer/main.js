import { getLogger } from "../common/utils/logger.js";
import { showInfo } from "../common/utils/notification.js";

const logger = getLogger("CustomReviewerWindow");

function bootstrap() {
  logger.info("[CustomReviewer] bootstrap start (skeleton)");

  try {
    const cardHtmlRoot = document.getElementById("custom-reviewer-card-html");
    if (cardHtmlRoot) {
      const placeholder = document.createElement("div");
      placeholder.style.padding = "8px";
      placeholder.innerText = "定制卡片复习器窗口已启动（开发中骨架）。";
      cardHtmlRoot.appendChild(placeholder);
    }

    showInfo("定制卡片复习器窗口已打开（开发中骨架）", 2000);
  } catch (e) {
    logger.error("[CustomReviewer] bootstrap failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }
}

bootstrap();
