# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Optional
import logging

logger = logging.getLogger("backend-launcher.session-registry")


class AppSessionRegistry:
    """
    运行期单例注册表：
    - pdf-home：全局仅一个实例
    - pdf-viewer：按 pdf_id 单例，一个 pdf_id 仅一个实例

    仅保存“轻引用”（应用对象或其 window 对象）。调用处负责生命周期与清理。
    """

    def __init__(self) -> None:
        self._pdf_home_app: Optional[Any] = None
        self._viewer_by_pdf: Dict[str, Any] = {}

    # -------- pdf-home 单例 --------
    def get_pdf_home(self) -> Optional[Any]:
        return self._pdf_home_app

    def set_pdf_home(self, app: Any) -> None:
        self._pdf_home_app = app

    # -------- pdf-viewer 单例（按 pdf_id） --------
    def get_viewer(self, pdf_id: str) -> Optional[Any]:
        return self._viewer_by_pdf.get(str(pdf_id))

    def set_viewer(self, pdf_id: str, app: Any) -> None:
        self._viewer_by_pdf[str(pdf_id)] = app

    def discard_viewer(self, pdf_id: str) -> None:
        self._viewer_by_pdf.pop(str(pdf_id), None)


_REGISTRY: Optional[AppSessionRegistry] = None


def get_registry() -> AppSessionRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = AppSessionRegistry()
    return _REGISTRY


def activate_window(win: Any) -> bool:
    """
    激活窗口：显示、前置、激活。
    - 仅最佳努力，不抛异常。
    """
    ok = False
    if not win:
        return False
    try:
        if hasattr(win, "show"):
            win.show()
        ok = True
    except Exception:
        pass
    try:
        # Qt 常规激活序列
        if hasattr(win, "raise_"):
            win.raise_()
    except Exception:
        pass
    try:
        if hasattr(win, "activateWindow"):
            win.activateWindow()
    except Exception:
        pass
    return ok

