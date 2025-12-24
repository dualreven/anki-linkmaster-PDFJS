#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SimpleWebWindowApp URL 构建测试（client-id 透传）

约束：
- 当 LaunchConfig.extra_params 中包含 client_id 时，_build_frontend_url 应将其追加为
  查询参数 ?client-id=<client_id>；
- 当 extra_params 为空或不含 client_id 时，仅返回基础路径。
"""

from __future__ import annotations

import sys
from pathlib import Path
import importlib.util
import unittest


# __file__ = .../src/frontend/common/pyqt/__tests__/test_*.py
# parents: __tests__ → pyqt → common → frontend → src → <repo root>
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
  sys.path.insert(0, str(PROJECT_ROOT))


class SimpleWebWindowUrlClientIdTest(unittest.TestCase):
  """SimpleWebWindowApp URL 构造行为测试。"""

  @classmethod
  def setUpClass(cls) -> None:
    mod_path = PROJECT_ROOT / "src" / "frontend" / "common" / "pyqt" / "simple_web_window_app.py"
    spec = importlib.util.spec_from_file_location("simple_web_window_app_tested", str(mod_path))
    assert spec and spec.loader, "Failed to load simple_web_window_app.py"
    module = importlib.util.module_from_spec(spec)
    sys.modules["simple_web_window_app_tested"] = module
    spec.loader.exec_module(module)  # type: ignore[arg-type]
    cls.mod = module

  def test_build_url_without_client_id(self) -> None:
    """未提供 client_id 时只返回基础 URL。"""
    LaunchConfig = self.mod.LaunchConfig  # type: ignore[attr-defined]
    SimpleWebWindowApp = self.mod.SimpleWebWindowApp  # type: ignore[attr-defined]

    cfg = LaunchConfig(is_prod=False)
    app = SimpleWebWindowApp(cfg, entry_path="anno-manager", window_title="Anno")
    url = app._build_frontend_url(5173)
    self.assertEqual(url, "http://localhost:5173/anno-manager/")

  def test_build_url_with_client_id(self) -> None:
    """提供 client_id 时应追加 ?client-id 参数。"""
    LaunchConfig = self.mod.LaunchConfig  # type: ignore[attr-defined]
    SimpleWebWindowApp = self.mod.SimpleWebWindowApp  # type: ignore[attr-defined]

    cfg = LaunchConfig(is_prod=False)
    cfg.extra_params = {"client_id": "custom-reviewer-xyz"}
    app = SimpleWebWindowApp(cfg, entry_path="custom-reviewer", window_title="CR")
    url = app._build_frontend_url(5173)
    self.assertTrue(
      url.startswith("http://localhost:5173/custom-reviewer/"),
      msg=f"unexpected base url: {url}",
    )
    self.assertIn("client-id=custom-reviewer-xyz", url)

  def test_build_url_should_ignore_pdf_id(self) -> None:
    """即使传入 pdf_id，也不应通过 URL query 透传（业务参数应走 MsgCenter）。"""
    LaunchConfig = self.mod.LaunchConfig  # type: ignore[attr-defined]
    SimpleWebWindowApp = self.mod.SimpleWebWindowApp  # type: ignore[attr-defined]

    cfg = LaunchConfig(is_prod=False)
    cfg.extra_params = {"client_id": "anno-manager", "pdf_id": "pdf_123"}
    app = SimpleWebWindowApp(cfg, entry_path="anno-manager", window_title="Anno")
    url = app._build_frontend_url(5173)
    self.assertTrue(url.startswith("http://localhost:5173/anno-manager/"))
    self.assertIn("client-id=anno-manager", url)
    self.assertNotIn("pdf-id=", url)


if __name__ == "__main__":
  unittest.main()
