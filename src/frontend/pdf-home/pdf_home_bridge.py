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
        # ensure logs dir
        try:
            logs_dir = Path.cwd() / 'logs'
            logs_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    # -------------------- API methods --------------------
    @pyqtSlot(result=list)
    def selectPdfFiles(self) -> List[str]:
        """Open a native file dialog to select PDF files."""
        try:
            logger.info("🔗 [PyQt Bridge] selectPdfFiles method called from JavaScript")
            # The parent argument is set to None to make the dialog application-modal.
            files, _ = QFileDialog.getOpenFileNames(
                None,
                "选择 PDF 文件",
                os.path.expanduser("~"),
                "PDF Files (*.pdf)"
            )
            logger.info("🔗 [PyQt Bridge] Selected %d files via QFileDialog: %s", len(files), [Path(f).name for f in files])
            return files
        except Exception as exc:
            logger.exception("🔗 [PyQt Bridge] selectPdfFiles failed: %s", exc)
            return []

    @pyqtSlot(result=list)
    def getPdfList(self) -> List[dict]:
        """Return current PDF list as a list of dicts."""
        try:
            logger.info("🔗 [PyQt Bridge] getPdfList method called from JavaScript")
            # For standalone launcher, return empty list or use WebSocket to get list
            logger.info("🔗 [PyQt Bridge] getPdfList -> standalone mode, returning empty list")
            return []
        except Exception as exc:
            logger.error("🔗 [PyQt Bridge] getPdfList failed: %s", exc)
            return []

    @pyqtSlot(str, str, result=bool)
    def addPdfFromBase64(self, filename: str, data_base64: str) -> bool:
        try:
            logger.info("🔗 [PyQt Bridge] addPdfFromBase64 method called from JavaScript: filename=%s", filename)
            if not filename or not data_base64:
                logger.warning("🔗 [PyQt Bridge] addPdfFromBase64 -> missing filename or data")
                return False
            # For standalone launcher, use WebSocket to communicate with backend
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_add_request",
                    "request_id": f"add_{filename}",
                    "data": {"filename": filename, "data_base64": data_base64}
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info("🔗 [PyQt Bridge] addPdfFromBase64 -> forwarded to backend via WebSocket")
                return True
            logger.warning("🔗 [PyQt Bridge] addPdfFromBase64 -> WebSocket client not available")
            return False
        except Exception as exc:
            logger.error("🔗 [PyQt Bridge] addPdfFromBase64 failed: %s", exc)
            return False

    @pyqtSlot(list, result=bool)
    def addPdfBatchFromBase64(self, items: list) -> bool:
        logger.info("🔗 [PyQt Bridge] addPdfBatchFromBase64 method called from JavaScript: %d items", len(items) if isinstance(items, list) else 0)
        if not isinstance(items, list) or not items:
            logger.warning("🔗 [PyQt Bridge] addPdfBatchFromBase64 -> invalid or empty items list")
            return False
        # For standalone launcher, use WebSocket to communicate with backend
        if hasattr(self._ws_client, 'sendTextMessage'):
            payload = {
                "type": "pdf_add_batch_request",
                "request_id": f"add_batch_{len(items)}",
                "data": {"items": items}
            }
            self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
            logger.info("🔗 [PyQt Bridge] addPdfBatchFromBase64 -> forwarded %d items to backend via WebSocket", len(items))
            return True
        logger.warning("🔗 [PyQt Bridge] addPdfBatchFromBase64 -> WebSocket client not available")
        return False


    @pyqtSlot(str, result=bool)
    def removePdf(self, fileId: str) -> bool:
        """Remove a PDF by id; emits updated list on success."""
        try:
            logger.info("🔗 [PyQt Bridge] removePdf method called from JavaScript: fileId=%s", fileId)
            # For standalone launcher, use WebSocket to communicate with backend
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_remove_request",
                    "request_id": f"remove_{fileId}",
                    "data": {"file_id": fileId}
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info("🔗 [PyQt Bridge] removePdf -> forwarded to backend via WebSocket")
                return True
            logger.warning("🔗 [PyQt Bridge] removePdf -> WebSocket client not available")
            return False
        except Exception as exc:
            logger.error("🔗 [PyQt Bridge] removePdf failed for %s: %s", fileId, exc)
            return False

    @pyqtSlot(str, result=bool)
    def openPdfViewer(self, fileId: str) -> bool:
        """Request opening pdf-viewer window via WebSocket client if available."""
        try:
            logger.info("🔗 [PyQt Bridge] openPdfViewer method called from JavaScript: fileId=%s", fileId)
            payload = {
                "type": "open_pdf",
                "request_id": f"open_{fileId}",
                "data": {"file_id": fileId},
            }
            if hasattr(self._ws_client, 'sendTextMessage'):
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info("🔗 [PyQt Bridge] openPdfViewer -> forwarded to backend via WebSocket")
                return True
            logger.warning("🔗 [PyQt Bridge] WebSocket client not available for openPdfViewer")
            return False
        except Exception as exc:
            logger.error("🔗 [PyQt Bridge] openPdfViewer failed: %s", exc)
            return False

    @pyqtSlot(str, result=dict)
    def readFileAsBase64(self, filePath: str) -> dict:
        """Read a file and return its base64 content."""
        try:
            logger.info("🔗 [PyQt Bridge] readFileAsBase64 method called from JavaScript: filePath=%s", filePath)
            path = Path(filePath)

            if not path.exists():
                logger.error("🔗 [PyQt Bridge] File does not exist: %s", filePath)
                return {"success": False, "error": "File not found"}

            if not path.is_file():
                logger.error("🔗 [PyQt Bridge] Path is not a file: %s", filePath)
                return {"success": False, "error": "Not a file"}

            # Read file content
            with open(path, 'rb') as f:
                file_content = f.read()

            # Convert to base64
            data_base64 = base64.b64encode(file_content).decode('utf-8')

            logger.info("🔗 [PyQt Bridge] Successfully read file: %s (%d bytes)", path.name, len(file_content))

            return {
                "success": True,
                "filename": path.name,
                "data_base64": data_base64,
                "size": len(file_content)
            }

        except Exception as exc:
            logger.error("🔗 [PyQt Bridge] readFileAsBase64 failed for %s: %s", filePath, exc)
            return {"success": False, "error": str(exc)}

    @pyqtSlot(result=dict)
    def testConnection(self) -> dict:
        """Test QWebChannel connection from PyQt side."""
        try:
            import datetime
            import sys

            timestamp = datetime.datetime.now().isoformat()
            logger.info("🔗 [PyQt Bridge] testConnection called")

            result = {
                "success": True,
                "timestamp": timestamp,
                "message": "PyQt QWebChannel connection verified",
                "bridge_name": "pdfHomeBridge",
                "python_version": f"{sys.version_info.major}.{sys.version_info.minor}"
            }

            logger.info("🔗 [PyQt Bridge] testConnection completed successfully")
            return result

        except Exception as exc:
            import datetime
            logger.error(f"🔗 [PyQt Bridge] testConnection failed: {exc}")
            return {
                "success": False,
                "error": str(exc),
                "timestamp": datetime.datetime.now().isoformat()
            }
