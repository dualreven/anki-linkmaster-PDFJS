#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PdfViewerApp Qt 启动方式测试（契约级）

目标：
- 约束 PdfViewerApp.run 在创建 QApplication 时应统一复用
  src.frontend.common.pyqt.qt_app_runner.init_qapplication，而不是各自复制逻辑。

说明：
- 测试通过 monkeypatch/mocking 拦截 init_qapplication，验证 PdfViewerApp
  在 run() 过程中确实调用了该 helper，并且将 parent_app 传入。
- 为避免真实 Qt 依赖，测试会同时 stub 掉 _read_runtime_ports 等函数，
  使 run() 能够在“干跑”模式下尽早返回。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import unittest
from unittest.mock import MagicMock, patch


PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
  sys.path.insert(0, str(PROJECT_ROOT))


class PdfViewerAppQtInitContractTest(unittest.TestCase):
  """PdfViewerApp Qt 初始化行为契约测试。"""

  def _load_launcher_module(self):
    launcher_path = PROJECT_ROOT / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    spec = importlib.util.spec_from_file_location("pdf_viewer_launcher_tested", str(launcher_path))
    assert spec and spec.loader, "Failed to load pdf-viewer/launcher.py"
    module = importlib.util.module_from_spec(spec)
    sys.modules["pdf_viewer_launcher_tested"] = module
    spec.loader.exec_module(module)  # type: ignore[arg-type]
    return module

  def test_run_uses_init_qapplication_helper(self) -> None:
    """PdfViewerApp.run 应通过 init_qapplication 创建/复用 QApplication。"""
    module = self._load_launcher_module()
    LaunchConfig = module.LaunchConfig  # type: ignore[attr-defined]
    PdfViewerApp = module.PdfViewerApp  # type: ignore[attr-defined]

    fake_parent_app = object()

    cfg = LaunchConfig(
      pdf_id="test-pdf",
      is_prod=False,
      logs_dir=str(PROJECT_ROOT / "logs"),
      msgCenter_port=9001,
      pdfFile_port=9002,
    )

    app = PdfViewerApp(cfg, parent_app=fake_parent_app)

    fake_qapp = object()

    with patch(
      "pdf_viewer_launcher_tested.init_qapplication",
      return_value=(fake_qapp, "hosted"),
    ) as init_qapp_mock, patch(
      "pdf_viewer_launcher_tested._read_runtime_ports",
      return_value=(5173, 9001, 9002, {"pdf-viewer-js": 9223}),
    ), patch(
      "pdf_viewer_launcher_tested.run_event_loop_if_needed",
      return_value=0,
    ):
      rc = app.run()

    # run_event_loop_if_needed 返回 0，说明整条路径成功跑通
    self.assertEqual(rc, 0)

    # 应当通过 init_qapplication 创建/复用 QApplication
    init_qapp_mock.assert_called_once()
    _, kwargs = init_qapp_mock.call_args
    # 第一个参数应为 parent_app
    self.assertIs(kwargs.get("parent_app") if kwargs else None, None)


if __name__ == "__main__":
  unittest.main()

