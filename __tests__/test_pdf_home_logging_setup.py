import os
from pathlib import Path


def test_pdf_home_file_logger_created(tmp_path, monkeypatch):
    # 切换 project_root 到临时目录下的伪项目结构
    logs_dir = tmp_path / 'logs'
    monkeypatch.chdir(tmp_path)

    # 动态导入模块并覆盖其 project_root
    import importlib.util
    mod_path = Path('src/frontend/pdf-home/launcher.py')
    # 在测试环境中创建最小模块路径结构（避免真实依赖）
    mod_path.parent.mkdir(parents=True, exist_ok=True)
    if not mod_path.exists():
        # 写入一个最小的占位符，导入后会被实际仓库中的同名模块覆盖 sys.path
        mod_path.write_text("", encoding='utf-8')

    import sys
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    import importlib.util as _il
    # 预注入一个假的 src.qt.compat，避免导入 PyQt6 依赖
    import types
    fake_compat = types.ModuleType('fake_compat')
    fake_compat.QApplication = object
    fake_compat.QObject = object
    fake_compat.QUrl = object
    fake_compat.QWebSocket = object
    fake_compat.QWebChannel = object
    fake_compat.QWebEngineView = None
    fake_compat.QWebEnginePage = None
    fake_compat.QWebEngineSettings = None
    import sys as _sys
    _sys.modules['src.qt.compat'] = fake_compat
    # 预注入同目录 main_window 的桩模块，避免相对导入失败
    fake_mw = types.ModuleType('main_window')
    class _MW:
        pass
    fake_mw.MainWindow = _MW
    _sys.modules['main_window'] = fake_mw

    L_spec = _il.spec_from_file_location('pdf_home_launcher_under_test', str(repo_root / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'))
    assert L_spec and L_spec.loader, '无法定位 launcher.py'
    L = _il.module_from_spec(L_spec)
    L_spec.loader.exec_module(L)  # type: ignore
    L.project_root = tmp_path

    # 调用确保文件日志方法
    # 显式指定 logs_dir（遵循禁止兜底原则）
    L._set_logs_dir(str(logs_dir))
    L._ensure_pdf_home_file_logger()

    # 验证日志文件生成
    log_file = logs_dir / 'pdf-home.log'
    assert log_file.exists(), '应创建 logs/pdf-home.log 文件'
    # 写一条日志验证可写
    import logging
    lg = logging.getLogger('pdf-home')
    lg.info('hello')
    content = log_file.read_text(encoding='utf-8')
    assert 'hello' in content

