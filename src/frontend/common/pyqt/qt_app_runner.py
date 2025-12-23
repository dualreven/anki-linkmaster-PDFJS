#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qt 应用启动辅助工具

抽取 pdf-home / pdf-viewer / simple_web_window 中重复的 QApplication 启动模式：
- subprocess 模式：自行创建 QApplication 并进入事件循环；
- hosted 模式：复用外部 QApplication，不进入事件循环。
"""

from __future__ import annotations

import sys
from typing import Optional, Tuple, Any

from src.qt.compat import QApplication  # type: ignore


def init_qapplication(parent_app: Optional[QApplication], logger: Any, app_label: str) -> Tuple[QApplication, str]:
  """
  根据是否提供 parent_app 创建或复用 QApplication。

  Returns:
      (app, mode) 其中 mode 为 "subprocess" 或 "hosted"。
  """
  if parent_app is None:
    app = QApplication(sys.argv)
    mode = "subprocess"
    try:
      logger.info("✅ Created QApplication (%s subprocess mode)", app_label)
    except Exception:
      pass
  else:
    app = parent_app
    mode = "hosted"
    try:
      logger.info("✅ Using parent QApplication (%s hosted mode)", app_label)
    except Exception:
      pass
  return app, mode


def run_event_loop_if_needed(app: QApplication, mode: str, logger: Any, app_label: str, *, cleanup_cb=None) -> int:
  """
  在 subprocess 模式下进入 Qt 事件循环；hosted 模式下直接返回 0。

  cleanup_cb: 可选的清理回调，在事件循环退出后调用（如关闭 ws/bridge）。
  """
  if mode == "subprocess":
    rc = app.exec()
    try:
      logger.info("%s window exited with code %s", app_label, rc)
    except Exception:
      pass
    if cleanup_cb:
      try:
        cleanup_cb()
      except Exception:
        # 清理失败不应再次打断退出流程
        pass
    return int(rc or 0)

  try:
    logger.info("%s started (hosted mode, no event loop)", app_label)
  except Exception:
    pass
  return 0

