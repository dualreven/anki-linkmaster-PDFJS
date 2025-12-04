import { getLogger } from "../common/utils/logger.js";
import { showInfo } from "../common/utils/notification.js";

const logger = getLogger("NewCardSchedulerWindow");

function bootstrap() {
  logger.info("[NewCardScheduler] bootstrap start (skeleton)");

  try {
    const root = document.getElementById("planner-workspace");
    if (root) {
      const info = document.createElement("div");
      info.style.padding = "16px";
      info.textContent = "新卡片规划器窗口已启动（开发中骨架）。";
      root.appendChild(info);
    }
    showInfo("新卡片规划器窗口已打开（开发中骨架）", 2000);
  } catch (e) {
    logger.error("[NewCardScheduler] bootstrap failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }
}

bootstrap();
