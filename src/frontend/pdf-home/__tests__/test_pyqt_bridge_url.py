import importlib.util
from pathlib import Path


def load_module():
    """Dynamically load pyqt-bridge.py as a module for testing pure helpers."""
    # __file__ = repo/src/frontend/pdf-home/__tests__/...
    # parents[4] = repo 根目录
    root = Path(__file__).resolve().parents[4]
    mod_path = root / 'src' / 'frontend' / 'pdf-home' / 'pyqt-bridge.py'
    spec = importlib.util.spec_from_file_location('pyqt_bridge_testmod', mod_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


def test_build_pdf_viewer_url_basic():
    mod = load_module()
    fn = getattr(mod, 'build_pdf_viewer_url')
    url = fn(3000, 8765, 8080, 'abc123')
    assert url.startswith('http://localhost:3000/pdf-viewer/?')
    assert 'msgCenter=8765' in url
    assert 'pdfs=8080' in url
    assert 'pdf-id=abc123' in url


def test_build_pdf_viewer_url_with_nav():
    mod = load_module()
    fn = getattr(mod, 'build_pdf_viewer_url')
    url = fn(3001, 9000, 9001, '中国 文档', page_at=5, position=150)
    # position 应被限制在 0-100
    assert 'position=100.0' in url
    assert 'page-at=5' in url
    # pdf-id 应进行 URL 编码
    assert 'pdf-id=%E4%B8%AD%E5%9B%BD%20%E6%96%87%E6%A1%A3' in url
