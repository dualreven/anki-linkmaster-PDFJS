"""Lightweight registry for API domain services.

This enables plugin-like isolation at the API layer while keeping
`PDFLibraryAPI`'s public interface stable. Services are optional: if a
service is not registered, the facade will use its built-in fallback
implementation to preserve behavior.
"""

from __future__ import annotations

from typing import Any, Dict, Optional


# Service keys (stable identifiers)
SERVICE_PDF_HOME_SEARCH = "pdf-home.search"
SERVICE_PDF_HOME_ADD = "pdf-home.add"
SERVICE_PDF_VIEWER_BOOKMARK = "pdf-viewer.bookmark"


class ServiceRegistry:
    """A tiny service registry for API-level domain services."""

    def __init__(self) -> None:
        self._services: Dict[str, Any] = {}

    def register(self, name: str, service: Any) -> None:
        if not isinstance(name, str) or not name:
            raise ValueError("service name must be non-empty string")
        if service is None:
            raise ValueError("service instance is required")
        self._services[name] = service

    def unregister(self, name: str) -> None:
        self._services.pop(name, None)

    def get(self, name: str) -> Optional[Any]:
        return self._services.get(name)

    def has(self, name: str) -> bool:
        return name in self._services

