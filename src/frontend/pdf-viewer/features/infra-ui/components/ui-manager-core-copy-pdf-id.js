import { showError, showSuccess } from "../../../../common/utils/notification.js";
import { copyTextUsingHiddenTextarea } from "../../../../common/utils/copy-utils.js";

function copyUsingExecCommand(text) {
  return copyTextUsingHiddenTextarea(String(text ?? ""));
}

export function installCopyPdfIdButton(ctx) {
  const {
    logger,
    documentRef = document,
    windowRef = window,
    getCurrentPdfId,
    setCurrentPdfId
  } = ctx;

  const unsubs = [];

  const updateCopyButtonVisibility = () => {
    const copyBtn = documentRef.getElementById("copy-pdf-id-btn");
    if (!copyBtn) {
      logger.warn("Cannot update button visibility: button not found");
      return;
    }

    if (getCurrentPdfId()) {
      copyBtn.style.display = "flex";
      logger.info(`✅ Copy button shown (PDF ID: ${getCurrentPdfId()})`);
    } else {
      copyBtn.style.display = "none";
      logger.debug("Copy button hidden (no PDF ID)");
    }
  };

  const copyBtn = documentRef.getElementById("copy-pdf-id-btn");
  if (!copyBtn) {
    logger.warn("Copy PDF ID button not found");
    return { updateCopyButtonVisibility, unsubs };
  }

  const pdfIdFromUrl = (() => {
    try {
      const params = new URLSearchParams(windowRef.location.search);
      return params.get("pdf-id");
    } catch {
      return null;
    }
  })();

  if (pdfIdFromUrl && !getCurrentPdfId()) {
    setCurrentPdfId(pdfIdFromUrl);
    updateCopyButtonVisibility();
    logger.info(`PDF ID obtained directly from URL: ${pdfIdFromUrl}`);
  }

  const onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentPdfId = getCurrentPdfId();
    logger.info(`Copy button clicked, currentPdfId: ${currentPdfId}`);

    if (!currentPdfId) {
      logger.error("无法复制：PDF ID 不可用，请确保 URL 中包含 pdf-id 参数", { toast: { type: "error", ms: 5000 } });
      return;
    }

    const ok = copyUsingExecCommand(currentPdfId);
    if (ok) {
      copyBtn.classList.add("copied");
      copyBtn.title = `已复制: ${currentPdfId}`;
      showSuccess("✓ PDF ID 已复制", 2000);
      logger.info(`✅ PDF ID copied (execCommand): ${currentPdfId}`);
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.title = "复制 PDF ID";
        logger.debug("Copy button state reset");
      }, 2000);
    } else {
      logger.error("Copy via execCommand failed");
      showError("✗ 复制失败", 3000);
    }
  };

  copyBtn.addEventListener("click", onClick);
  unsubs.push(() => {
    try {
      copyBtn.removeEventListener("click", onClick);
    } catch (e) {
      logger.warn("[UIManagerCore] copy button detach failed", e);
    }
  });

  logger.info("Copy PDF ID button initialized");

  return { updateCopyButtonVisibility, unsubs };
}

