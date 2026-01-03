import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";

function safeLog(logger, level, message, meta) {
  try { logger?.[level]?.(message, meta); } catch (e) { void e; /* logger-guard */ }
}

export async function parseOutlineNormalizedDest({
  logger,
  outlineDataProvider,
  nativeBookmark,
  pdfDocumentArg = null
}) {
  if (!logger) {
    throw new Error("[OutlineDestParser] logger is required");
  }
  if (!nativeBookmark || typeof nativeBookmark !== "object") {
    throw new Error("[OutlineDestParser] nativeBookmark must be an object");
  }

  const dest = nativeBookmark?.dest;
  if (dest === null || dest === undefined) {
    safeLog(logger, "info", "[Outline][IMPORT] dest missing; skip", { title: nativeBookmark?.title });
    return { pageAt: null, position: null };
  }

  const pdfDocument = pdfDocumentArg || getCurrentPDFDocument();
  if (!pdfDocument) {
    safeLog(logger, "info", "[Outline][IMPORT] pdfDocument missing during parse; skip", { title: nativeBookmark?.title });
    return { pageAt: null, position: null };
  }

  try {
    if (outlineDataProvider && typeof outlineDataProvider.parseDestination === "function") {
      const parsed = await outlineDataProvider.parseDestination(dest);
      const pageAt = parsed?.pageNumber || null;
      let position = null;
      if (pageAt && parsed?.type === "XYZ" && typeof parsed?.y === "number") {
        const { yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
        position = await yToPositionPercent(pdfDocument, pageAt, parsed.y);
      }
      safeLog(logger, "info", "[Outline][IMPORT] parsed via provider", {
        title: nativeBookmark?.title,
        type: parsed?.type ?? null,
        pageAt,
        position
      });
      return { pageAt, position };
    }
  } catch (e) {
    safeLog(logger, "info", "[Outline][IMPORT] provider.parseDestination failed; fallback", {
      title: nativeBookmark?.title,
      err: e?.message
    });
  }

  try {
    const { resolvePdfDest, yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
    const resolved = await resolvePdfDest(pdfDocument, dest);
    const pageAt = resolved?.pageNumber || null;
    let position = null;
    if (pageAt && resolved?.type === "XYZ" && typeof resolved?.y === "number") {
      position = await yToPositionPercent(pdfDocument, pageAt, resolved.y);
    }
    safeLog(logger, "info", "[Outline][IMPORT] parsed via resolvePdfDest", {
      title: nativeBookmark?.title,
      type: resolved?.type ?? null,
      pageAt,
      position
    });
    return { pageAt, position };
  } catch (e) {
    safeLog(logger, "warn", "[Outline][IMPORT] parse normalized dest failed", {
      title: nativeBookmark?.title,
      error: e?.message
    });
    return { pageAt: null, position: null };
  }
}

