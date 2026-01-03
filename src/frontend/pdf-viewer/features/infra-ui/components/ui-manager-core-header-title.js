export function updateUIManagerHeaderTitle(ctx, filename) {
  const { logger, documentRef = document } = ctx;

  const titleElement = documentRef.getElementById("pdf-title");
  if (!titleElement) {
    logger.warn("Header title element not found");
    return;
  }

  const raw = String(filename ?? "");
  const displayName = raw.endsWith(".pdf") ? raw.slice(0, -4) : raw;

  titleElement.textContent = displayName;
  try {
    titleElement.title = displayName;
  } catch (e) {
    logger.warn("[UIManagerCore] set title attribute failed", e);
  }

  logger.info(`Header title updated: ${displayName}`);
}

