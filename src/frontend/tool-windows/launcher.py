#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewCardScheduler/CustomReviewer Launchers

为两个工具窗口复用 SimpleWebWindowApp 提供薄包装，供 Hosted/CLI 启动使用。
"""

from __future__ import annotations

from typing import Optional

from src.qt.compat import QApplication  # type: ignore
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.common.pyqt.simple_web_window_app import SimpleWebWindowApp


class NewCardSchedulerApp(SimpleWebWindowApp):
  """新卡片规划器窗口启动器。"""

  def __init__(self, config: LaunchConfig, parent_app: Optional[QApplication] = None) -> None:
    super().__init__(config, entry_path="new-card-scheduler", window_title="新卡片规划器", parent_app=parent_app)


class CustomReviewerApp(SimpleWebWindowApp):
  """定制卡片复习器窗口启动器。"""

  def __init__(self, config: LaunchConfig, parent_app: Optional[QApplication] = None) -> None:
    super().__init__(config, entry_path="custom-reviewer", window_title="定制卡片复习器", parent_app=parent_app)

