import { getLogger } from "../common/utils/logger.js";
import { showInfo } from "../common/utils/notification.js";
import { attachBasicWindowControls } from "../common/window/basic-window-controls.js";

const logger = getLogger("CustomReviewerWindow");

function resolveClientIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("client-id");
    if (cid && cid.trim()) {
      return cid.trim();
    }
  } catch (e) {
    void e; /* logger-guard */
  }
  // 回退：仍然提供一个可识别的 clientId（虽然可能与后端多实例映射不完全一致）
  return "custom-reviewer";
}

async function bootstrap() {
  logger.info("[CustomReviewer] bootstrap start (skeleton)");

  try {
    const clientId = resolveClientIdFromUrl();

    // 挂载窗口控制条
    await attachBasicWindowControls({
      clientId,
      moduleName: "custom-reviewer",
      bridgeName: "simpleWindowBridge",
      containerSelector: "#window-controls-slot"
    });

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
