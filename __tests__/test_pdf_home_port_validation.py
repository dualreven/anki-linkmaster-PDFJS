import types
from pathlib import Path
import importlib.util as _il
import sys
import json
import pytest


def _import_pdf_home_launcher(repo_root: Path):
    # 预注入假的 Qt 兼容层，避免依赖 PyQt 环境
    fake_compat = types.ModuleType('fake_compat')
    class _FakeQApp:
        def __init__(self, *args, **kwargs): pass
        def exec(self): return 0
    fake_compat.QApplication = _FakeQApp
    fake_compat.QObject = object
    fake_compat.QUrl = type('QUrl', (), {'__init__': lambda self, s: None, 'toString': lambda self: ''})
    fake_compat.QWebSocket = object
    fake_compat.QWebChannel = object
    fake_compat.QWebEngineView = None
    fake_compat.QWebEnginePage = None
    fake_compat.QWebEngineSettings = None
    sys.modules['src.qt.compat'] = fake_compat

    # 预注入 main_window 与桥接的桩对象，避免导入失败
    fake_mw = types.ModuleType('main_window')
    class _MW:
        def __init__(self, *a, **kw): pass
        def show(self): pass
        def load_frontend(self, *a, **kw): pass
    fake_mw.MainWindow = _MW
    sys.modules['main_window'] = fake_mw

    # 预注入 js_console_logger 模块桩
    fake_js_logger = types.ModuleType('js_console_logger')
    class _JSLogger:
        def __init__(self, *a, **kw): pass
        def start(self): return True
        def stop(self): pass
    fake_js_logger.JSConsoleLogger = _JSLogger
    sys.modules['js_console_logger'] = fake_js_logger

    # 导入被测模块
    L_spec = _il.spec_from_file_location(
        'pdf_home_launcher_under_test',
        str(repo_root / 'src' / 'frontend' / 'pdf-home' / 'launcher.py')
    )
    assert L_spec and L_spec.loader, '无法定位 src/frontend/pdf-home/launcher.py'
    L = _il.module_from_spec(L_spec)
    L_spec.loader.exec_module(L)  # type: ignore
    return L


def test_prod_missing_msgcenter_or_pdf_port_should_raise(tmp_path: Path, monkeypatch):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    L = _import_pdf_home_launcher(repo_root)

    # 准备空的 runtime-ports.json（不包含任何端口）
    logs_dir = tmp_path / 'logs'
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / 'runtime-ports.json').write_text("{}", encoding='utf-8')

    # 构造生产模式配置（不传入端口，期望抛错）
    from src.frontend.common.launch_config import LaunchConfig
    cfg = LaunchConfig(is_prod=True, logs_dir=str(logs_dir))
    app = L.PdfHomeApp(cfg)

    with pytest.raises(RuntimeError) as ei:
        app.run()
    msg = str(ei.value)
    assert 'msgCenter_port' in msg and 'pdfFile_port' in msg


def test_dev_missing_vite_port_should_raise(tmp_path: Path):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    L = _import_pdf_home_launcher(repo_root)

    # dev 下 runtime-ports.json 缺少 vite_port，预期抛错
    logs_dir = tmp_path / 'logs'
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / 'runtime-ports.json').write_text("{}", encoding='utf-8')

    from src.frontend.common.launch_config import LaunchConfig
    cfg = LaunchConfig(is_prod=False, logs_dir=str(logs_dir))
    app = L.PdfHomeApp(cfg)

    with pytest.raises(RuntimeError):
        app.run()


def test_dev_missing_msgcenter_or_pdf_port_also_raise(tmp_path: Path):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    L = _import_pdf_home_launcher(repo_root)

    # dev：提供 vite_port，但缺少 msgCenter/pdfFile 也应抛错（禁止兜底）
    logs_dir = tmp_path / 'logs'
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / 'runtime-ports.json').write_text(
        json.dumps({'vite_port': 5173}, ensure_ascii=False), encoding='utf-8'
    )

    from src.frontend.common.launch_config import LaunchConfig
    cfg = LaunchConfig(is_prod=False, logs_dir=str(logs_dir))
    app = L.PdfHomeApp(cfg)

    with pytest.raises(RuntimeError) as ei:
        app.run()
    assert 'msgCenter_port' in str(ei.value)
