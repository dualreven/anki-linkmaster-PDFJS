import { getLogger } from "../common/utils/logger.js";
import "../common/polyfills.js";
import { showError } from "../common/utils/notification.js";

const logger = getLogger("new-card-scheduler.index");
logger.info("[BOOT] new-card-scheduler index.js start");

async function startApp() {
  try {
    await import("./main.js");
  } catch (error) {
    logger.error("[NewCardScheduler] bootstrap failed in index.js", error);
    try { showError("启动失败: " + (error && error.message ? error.message : String(error)), 5000); } catch (e) { void e; /* logger-guard */ }
    throw error;
  }
}

async function launch() {
  try {
    await startApp();
  } catch (e) {
    void e; /* logger-guard */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", launch);
} else {
  launch();
}
