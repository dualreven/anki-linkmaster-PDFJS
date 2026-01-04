#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SimpleWindowBridge

为 SimpleWebWindow 提供最小的 QWebChannel 桥接对象，只暴露窗口控制相关方法：
- minimizeWindow / maximizeWindow / requestCloseWindow
- startWindowDrag / stopWindowDrag

实现方式：
- 继承 WindowControlsMixin，将窗口控制逻辑复用到三个工具窗口
  （new-card-scheduler / custom-reviewer）。
"""

from __future__ import annotations

from typing import Optional, Any

from src.qt.compat import QObject, pyqtSlot  # type: ignore
from src.frontend.common.pyqt.window_controls_mixin import WindowControlsMixin


class SimpleWindowBridge(QObject, WindowControlsMixin):
  """
  简单窗口桥接对象，仅用于窗口控制（供 WindowControlsComponent 通过 QWebChannel 调用）。

  注册名建议为 "simpleWindowBridge"：
      channel.registerObject("simpleWindowBridge", bridge)
  """

  def __init__(self, parent: Optional[QObject] = None) -> None:
    super().__init__(parent)
    # WindowControlsMixin 期望 parent 属性指向实际的窗口对象
    self.parent = parent  # type: ignore[assignment]
    self._init_drag_mode()

  # 由于 WindowControlsMixin 已通过 @pyqtSlot 暴露全部窗口控制方法，
  # 此处无需再添加额外的 slot；SimpleWebWindowBridge 仅作为 Mixin 的载体。
