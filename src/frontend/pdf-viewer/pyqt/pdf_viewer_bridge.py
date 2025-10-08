"""
QWebChannel bridge for pdf-viewer module.

This file provides QWebChannel bridge functionality for the pdf-viewer module,
allowing JavaScript to directly call Python methods for PDF loading, navigation,
and viewer control operations.
"""

from __future__ import annotations

from typing import Optional
import logging
import json
import os
from pathlib import Path
import time

from src.qt.compat import QObject, pyqtSignal, pyqtSlot

logger = logging.getLogger(__name__)


class PdfViewerBridge(QObject):
    """Bridge object registered on QWebChannel as `pdfViewerBridge`.

    Methods are exposed to JS (Qt will marshal return values to Promises).
    Signals can be subscribed to in JS for PDF viewer events.
    """

    # Emitted when PDF loading status changes
    pdfLoadStatusChanged = pyqtSignal(dict)

    # Emitted when navigation occurs
    pdfNavigationChanged = pyqtSignal(dict)

    # Emitted when zoom changes
    pdfZoomChanged = pyqtSignal(dict)

    def __init__(self, ws_client: Optional[object] = None, parent: Optional[QObject] = None, file_path: Optional[str] = None):
        super().__init__(parent)
        self._ws_client = ws_client
        self._current_file_path = file_path
        self._current_page = 1
        self._total_pages = 0
        self._zoom_level = 1.0

        # ensure logs dir
        try:
            logs_dir = Path.cwd() / 'logs'
            logs_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    # -------------------- Clipboard API (QWebChannel) --------------------

    @pyqtSlot(str, result=bool)
    def setClipboardText(self, text: str) -> bool:
        """Set system clipboard text from JS via QWebChannel.

        返回 True 表示设置成功；异常返回 False。
        """
        try:
            # 优先 PyQt6，再回退 PyQt5
            try:
                from PyQt6.QtGui import QGuiApplication  # type: ignore
            except Exception:
                try:
                    from PyQt5.QtGui import QGuiApplication  # type: ignore
                except Exception:
                    QGuiApplication = None  # type: ignore

            if QGuiApplication is None:
                logger.error("QGuiApplication not available; cannot access clipboard")
                return False

            app = QGuiApplication.instance()
            if app is None:
                logger.error("No QGuiApplication instance; clipboard unavailable")
                return False

            clipboard = app.clipboard()
            if clipboard is None:
                logger.error("Clipboard object not available")
                return False

            try:
                # 统一转为 str，Qt 内部使用 UTF-16；Python 侧保证传入为 Unicode 字符串
                clipboard.setText(str(text))
                return True
            except Exception as e:
                logger.error(f"Failed to set clipboard: {e}")
                return False
        except Exception as e:
            logger.error(f"setClipboardText exception: {e}")
            return False

    # -------------------- File Management API --------------------

    @pyqtSlot(str, result=bool)
    def loadPdfFile(self, filePath: str) -> bool:
        """Load a PDF file into the viewer."""
        try:
            path = Path(filePath)

            if not path.exists():
                logger.error(f"PDF file does not exist: {filePath}")
                self.pdfLoadStatusChanged.emit({
                    "status": "error",
                    "message": "File not found",
                    "filePath": filePath
                })
                return False

            if not path.is_file() or not path.suffix.lower() == '.pdf':
                logger.error(f"Invalid PDF file: {filePath}")
                self.pdfLoadStatusChanged.emit({
                    "status": "error",
                    "message": "Invalid PDF file",
                    "filePath": filePath
                })
                return False

            # Store current file
            self._current_file_path = str(path.absolute())

            # Send WebSocket message to backend for PDF loading
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "load_pdf_file",
                    "request_id": f"load_{path.name}",
                    "timestamp": int(time.time() * 1000),
                    "data": {
                        "filename": path.name,
                        "file_path": self._current_file_path,
                        "url": f"http://localhost:8080/pdf-files/{path.name}"
                    }
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info(f"Load PDF request sent for: {path.name}")

                # Emit loading status
                self.pdfLoadStatusChanged.emit({
                    "status": "loading",
                    "message": "Loading PDF...",
                    "filePath": self._current_file_path,
                    "filename": path.name
                })
                return True
            else:
                logger.warning("WebSocket client not available for loadPdfFile")
                return False

        except Exception as exc:
            logger.error(f"loadPdfFile failed for {filePath}: {exc}")
            self.pdfLoadStatusChanged.emit({
                "status": "error",
                "message": str(exc),
                "filePath": filePath
            })
            return False

    @pyqtSlot(result=str)
    def getCurrentFilePath(self) -> str:
        """Get the currently loaded PDF file path."""
        return self._current_file_path or ""

    @pyqtSlot(result=dict)
    def getFileInfo(self) -> dict:
        """Get information about the currently loaded file."""
        try:
            if not self._current_file_path:
                return {"loaded": False}

            path = Path(self._current_file_path)
            if path.exists():
                stat = path.stat()
                return {
                    "loaded": True,
                    "filename": path.name,
                    "filepath": str(path.absolute()),
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "currentPage": self._current_page,
                    "totalPages": self._total_pages,
                    "zoomLevel": self._zoom_level
                }
            else:
                return {"loaded": False, "error": "File no longer exists"}

        except Exception as exc:
            logger.error(f"getFileInfo failed: {exc}")
            return {"loaded": False, "error": str(exc)}

    # -------------------- Navigation API --------------------

    @pyqtSlot(int, result=bool)
    def goToPage(self, pageNumber: int) -> bool:
        """Navigate to a specific page."""
        try:
            if pageNumber < 1 or (self._total_pages > 0 and pageNumber > self._total_pages):
                return False

            self._current_page = pageNumber

            # Send navigation event via WebSocket
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_navigate",
                    "request_id": f"goto_{pageNumber}",
                    "data": {
                        "action": "goto",
                        "page": pageNumber
                    }
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))

            # Emit navigation change
            self.pdfNavigationChanged.emit({
                "action": "goto",
                "currentPage": self._current_page,
                "totalPages": self._total_pages
            })

            logger.info(f"Navigated to page {pageNumber}")
            return True

        except Exception as exc:
            logger.error(f"goToPage failed for page {pageNumber}: {exc}")
            return False

    @pyqtSlot(result=bool)
    def nextPage(self) -> bool:
        """Go to the next page."""
        if self._total_pages > 0 and self._current_page < self._total_pages:
            return self.goToPage(self._current_page + 1)
        return False

    @pyqtSlot(result=bool)
    def previousPage(self) -> bool:
        """Go to the previous page."""
        if self._current_page > 1:
            return self.goToPage(self._current_page - 1)
        return False

    @pyqtSlot(result=int)
    def getCurrentPage(self) -> int:
        """Get the current page number."""
        return self._current_page

    @pyqtSlot(result=int)
    def getTotalPages(self) -> int:
        """Get the total number of pages."""
        return self._total_pages

    # -------------------- Zoom API --------------------

    @pyqtSlot(float, result=bool)
    def setZoom(self, zoomLevel: float) -> bool:
        """Set the zoom level."""
        try:
            if zoomLevel <= 0 or zoomLevel > 10:  # Reasonable zoom limits
                return False

            self._zoom_level = zoomLevel

            # Send zoom event via WebSocket
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": "pdf_zoom",
                    "request_id": f"zoom_{zoomLevel}",
                    "data": {
                        "action": "set",
                        "level": zoomLevel
                    }
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))

            # Emit zoom change
            self.pdfZoomChanged.emit({
                "action": "set",
                "level": self._zoom_level
            })

            logger.info(f"Zoom set to {zoomLevel}")
            return True

        except Exception as exc:
            logger.error(f"setZoom failed for level {zoomLevel}: {exc}")
            return False

    @pyqtSlot(result=bool)
    def zoomIn(self) -> bool:
        """Zoom in by a standard increment."""
        new_zoom = min(10.0, self._zoom_level * 1.25)
        return self.setZoom(new_zoom)

    @pyqtSlot(result=bool)
    def zoomOut(self) -> bool:
        """Zoom out by a standard increment."""
        new_zoom = max(0.1, self._zoom_level * 0.8)
        return self.setZoom(new_zoom)

    @pyqtSlot(result=bool)
    def resetZoom(self) -> bool:
        """Reset zoom to 100%."""
        return self.setZoom(1.0)

    @pyqtSlot(result=float)
    def getZoomLevel(self) -> float:
        """Get the current zoom level."""
        return self._zoom_level

    # -------------------- Status Update Methods --------------------

    def updateLoadStatus(self, status: str, message: str = "", **kwargs):
        """Update PDF loading status (called from launcher)."""
        data = {
            "status": status,
            "message": message,
            "filePath": self._current_file_path
        }
        data.update(kwargs)
        self.pdfLoadStatusChanged.emit(data)

    def updateDocumentInfo(self, total_pages: int, current_page: int = None):
        """Update document information (called when PDF loads)."""
        self._total_pages = total_pages
        if current_page is not None:
            self._current_page = current_page

        self.pdfNavigationChanged.emit({
            "action": "document_loaded",
            "currentPage": self._current_page,
            "totalPages": self._total_pages
        })

    def updateCurrentPage(self, page_number: int):
        """Update current page (called from viewer)."""
        self._current_page = page_number
        self.pdfNavigationChanged.emit({
            "action": "page_changed",
            "currentPage": self._current_page,
            "totalPages": self._total_pages
        })

    def updateZoomLevel(self, zoom_level: float):
        """Update zoom level (called from viewer)."""
        self._zoom_level = zoom_level
        self.pdfZoomChanged.emit({
            "action": "zoom_changed",
            "level": self._zoom_level
        })

    # -------------------- Utility Methods --------------------

    @pyqtSlot(result=dict)
    def getViewerStatus(self) -> dict:
        """Get comprehensive viewer status."""
        return {
            "fileLoaded": bool(self._current_file_path),
            "currentFile": self._current_file_path or "",
            "currentPage": self._current_page,
            "totalPages": self._total_pages,
            "zoomLevel": self._zoom_level,
            "canNavigate": self._total_pages > 1
        }

    @pyqtSlot(str, result=bool)
    def sendCustomMessage(self, messageType: str, data: dict = None) -> bool:
        """Send a custom message via WebSocket."""
        try:
            if hasattr(self._ws_client, 'sendTextMessage'):
                payload = {
                    "type": messageType,
                    "request_id": f"custom_{messageType}",
                    "data": data or {}
                }
                self._ws_client.sendTextMessage(json.dumps(payload, ensure_ascii=False))
                logger.info(f"Custom message sent: {messageType}")
                return True
            return False
        except Exception as exc:
            logger.error(f"sendCustomMessage failed for {messageType}: {exc}")
            return False
