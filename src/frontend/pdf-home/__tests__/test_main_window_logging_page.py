#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdf-home MainWindow 日志页面行为测试（不依赖真实 PyQt 环境）

目的：
- 约束 PdfHomeLoggingWebPage 未来的核心行为契约：
  - 继承自 BaseLoggingWebPage（统一 JS 控制台日志实现）；
  - 对包含 "Console log recorded successfully" 的消息进行过滤，不再写入日志或透传 js_logger；
  - 对普通消息则调用父类实现（这里通过 mock js_logger 观察调用情况）。

说明：
- 这里是“文档/契约式”测试，不直接构造 QApplication 或真实 QWebEngineView。
- 通过动态导入 pdf-home.main_window 并构造一个最小伪页面类，模拟 javaScriptConsoleMessage 调用路径。
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from typing import Any

import unittest
from unittest.mock import MagicMock


PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
  sys.path.insert(0, str(PROJECT_ROOT))


class _DummyQWebEnginePage:
  """
  最小的 QWebEnginePage 替身：
  - 提供 javaScriptConsoleMessage 接口，便于 BaseLoggingWebPage.super() 调用。
  - 记录最后一次调用参数，供测试断言。
  """

  def __init__(self, *args: Any, **kwargs: Any) -> None:
    self.last_call = None

  def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore[override]
    self.last_call = (level, message, lineNumber, sourceID)
    return None


class PdfHomeLoggingPageContractTest(unittest.TestCase):
  """PdfHomeLoggingWebPage 行为契约测试。"""

  @classmethod
  def setUpClass(cls) -> None:
    # 动态加载 pdf-home/main_window.py 模块
    main_window_path = PROJECT_ROOT / "src" / "frontend" / "pdf-home" / "main_window.py"
    spec = importlib.util.spec_from_file_location("pdf_home_main_window_tested", str(main_window_path))
    assert spec and spec.loader, "Failed to load pdf-home/main_window.py"
    module = importlib.util.module_from_spec(spec)
    sys.modules["pdf_home_main_window_tested"] = module
    spec.loader.exec_module(module)  # type: ignore[arg-type]
    cls._module = module

    # 替换 BaseLoggingWebPage 的基类为我们的 _DummyQWebEnginePage，以避免真实 Qt 依赖
    from src.frontend.pyqtui import js_console_logger as js_logger_mod  # type: ignore[import]
    if hasattr(js_logger_mod, "QWebEnginePage"):
      js_logger_mod.QWebEnginePage = _DummyQWebEnginePage  # type: ignore[assignment]

    # 取出 PdfHomeLoggingWebPage 类型（后续在测试中实例化）
    cls.PdfHomeLoggingWebPage = getattr(module, "PdfHomeLoggingWebPage")

  def test_pdf_home_logging_page_inherits_base_logging_page(self) -> None:
    """PdfHomeLoggingWebPage 必须继承 BaseLoggingWebPage。"""
    from src.frontend.pyqtui.js_console_logger import BaseLoggingWebPage

    self.assertTrue(
      issubclass(self.PdfHomeLoggingWebPage, BaseLoggingWebPage),
      "PdfHomeLoggingWebPage 应继承 BaseLoggingWebPage 以复用统一 JS 控制台日志实现",
    )

  def test_console_log_recorded_successfully_is_filtered(self) -> None:
    """包含 'Console log recorded successfully' 的消息应被过滤，不调用 js_logger。"""
    fake_parent = object()
    fake_logger = MagicMock()

    page = self.PdfHomeLoggingWebPage(fake_parent, log_file_path=None, js_logger=fake_logger, pdf_id="pdf-home-test")

    # 触发过滤条件的消息
    page.javaScriptConsoleMessage("InfoMessageLevel", "Console log recorded successfully", 1, "about:blank")

    # js_logger 不应被调用
    fake_logger.log_message.assert_not_called()

  def test_normal_message_is_forwarded_to_js_logger(self) -> None:
    """普通消息应继续透传给 js_logger（由 BaseLoggingWebPage 负责调用）。"""
    fake_parent = object()
    fake_logger = MagicMock()

    page = self.PdfHomeLoggingWebPage(fake_parent, log_file_path=None, js_logger=fake_logger, pdf_id="pdf-home-test")

    # 普通消息
    page.javaScriptConsoleMessage("InfoMessageLevel", "[INFO] hello", 10, "about:blank")

    # 由于我们没有真正写文件，这里仅验证 js_logger 被调用一次即可
    fake_logger.log_message.assert_called_once()


if __name__ == "__main__":
  unittest.main()

