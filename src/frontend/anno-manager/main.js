import { getLogger } from "../common/utils/logger.js";
import { showInfo } from "../common/utils/notification.js";

const logger = getLogger("AnnoManagerWindow");

function bootstrap() {
  logger.info("[AnnoManager] bootstrap start (skeleton)");

  try {
    const root = document.getElementById("anno-manager-table-container");
    if (root) {
      const info = document.createElement("div");
      info.style.padding = "16px";
      info.textContent = "标注管理器窗口已启动（开发中骨架）。";
      root.appendChild(info);
    }
    showInfo("标注管理器窗口已打开（开发中骨架）", 2000);
  } catch (e) {
    logger.error("[AnnoManager] bootstrap failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }
}

bootstrap();
