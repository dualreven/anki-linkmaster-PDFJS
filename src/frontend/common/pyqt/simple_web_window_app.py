#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SimpleWebWindowApp

为 anno-manager / new-card-scheduler / custom-reviewer 提供可复用的 Hosted/CLI 启动骨架：
- 统一使用 LaunchConfig 与 runtime-ports.json 解析端口；
- 复用 pdf-home 的 runtime-ports 读取与 logs_dir 约束；
- 创建一个简单的 QWebEngine 窗口加载指定 entry 路径（如 /anno-manager/）。
"""

from __future__ import annotations

import logging
import sys
from typing import Optional

from src.qt.compat import QApplication, QMainWindow, QWebEngineView, QWebEngineSettings, QUrl, QWebChannel  # type: ignore
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.common.pyqt.ports_utils import resolve_frontend_ports
from src.frontend.common.pyqt.qt_app_runner import init_qapplication, run_event_loop_if_needed
from src.frontend.common.pyqt.window_style import apply_frameless_window_flags
from src.frontend.common.pyqt.simple_window_bridge import SimpleWindowBridge

logger = logging.getLogger("simple-web-window")


class SimpleWebWindow(QMainWindow):
  """最小 QWebEngine 容器，仅负责加载指定 URL。"""

  def __init__(self, app: QApplication, *, url: str, title: str) -> None:
    super().__init__()
    self._app = app
    self.setWindowTitle(title)
    self.resize(1100, 760)

    # 统一应用无边框窗口样式（使用公共 helper）
    apply_frameless_window_flags(self, logger, label=f"simple-web-window[{title}]")

    # 创建 WebEngine 视图
    self.view = QWebEngineView(self)
    settings = self.view.settings()
    settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)

    # 构建 QWebChannel 并注册简单窗口桥接对象（用于 WindowControlsComponent 调用）
    self.web_channel = None
    self.window_bridge = None
    try:
      if self.view.page() is not None:
        self.web_channel = QWebChannel(self.view)  # type: ignore[call-arg]
        self.window_bridge = SimpleWindowBridge(parent=self)
        self.web_channel.registerObject("simpleWindowBridge", self.window_bridge)
        self.view.page().setWebChannel(self.web_channel)
    except Exception:
      # 若 QWebChannel 不可用，不阻断窗口启动；窗口控制按钮后续会 Fail-Fast 记录错误
      self.web_channel = None
      self.window_bridge = None

    self.view.setUrl(QUrl(url))
    self.setCentralWidget(self.view)


class SimpleWebWindowApp:
  """
  通用 Web 窗口启动器：
  - 由 LaunchConfig + entry_path + window_title 参数驱动；
  - 统一从 runtime-ports.json 解析 url_port/msgCenter_port/pdfFile_port（沿用 pdf-home 逻辑）；
  - Hosted 模式不进入事件循环；子进程模式进入 QApplication 事件循环。
  """

  def __init__(self, config: LaunchConfig, *, entry_path: str, window_title: str, parent_app: Optional[QApplication] = None) -> None:
    self.config = config
    self.entry_path = entry_path.strip("/")
    self.window_title = window_title
    self.parent_app = parent_app
    self.mode = "hosted" if parent_app else "subprocess"
    self.app: Optional[QApplication] = None
    self.window: Optional[SimpleWebWindow] = None
    logger.info("SimpleWebWindowApp[%s] initialized (entry=%s)", self.mode, self.entry_path)

  def _resolve_ports(self) -> tuple[int, int, int, dict]:
    url_port, msgCenter_port, pdfFile_port, extras = resolve_frontend_ports(self.config)
    return url_port, msgCenter_port, pdfFile_port, extras

  def _build_frontend_url(self, url_port: int) -> str:
    """
    构建前端 URL：
    - 基础路径：http://localhost:<url_port>/<entry_path>/
    - 若 LaunchConfig.extra_params 中包含 client_id，则追加 ?client-id=<client_id>
    - 注意：禁止通过 URL query 传递业务参数（如 pdf-id）；业务初始化统一通过 MsgCenter 消息完成
    """
    base_path = self.entry_path or ""
    url = f"http://localhost:{url_port}/{base_path}/"

    try:
      extra = getattr(self.config, "extra_params", {}) or {}
      client_id = extra.get("client_id")
      query_parts: list[str] = []
      if client_id:
        from urllib.parse import quote
        query_parts.append(f"client-id={quote(str(client_id))}")
      if query_parts:
        url += "?" + "&".join(query_parts)
    except Exception:
      # URL 构建失败不应影响窗口启动，保持现有行为
      pass

    return url

  def run(self) -> int:
    if not getattr(self.config, "logs_dir", None):
      raise RuntimeError("缺少 logs_dir：请在 LaunchConfig.logs_dir 指定或通过 CLI --logs-dir 传入")

    try:
      logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
      )
    except Exception:
      pass

    # 使用统一的 QApplication 初始化逻辑
    self.app, self.mode = init_qapplication(self.parent_app, logger, f"simple-web-window[{self.entry_path}]")

    url_port, msgCenter_port, pdfFile_port, extras = self._resolve_ports()
    logger.info("Resolved ports for %s: url=%s msgCenter=%s pdfFile=%s", self.entry_path, url_port, msgCenter_port, pdfFile_port)

    url = self._build_frontend_url(url_port)
    logger.info("Front-end URL built for %s: %s", self.entry_path, url)

    if self.app is None:
      raise RuntimeError("QApplication 不可用")

    self.window = SimpleWebWindow(self.app, url=url, title=self.window_title)
    self.window.show()

    return run_event_loop_if_needed(self.app, self.mode, logger, f"simple-web-window[{self.entry_path}]")
