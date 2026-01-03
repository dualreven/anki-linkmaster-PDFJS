import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

export function handleLoadPdfFileMessage({ data, eventBus, logger }) {
  let fileData = null;
  if (data && data.filename && data.url) {
    const pdfId = (() => {
      const raw = (
        typeof data.pdfId === "string"
          ? data.pdfId
          : typeof data.pdf_id === "string"
            ? data.pdf_id
            : typeof data.fileId === "string"
              ? data.fileId
              : ""
      ).trim();
      if (raw) {
        return raw;
      }
      const m = String(data.filename).match(/([a-f0-9]{12})/i);
      return m ? String(m[1]).toLowerCase() : "";
    })();

    if (data.file_path) {
      fileData = {
        file_path: data.file_path,
        filePath: data.file_path,
        filename: data.filename,
        url: data.url,
        pdfId: pdfId || null,
      };
    } else if (data.fileId) {
      fileData = {
        filename: data.filename,
        url: data.url,
        fileId: data.fileId,
        pdfId: pdfId || null,
      };
    }

    if (fileData) {
      logger.info(`Received load PDF file request: ${data.filename}`);
      try {
        logger.warn("[TRACE] Emitting FILE.LOAD.REQUESTED from WebSocketAdapter", fileData);
      } catch {
        // keep legacy behavior (no-op)
      }

      eventBus.emit(
        PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
        fileData,
        { actorId: "WebSocketAdapter" }
      );
      return;
    }

    logger.warn("Invalid load_pdf_file message format:", data);
    return;
  }

  logger.warn("Invalid load_pdf_file message format (missing required fields):", data);
}

