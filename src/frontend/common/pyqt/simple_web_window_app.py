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
from pathlib import Path
from typing import Optional

from src.qt.compat import QApplication, QMainWindow, QWebEngineView, QWebEngineSettings, QUrl  # type: ignore
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf-home.launcher import (  # 复用已实现的 logs_dir 与 runtime-ports 工具
    _set_logs_dir as _set_logs_dir_home,          # type: ignore[attr-defined]
    _require_logs_dir as _require_logs_dir_home,  # type: ignore[attr-defined]
    _read_runtime_ports as _read_runtime_ports_home,  # type: ignore[attr-defined]
)

logger = logging.getLogger("simple-web-window")


class SimpleWebWindow(QMainWindow):
  """最小 QWebEngine 容器，仅负责加载指定 URL。"""

  def __init__(self, app: QApplication, *, url: str, title: str) -> None:
    super().__init__()
    self._app = app
    self.setWindowTitle(title)
    self.resize(1100, 760)

    view = QWebEngineView(self)
    settings = view.settings()
    settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)

    view.setUrl(QUrl(url))
    self.setCentralWidget(view)


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
    vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports_home()
    url_port_json = extras.get("url_port")
    url_port = self.config.url_port if self.config.url_port is not None else (url_port_json or self.config.vite_port or vite_json)
    msgCenter_port = self.config.msgCenter_port if self.config.msgCenter_port is not None else msgCenter_json
    pdfFile_port = self.config.pdfFile_port if self.config.pdfFile_port is not None else pdfFile_json

    missing = []
    if url_port is None:
      missing.append("url_port (或 vite_port)")
    if msgCenter_port is None:
      missing.append("msgCenter_port")
    if pdfFile_port is None:
      missing.append("pdfFile_port")
    if missing:
      logs_dir = getattr(self.config, "logs_dir", None)
      where = f"{logs_dir}/runtime-ports.json" if logs_dir else "runtime-ports.json"
      runtime_data = {"vite": vite_json, "msgCenter": msgCenter_json, "pdfFile": pdfFile_json, "url": url_port_json}
      raise RuntimeError(
        f"启动 simple-web-window 失败，端口缺失：{', '.join(missing)}\n"
        f"runtime-ports.json: {runtime_data}\n"
        f"位置：{where}"
      )

    return int(url_port), int(msgCenter_port), int(pdfFile_port), extras

  def _build_frontend_url(self, url_port: int) -> str:
    path = self.entry_path or ""
    return f"http://localhost:{url_port}/{path}/"

  def run(self) -> int:
    if not getattr(self.config, "logs_dir", None):
      raise RuntimeError("缺少 logs_dir：请在 LaunchConfig.logs_dir 指定或通过 CLI --logs-dir 传入")
    _set_logs_dir_home(self.config.logs_dir)

    try:
      logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
      )
    except Exception:
      pass

    if self.mode == "subprocess":
      self.app = QApplication(sys.argv)
      logger.info("✅ Created QApplication (subprocess mode)")
    else:
      self.app = self.parent_app
      logger.info("✅ Using parent QApplication (hosted mode)")

    url_port, msgCenter_port, pdfFile_port, extras = self._resolve_ports()
    logger.info("Resolved ports for %s: url=%s msgCenter=%s pdfFile=%s", self.entry_path, url_port, msgCenter_port, pdfFile_port)

    url = self._build_frontend_url(url_port)
    logger.info("Front-end URL built for %s: %s", self.entry_path, url)

    if self.app is None:
      raise RuntimeError("QApplication 不可用")

    self.window = SimpleWebWindow(self.app, url=url, title=self.window_title)
    self.window.show()

    if self.mode == "subprocess":
      rc = self.app.exec()
      logger.info("simple web window exited with code %s", rc)
      return int(rc or 0)

    logger.info("simple web window started (hosted mode, no event loop)")
    return 0

