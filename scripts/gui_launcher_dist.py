#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dist 产物 GUI 启动器（可打包进 dist/latest/）

用途
- 在 dist/latest 下以 Hosted（寄宿）方式启动后端与前端（pdf-home/pdf-viewer），复用同一 QApplication。

说明
- 本脚本在构建时会被复制到 dist/latest/ 并从该目录运行。
- 代码中的路径与导入均以“当前脚本位于 dist/latest”为前提。
"""
from __future__ import annotations

import sys
import os
import json
import importlib
import importlib.util
from pathlib import Path
from typing import Optional, Dict, List

try:
    from PyQt6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QPushButton, QTextEdit, QLabel
    )
    from PyQt6.QtCore import QThread, pyqtSignal, QCoreApplication, Qt
    from PyQt6.QtGui import QTextCursor
except Exception:
    QApplication = None  # type: ignore
    QMainWindow = object  # type: ignore


def get_dist_latest_root() -> Path:
    # 运行时：本脚本位于 dist/latest
    return Path(__file__).resolve().parent


def _init_qtwebengine_runtime() -> None:
    try:
        # 初始化 QtWebEngine（Qt6）
        try:
            from PyQt6.QtWebEngineCore import QtWebEngine  # type: ignore
            try:
                QtWebEngine.initialize()  # type: ignore[attr-defined]
            except Exception:
                pass
        except Exception:
            pass
        # 要求：在创建 QApplication 之前设置共享 OpenGL 上下文，并尽早导入 QtWebEngine 模块
        try:
            QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts, True)  # type: ignore
        except Exception:
            pass
        try:
            import PyQt6.QtWebEngineWidgets  # type: ignore  # noqa: F401
            import PyQt6.QtWebEngineCore     # type: ignore  # noqa: F401
        except Exception:
            pass
        # 兼容：禁用 GPU 与 sandbox，使用软件 OpenGL
        os.environ.setdefault('QTWEBENGINE_CHROMIUM_FLAGS', '--disable-gpu')
        os.environ.setdefault('QT_OPENGL', 'software')
        os.environ.setdefault('QTWEBENGINE_DISABLE_SANDBOX', '1')
        # 设置 QtWebEngineProcess 可执行路径 + 将 Qt bin 目录加入 PATH（Windows）
        try:
            from PyQt6.QtCore import QLibraryInfo
            bin_dir = QLibraryInfo.path(QLibraryInfo.LibraryPath.BinariesPath)  # type: ignore[attr-defined]
            if bin_dir:
                bin_path = Path(bin_dir)
                candidates = [
                    bin_path / 'QtWebEngineProcess.exe',  # Windows
                    bin_path / 'QtWebEngineProcess',      # Linux/Mac
                ]
                for exe in candidates:
                    if exe.exists():
                        os.environ.setdefault('QTWEBENGINEPROCESS_PATH', str(exe))
                        break
                # prepend to PATH for child processes
                if os.name == 'nt':
                    os.environ['PATH'] = str(bin_path) + os.pathsep + os.environ.get('PATH', '')
        except Exception:
            pass
    except Exception:
        pass


def _switch_to_dist_src() -> None:
    """确保 `import src.*` 指向 dist/latest/src，并清理已加载的源码包。"""
    dist_src = get_dist_latest_root() / 'src'
    # 清理缓存
    for k in list(sys.modules.keys()):
        if k == 'src' or k.startswith('src.') or k == 'core_utils' or k.startswith('core_utils.'):
            try:
                del sys.modules[k]
            except Exception:
                pass
    # 置首 sys.path
    s = str(dist_src)
    if s in sys.path:
        sys.path.remove(s)
    sys.path.insert(0, s)


class ProcThread(QThread):
    log = pyqtSignal(str)
    done = pyqtSignal(int)

    def __init__(self, cmd: List[str], cwd: Optional[Path] = None):
        super().__init__()
        self.cmd = cmd
        self.cwd = cwd

    def run(self):
        try:
            import subprocess
            self.log.emit(f"$ {' '.join(self.cmd)}\n")
            subprocess.Popen(
                self.cmd,
                cwd=str(self.cwd) if self.cwd else None,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0),
            )
            self.done.emit(0)
        except Exception as e:
            self.log.emit(f"[ERROR] 启动失败: {e}\n")
            self.done.emit(1)


class Main(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Dist GUI Launcher (dist/latest)')
        self.resize(760, 480)
        self._backend = None
        self._threads: list[ProcThread] = []
        # 持有前端实例强引用，避免 Hosted 模式 run() 返回后被GC导致窗口闪退
        self._frontend_sessions: dict[str, object] = {}
        self._init_ui()

    def _init_ui(self):
        root = QWidget()
        self.setCentralWidget(root)
        layout = QVBoxLayout(root)

        layout.addWidget(QLabel(str(get_dist_latest_root())))

        row = QHBoxLayout()
        btn_b_start = QPushButton('启动后端(Hosted)')
        btn_b_stop = QPushButton('停止后端')
        btn_b_stat = QPushButton('后端状态')
        btn_b_start.clicked.connect(self._start_backend)
        btn_b_stop.clicked.connect(self._stop_backend)
        btn_b_stat.clicked.connect(self._status_backend)
        row.addWidget(btn_b_start)
        row.addWidget(btn_b_stop)
        row.addWidget(btn_b_stat)
        layout.addLayout(row)

        row2 = QHBoxLayout()
        btn_home = QPushButton('启动 PDF-Home (Hosted)')
        btn_viewer = QPushButton('启动 PDF-Viewer (Hosted)')
        btn_home.clicked.connect(self._start_pdf_home)
        btn_viewer.clicked.connect(self._start_pdf_viewer)
        row2.addWidget(btn_home)
        row2.addWidget(btn_viewer)
        layout.addLayout(row2)

        self.log = QTextEdit()
        self.log.setReadOnly(True)
        layout.addWidget(self.log)

    def _append(self, s: str):
        if not s.endswith('\n'):
            s += '\n'
        try:
            self.log.moveCursor(QTextCursor.MoveOperation.End)  # type: ignore
        except Exception:
            pass
        self.log.insertPlainText(s)

    def _run_cmd(self, cmd: List[str]) -> None:
        t = ProcThread(cmd=cmd, cwd=get_dist_latest_root())
        t.setParent(self)
        self._threads.append(t)
        t.log.connect(self._append)
        t.done.connect(lambda rc, _t=t: self._on_thread_done(_t, rc))
        t.start()

    def _on_thread_done(self, t: ProcThread, rc: int) -> None:
        try:
            if t in self._threads:
                self._threads.remove(t)
        except Exception:
            pass
        try:
            if t.isRunning():
                t.wait(1500)
        except Exception:
            pass
        try:
            t.deleteLater()
        except Exception:
            pass

    def _ensure_ports(self) -> Dict[str, int]:
        ports: Dict[str, int] = {}
        try:
            cfg = get_dist_latest_root() / 'logs' / 'runtime-ports.json'
            if cfg.exists():
                data = json.loads(cfg.read_text(encoding='utf-8') or '{}')
                if 'msgCenter_port' in data:
                    ports['msgCenter_port'] = int(data['msgCenter_port'])
                if 'pdfFile_port' in data:
                    ports['pdfFile_port'] = int(data['pdfFile_port'])
        except Exception as e:
            self._append(f"[WARN] 读取端口失败: {e}")
        return ports

    # ---- backend ----
    def _start_backend(self):
        _switch_to_dist_src()
        self._append(f"sys.path[0]={sys.path[0]}")
        try:
            mod = importlib.import_module('src.backend.launcher')
            # 显式声明发行根，确保数据库/静态等路径与脚本所在目录一致，而非受 CWD 影响
            os.environ.setdefault('LINKMASTER_BASE_DIR', str(get_dist_latest_root()))
            os.environ.setdefault('LINKMASTER_STATIC_DIR', str(get_dist_latest_root() / 'static'))
            os.environ.setdefault('LINKMASTER_PDFS_DIR', str(get_dist_latest_root() / 'data' / 'pdfs'))
            app = QApplication.instance()
            BackendLauncher = getattr(mod, 'BackendLauncher')
            db_path = str(get_dist_latest_root() / 'data' / 'anki_linkmaster.db')
            self._append(f"backend db_path={db_path}")
            self._backend = BackendLauncher(parent_app=app, show_ui=False, db_path=db_path)
            ok = self._backend.start()
            self._append(f"后端 Hosted 启动: {ok}")
        except Exception as e:
            self._append(f"[ERROR] 后端 Hosted 启动异常: {e}")

    def _stop_backend(self):
        if self._backend:
            try:
                self._backend.stop()
                self._append('后端已停止')
            except Exception as e:
                self._append(f"[WARN] 停止后端失败: {e}")
            finally:
                self._backend = None
        else:
            # 回退到 CLI（异步执行，持有线程引用）
            self._run_cmd([sys.executable, '-X', 'utf8', str(get_dist_latest_root() / 'src' / 'backend' / 'launcher.py'), 'stop'])

    def _status_backend(self):
        if self._backend:
            try:
                self._append(json.dumps(self._backend.get_status(), ensure_ascii=False, indent=2))
                return
            except Exception as e:
                self._append(f"[WARN] Hosted 状态异常: {e}")
        # 回退到 CLI（异步执行，持有线程引用）
        self._run_cmd([sys.executable, '-X', 'utf8', str(get_dist_latest_root() / 'src' / 'backend' / 'launcher.py'), 'status'])

    # ---- home/viewer ----
    def _start_pdf_home(self):
        _switch_to_dist_src()
        # 关键：确保 compat 在 QtWebEngine 初始化后重新加载，避免早期导入时 QWebEngineView 为 None
        try:
            import importlib as _il
            compat = _il.import_module('src.qt.compat')
            _il.reload(compat)
            self._append("reloaded src.qt.compat")
        except Exception as _e:
            self._append(f"[WARN] reload compat failed: {_e}")
        ports = self._ensure_ports()
        try:
            launcher_path = get_dist_latest_root() / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'
            spec = importlib.util.spec_from_file_location('dist_pdf_home_launcher', str(launcher_path))
            if spec is None or spec.loader is None:
                raise ImportError('无法定位 pdf-home launcher 模块')
            home_dir = launcher_path.parent
            if str(home_dir) not in sys.path:
                sys.path.insert(0, str(home_dir))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore
            from src.frontend.common.launch_config import LaunchConfig  # type: ignore
            # 同步发行根环境变量，避免 pdf-home 侧的任何路径解析受当前工作目录影响
            os.environ.setdefault('LINKMASTER_BASE_DIR', str(get_dist_latest_root()))
            cfg = LaunchConfig(is_prod=True, keep_backend=True,
                               msgCenter_port=ports.get('msgCenter_port'),
                               pdfFile_port=ports.get('pdfFile_port'), source='gui')
            app = QApplication.instance()
            PdfHomeApp = getattr(mod, 'PdfHomeApp')
            inst = PdfHomeApp(cfg, parent_app=app)
            self._frontend_sessions['pdf-home'] = inst
            rc = inst.run()
            self._append(f"PDF-Home 启动 rc={rc}")
            try:
                w = getattr(inst, 'window', None)
                if w is not None:
                    try:
                        w.destroyed.connect(lambda _=None: self._frontend_sessions.pop('pdf-home', None))  # type: ignore
                    except Exception:
                        pass
            except Exception:
                pass
        except Exception as e:
            self._append(f"[ERROR] 启动 pdf-home 异常: {e}，回退 CLI …")
            self._run_cmd([sys.executable, '-X', 'utf8', str(launcher_path), '--prod', '--keep-backend'])

    def _start_pdf_viewer(self):
        _switch_to_dist_src()
        try:
            import importlib as _il
            compat = _il.import_module('src.qt.compat')
            _il.reload(compat)
            self._append("reloaded src.qt.compat")
        except Exception as _e:
            self._append(f"[WARN] reload compat failed: {_e}")
        ports = self._ensure_ports()
        try:
            launcher_path = get_dist_latest_root() / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'
            spec = importlib.util.spec_from_file_location('dist_pdf_viewer_launcher', str(launcher_path))
            if spec is None or spec.loader is None:
                raise ImportError('无法定位 pdf-viewer launcher 模块')
            viewer_dir = launcher_path.parent
            if str(viewer_dir) not in sys.path:
                sys.path.insert(0, str(viewer_dir))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore
            from src.frontend.common.launch_config import LaunchConfig  # type: ignore
            os.environ.setdefault('LINKMASTER_BASE_DIR', str(get_dist_latest_root()))
            cfg = LaunchConfig(is_prod=True, keep_backend=True,
                               msgCenter_port=ports.get('msgCenter_port'),
                               pdfFile_port=ports.get('pdfFile_port'), source='gui')
            app = QApplication.instance()
            PdfViewerApp = getattr(mod, 'PdfViewerApp')
            inst = PdfViewerApp(cfg, parent_app=app)
            self._frontend_sessions['pdf-viewer'] = inst
            rc = inst.run()
            self._append(f"PDF-Viewer 启动 rc={rc}")
            try:
                w = getattr(inst, 'window', None)
                if w is not None:
                    try:
                        w.destroyed.connect(lambda _=None: self._frontend_sessions.pop('pdf-viewer', None))  # type: ignore
                    except Exception:
                        pass
            except Exception:
                pass
        except Exception as e:
            self._append(f"[ERROR] 启动 pdf-viewer 异常: {e}，回退 CLI …")
            self._run_cmd([sys.executable, '-X', 'utf8', str(launcher_path), '--prod', '--keep-backend'])

    def closeEvent(self, event):  # type: ignore[override]
        try:
            for t in list(self._threads):
                try:
                    if t.isRunning():
                        t.wait(1500)
                except Exception:
                    pass
        finally:
            self._threads.clear()
        return super().closeEvent(event)


def main() -> int:
    if QApplication is None:
        print('PyQt6 不可用', flush=True)
        return 1
    # 在创建 QApplication 之前，先设置共享 OpenGL 上下文并预导入 QtWebEngine
    try:
        QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts, True)  # type: ignore
    except Exception:
        pass
    try:
        import PyQt6.QtWebEngineWidgets  # type: ignore  # noqa: F401
        import PyQt6.QtWebEngineCore     # type: ignore  # noqa: F401
    except Exception:
        pass
    _init_qtwebengine_runtime()
    app = QApplication(sys.argv)
    # 预创建一次 QWebEngineView，帮助初始化渲染管线
    try:
        from PyQt6.QtWebEngineWidgets import QWebEngineView  # type: ignore
        _tmp = QWebEngineView()
        try:
            _tmp.deleteLater()
        except Exception:
            pass
    except Exception:
        pass
    w = Main()
    w.show()
    return app.exec()


if __name__ == '__main__':
    raise SystemExit(main())
