"""
QWebChannel bridge for pdf-home module.

This file provides QWebChannel bridge functionality for the pdf-home module,
allowing JavaScript to directly call Python methods for file selection and
PDF management operations.
"""

from __future__ import annotations

from typing import List, Optional
import logging

from src.qt.compat import QObject, pyqtSignal, pyqtSlot, QFileDialog
import base64
import tempfile
import os
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class PdfHomeBridge(QObject):
    """Bridge object registered on QWebChannel as `pdfHomeBridge`.

    Methods are exposed to JS (Qt will marshal return values to Promises).
    Signals can be subscribed to in JS and are emitted on list updates.
    """

    # Emitted when the PDF list changes; payload is a list[dict]
    pdfListUpdated = pyqtSignal(list)

    def __init__(self, ws_client: Optional[object] = None, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._ws_client = ws_client

    # -------------------- API methods --------------------
    @pyqtSlot(result=list)
    def selectPdfFiles(self) -> List[str]:
        """Open a native file dialog to select PDF files."""
        try:
            # The parent argument is set to None to make the dialog application-modal.
            files, _ = QFileDialog.getOpenFileNames(
                None,
                "选择 PDF 文件",
                os.path.expanduser("~"),
                "PDF Files (*.pdf)"
            )
            logger.info("Selected %d files via QFileDialog", len(files))
            return files
        except Exception as exc:
            logger.exception("selectPdfFiles failed: %s", exc)
            return []

    @pyqtSlot(result=list)
    def getPdfList(self) -> List[dict]:
        """Return current PDF list as a list of dicts."""
        try:
            # For standalone launcher, return empty list or use WebSocket to get list
            logger.info("getPdfList -> standalone mode, returning empty list")
            return []
        except Exception as exc:
            logger.error("getPdfList failed: %s", exc)
            return []

    @pyqtSlot(str, str, result=bool)
    def addPdfFromBase64(self, filename: str, data_base64: str) -> bool:
        try:
            if not filename or not data_base64:
                return False
            # For standalone launcher, use WebSocket to communicate with backend
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_add_request",
                    "request_id": f"add_{filename}",
                    "data": {"filename": filename, "data_base64": data_base64}
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info("addPdfFromBase64 -> forwarded to backend via WebSocket")
                return True
            logger.warning("addPdfFromBase64 -> WebSocket client not available")
            return False
        except Exception as exc:
            logger.error("addPdfFromBase64 failed: %s", exc)
            return False

    @pyqtSlot(list, result=bool)
    def addPdfBatchFromBase64(self, items: list) -> bool:
        if not isinstance(items, list) or not items:
            return False
        # For standalone launcher, use WebSocket to communicate with backend
        if hasattr(self._ws_client, 'sendTextMessage'):
            payload = {
                "type": "pdf_add_batch_request",
                "request_id": f"add_batch_{len(items)}",
                "data": {"items": items}
            }
            self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
            logger.info("addPdfBatchFromBase64 -> forwarded %d items to backend via WebSocket", len(items))
            return True
        logger.warning("addPdfBatchFromBase64 -> WebSocket client not available")
        return False

    @pyqtSlot(str, result=bool)
    def removePdf(self, fileId: str) -> bool:
        """Remove a PDF by id; emits updated list on success."""
        try:
            # For standalone launcher, use WebSocket to communicate with backend
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_remove_request",
                    "request_id": f"remove_{fileId}",
                    "data": {"file_id": fileId}
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info("removePdf -> forwarded to backend via WebSocket")
                return True
            logger.warning("removePdf -> WebSocket client not available")
            return False
        except Exception as exc:
            logger.error("removePdf failed for %s: %s", fileId, exc)
            return False

    @pyqtSlot(str, result=bool)
    def openPdfViewer(self, fileId: str) -> bool:
        """Request opening pdf-viewer window via WebSocket client if available."""
        try:
            payload = {
                "type": "open_pdf",
                "request_id": f"open_{fileId}",
                "data": {"file_id": fileId},
            }
            if hasattr(self._ws_client, 'sendTextMessage'):
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                return True
            logger.warning("WebSocket client not available for openPdfViewer")
            return False
        except Exception as exc:
            logger.error("openPdfViewer failed: %s", exc)
            return False

    @pyqtSlot(str, result=dict)
    def readFileAsBase64(self, filePath: str) -> dict:
        """Read a file and return its base64 content."""
        try:
            path = Path(filePath)

            if not path.exists():
                logger.error(f"File does not exist: {filePath}")
                return {"success": False, "error": "File not found"}

            if not path.is_file():
                logger.error(f"Path is not a file: {filePath}")
                return {"success": False, "error": "Not a file"}

            # Read file content
            with open(path, 'rb') as f:
                file_content = f.read()

            # Convert to base64
            data_base64 = base64.b64encode(file_content).decode('utf-8')

            logger.info(f"Successfully read file: {path.name} ({len(file_content)} bytes)")

            return {
                "success": True,
                "filename": path.name,
                "data_base64": data_base64,
                "size": len(file_content)
            }

        except Exception as exc:
            logger.error(f"readFileAsBase64 failed for {filePath}: %s", exc)
            return {"success": False, "error": str(exc)}