#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
window_style

统一管理 PyQt 窗口样式相关的小工具（当前聚焦“无边框窗口”设置）。

目标：
- 为 pdf-home / pdf-viewer / SimpleWebWindow 等窗口提供一致的无边框配置逻辑；
- 避免在各模块中重复编写 Qt.WindowType.FramelessWindowHint 的样板代码；
- 保持 Fail-Fast：调用方显式决定是否需要无边框，helper 只负责执行具体设置与日志记录。
"""

from __future__ import annotations

from typing import Any

from src.qt.compat import Qt  # type: ignore


def apply_frameless_window_flags(window: Any, logger: Any | None = None, label: str | None = None) -> None:
  """
  为给定窗口应用“无边框窗口”样式：
  - 保持正常窗口（Window）；
  - 移除系统标题栏与原生按钮（FramelessWindowHint）。

  Args:
      window: 任何具有 setWindowFlags(Qt.WindowType) 方法的窗口对象（通常是 QMainWindow/QWidget 子类）
      logger: 可选日志对象（需支持 info/warning），用于记录设置结果
      label: 便于日志识别当前窗口的标识（如 "pdf-home" / "pdf-viewer" / "simple-web-window[/new-card-scheduler]"）

  注意：
      - 若底层 Qt 不支持 FramelessWindowHint（极少见），本函数会静默回退，不抛异常。
  """
  name = label or getattr(window, "__class__", type("X", (), {})).__name__
  try:
    window.setWindowFlags(
      Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint  # type: ignore[attr-defined]
    )
    if logger is not None:
      try:
        logger.info("apply_frameless_window_flags: applied for %s", name)
      except Exception:
        pass
  except Exception as exc:
    if logger is not None:
      try:
        logger.warning("apply_frameless_window_flags: failed for %s: %s", name, exc)
      except Exception:
        pass
