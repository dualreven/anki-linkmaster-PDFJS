"""
Mirror of backend QWebChannel bridge for pdf-home module.

Note: This file is placed under the frontend tree per user request.
It is not loaded by the browser; QWebChannel bridge runs in Python.
Keep content consistent with src/backend/app/pdf_home_bridge.py.
"""

from __future__ import annotations

from typing import List, Optional
import logging

from src.backend.qt.compat import QObject, pyqtSignal, pyqtSlot
import base64
import tempfile
import os

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
        # Note: PDF manager functionality removed for standalone launcher

    # -------------------- utility --------------------
    # Note: PDF manager functionality removed for standalone launcher
    # Methods now use WebSocket communication with backend

    # -------------------- API methods --------------------
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
            if hasattr(self._ws_client, 'send_json'):
                payload = {
                    "type": "pdf_add_request",
                    "request_id": f"add_{filename}",
                    "data": {"filename": filename, "data_base64": data_base64}
                }
                self._ws_client.send_json(payload)
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
        if hasattr(self._ws_client, 'send_json'):
            payload = {
                "type": "pdf_add_batch_request",
                "request_id": f"add_batch_{len(items)}",
                "data": {"items": items}
            }
            self._ws_client.send_json(payload)
            logger.info("addPdfBatchFromBase64 -> forwarded %d items to backend via WebSocket", len(items))
            return True
        logger.warning("addPdfBatchFromBase64 -> WebSocket client not available")
        return False

    @pyqtSlot(str, result=bool)
    def removePdf(self, fileId: str) -> bool:
        """Remove a PDF by id; emits updated list on success."""
        try:
            # For standalone launcher, use WebSocket to communicate with backend
            if hasattr(self._ws_client, 'send_json'):
                payload = {
                    "type": "pdf_remove_request",
                    "request_id": f"remove_{fileId}",
                    "data": {"file_id": fileId}
                }
                self._ws_client.send_json(payload)
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
            if hasattr(self._ws_client, 'send_json'):
                self._ws_client.send_json(payload)  # type: ignore[attr-defined]
                return True
            if hasattr(self._ws_client, '_socket') and hasattr(self._ws_client._socket, 'sendTextMessage'):
                import json as _json
                self._ws_client._socket.sendTextMessage(_json.dumps(payload, ensure_ascii=False))  # type: ignore[attr-defined]
                return True
            logger.warning("WebSocket client not available for openPdfViewer")
            return False
        except Exception as exc:
            logger.error("openPdfViewer failed: %s", exc)
            return False
