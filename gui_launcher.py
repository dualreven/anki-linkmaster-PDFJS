#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUI Launcher Enhanced - 增强版图形化项目启动器

提供友好的GUI界面来启动项目的各个组件：
- PDF-Home 模块
- PDF-Viewer 模块（支持各种参数）
- 后端服务器（支持两种启动模式）
- Vite 开发服务器

新功能：
- 支持后端启动模式切换：子进程模式 / Qt线程模式
- 为Anki插件集成做准备
"""

import sys
import os
from pathlib import Path
from typing import Optional, Dict, Any
from enum import Enum
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGroupBox, QPushButton, QLabel, QLineEdit, QTextEdit, QComboBox,
    QCheckBox, QSpinBox, QDoubleSpinBox, QTabWidget, QMessageBox,
    QRadioButton, QButtonGroup, QScrollArea, QSizePolicy
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QFileSystemWatcher
from PyQt6.QtGui import QFont, QTextCursor

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

# 导入 ai_launcher 的功能
try:
    import ai_launcher as _ai
except Exception:
    _ai = None

# 导入启动配置（用于参数传递）
from src.frontend.common.launch_config import LaunchConfig
from pathlib import Path as _Path

# 统一日志目录（默认不强制指定，由运行时自动推断；此常量仅作回退参考）
LOGS_DIR = (_ai.LOGS_DIR if _ai and hasattr(_ai, 'LOGS_DIR') else (PROJECT_ROOT / 'logs'))
try:
    # 不强制创建，让运行时自行推断；仅在需要写入配置时再创建
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# --- 本地工具：在 _ai 不可用时提供最小能力 ---
import json as _json
import subprocess as _subprocess
import platform as _platform

def _read_json_safe(path: Path) -> Dict[str, Any]:
    """读取 JSON 文件（优先使用 ai_launcher.read_json，回退为本地读取）。

    返回空对象以简化调用端逻辑。
    """
    try:
        if _ai is not None and hasattr(_ai, 'read_json'):
            return _ai.read_json(path) or {}
        if path.exists():
            return _json.loads(path.read_text(encoding='utf-8') or '{}')
    except Exception:
        pass
    return {}

def _is_process_running(pid: Optional[int]) -> bool:
    """检查进程是否运行（优先使用 ai_launcher.is_process_running，平台回退）。"""
    try:
        if not pid:
            return False
        if _ai is not None and hasattr(_ai, 'is_process_running'):
            return bool(_ai.is_process_running(pid))
        # 平台回退
        if os.name == 'nt':  # Windows
            try:
                # 使用 tasklist 过滤指定 PID
                result = _subprocess.run([
                    'tasklist', '/FI', f'PID eq {pid}'
                ], capture_output=True, text=True, check=False)
                out = (result.stdout or '')
                # 匹配到该 PID 的行即视为存在
                return str(pid) in out
            except Exception:
                return False
        else:  # POSIX
            try:
                os.kill(int(pid), 0)
                return True
            except Exception:
                return False
    except Exception:
        return False


class BackendMode(Enum):
    """后端启动模式枚举"""
    SUBPROCESS = "subprocess"  # 子进程模式（Legacy）
    QTHREAD = "qthread"        # Qt线程模式（PyQt集成）


class LauncherThread(QThread):
    """后台线程执行启动任务"""
    log_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(bool, str)

    def __init__(self, task_type: str, params: Dict[str, Any], backend_mode: BackendMode = BackendMode.SUBPROCESS):
        super().__init__()
        self.task_type = task_type
        self.params = params
        self.backend_mode = backend_mode
        self.backend_launcher = None  # 保存BackendLauncher实例

    def run(self):
        """执行启动任务"""
        try:
            if self.task_type == "vite":
                self._start_vite()
            elif self.task_type == "backend":
                self._start_backend()
            elif self.task_type == "pdf-home":
                self._start_pdf_home()
            elif self.task_type == "pdf-viewer":
                self._start_pdf_viewer()
            elif self.task_type == "stop":
                self._stop_all()
            else:
                self.finished_signal.emit(False, f"未知任务类型: {self.task_type}")
        except Exception as e:
            self.finished_signal.emit(False, f"执行失败: {e}")

    def _start_vite(self):
        """启动 Vite"""
        self.log_signal.emit("📦 正在启动 Vite 开发服务器...")

        vite_port = self.params.get("vite_port", 3000)
        if _ai is None or not hasattr(_ai, '_start_vite'):
            self.log_signal.emit("⚠️ ai_launcher 不可用：跳过 Vite 启动（dist/Hosted 环境无需 dev server）")
            self.finished_signal.emit(True, "Vite 启动跳过")
            return

        pid = _ai._start_vite(vite_port)
        if pid:
            self.log_signal.emit(f"✅ Vite 启动成功 (PID: {pid}, Port: {vite_port})")
            self.finished_signal.emit(True, "Vite 启动成功")
        else:
            self.log_signal.emit("❌ Vite 启动失败")
            self.finished_signal.emit(False, "Vite 启动失败")

    def _start_backend(self):
        """启动后端服务器"""
        mode_name = "子进程模式" if self.backend_mode == BackendMode.SUBPROCESS else "Qt线程模式"
        self.log_signal.emit(f"🚀 正在启动后端服务器 ({mode_name})...")

        msgCenter_port = self.params.get("msgCenter_port")
        pdfFile_port = self.params.get("pdfFile_port")

        if self.backend_mode == BackendMode.SUBPROCESS:
            # Legacy方式：使用subprocess
            # 从 params 收集运行模式与路径覆盖
            runtime_mode = self.params.get("runtime_mode") or 'single'
            if _ai is not None and hasattr(_ai, '_start_backend'):
                success = _ai._start_backend(
                    msgCenter_port,
                    pdfFile_port,
                    runtime_mode=runtime_mode,
                    ankiaddon_root_path=self.params.get("ankiaddon_root_path"),
                    data_dir=self.params.get("data_dir"),
                    db_path=self.params.get("db_path"),
                    static_dir=self.params.get("static_dir"),
                    pdfs_dir=self.params.get("pdfs_dir"),
                )
            else:
                # Fallback：直接调用 launcher.py start 子进程
                import subprocess
                cmd = [sys.executable, str(PROJECT_ROOT / 'src' / 'backend' / 'launcher.py'), 'start']
                if msgCenter_port:
                    cmd += ['--msgCenter-port', str(msgCenter_port)]
                if pdfFile_port:
                    cmd += ['--pdfFileServer-port', str(pdfFile_port)]
                # 路径参数
                if self.params.get('db_path'):
                    cmd += ['--db-path', str(self.params['db_path'])]
                if self.params.get('data_dir'):
                    cmd += ['--data-dir', str(self.params['data_dir'])]
                if runtime_mode:
                    cmd += ['--runtime-mode', str(runtime_mode)]
                    if runtime_mode == 'anki' and self.params.get('ankiaddon_root_path'):
                        cmd += ['--ankiaddon-root-path', str(self.params['ankiaddon_root_path'])]
                if self.params.get('static_dir'):
                    cmd += ['--static-dir', str(self.params['static_dir'])]
                if self.params.get('pdfs_dir'):
                    cmd += ['--pdfs-dir', str(self.params['pdfs_dir'])]
                try:
                    subprocess.Popen(cmd, cwd=str(PROJECT_ROOT), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    success = True
                except Exception as e:
                    self.log_signal.emit(f"❌ 后端启动失败（fallback CLI）: {e}")
                    success = False
            if success:
                self.log_signal.emit(f"✅ 后端启动成功 [{mode_name}] (WebSocket: {msgCenter_port or 8765}, HTTP: {pdfFile_port or 8080})")
                self.finished_signal.emit(True, f"后端启动成功 [{mode_name}]")
            else:
                self.log_signal.emit(f"❌ 后端启动失败 [{mode_name}]")
                self.finished_signal.emit(False, f"后端启动失败 [{mode_name}]")

        else:  # QTHREAD
            # PyQt集成方式：使用BackendLauncher
            try:
                from src.backend.launcher import BackendLauncher
                from PyQt6.QtWidgets import QApplication

                self.log_signal.emit(f"📌 使用 BackendLauncher (Qt线程模式)...")

                # 获取当前的QApplication实例（避免创建新的）
                current_app = QApplication.instance()

                # 创建BackendLauncher实例，传入当前QApplication
                runtime_mode = self.params.get("runtime_mode") or 'single'
                self.backend_launcher = BackendLauncher(
                    parent_app=current_app,  # 使用GUI的QApplication
                    show_ui=False,           # 不显示测试UI
                    runtime_mode=runtime_mode,
                    ankiaddon_root_path=self.params.get("ankiaddon_root_path"),
                    data_dir=self.params.get("data_dir"),
                    db_path=self.params.get("db_path"),
                    static_dir=self.params.get("static_dir"),
                    pdfs_dir=self.params.get("pdfs_dir"),
                )

                # 启动服务器
                success = self.backend_launcher.start(
                    msgCenter_port=msgCenter_port,
                    pdfFile_port=pdfFile_port
                )

                if success:
                    # 获取实际使用的端口
                    ws_port = self.backend_launcher.ws_server.port if self.backend_launcher.ws_server else msgCenter_port
                    http_port = self.backend_launcher.http_server.port if self.backend_launcher.http_server else pdfFile_port

                    self.log_signal.emit(f"✅ 后端启动成功 [{mode_name}]")
                    self.log_signal.emit(f"   WebSocket: ws://127.0.0.1:{ws_port}")
                    self.log_signal.emit(f"   HTTP: http://127.0.0.1:{http_port}")
                    self.log_signal.emit(f"   特性: 无子进程、Qt事件循环、信号槽通信")

                    # 保存BackendLauncher实例到params，以便后续停止
                    self.params['_backend_launcher_instance'] = self.backend_launcher

                    self.finished_signal.emit(True, f"后端启动成功 [{mode_name}]")
                else:
                    self.log_signal.emit(f"❌ 后端启动失败 [{mode_name}]")
                    self.finished_signal.emit(False, f"后端启动失败 [{mode_name}]")

            except ImportError as e:
                self.log_signal.emit(f"❌ 无法导入 BackendLauncher: {e}")
                self.log_signal.emit("💡 提示: 确保 src/backend/launcher.py 存在")
                self.finished_signal.emit(False, f"后端启动失败: 无法导入 BackendLauncher")
            except Exception as e:
                self.log_signal.emit(f"❌ BackendLauncher 启动异常: {e}")
                self.finished_signal.emit(False, f"后端启动失败: {e}")

    def _start_pdf_home(self):
        """启动 PDF-Home（使用launcher脚本）"""
        self.log_signal.emit("🏠 正在启动 PDF-Home...")

        try:
            import subprocess
            import json

            # 读取后端实际使用的端口配置（基于可配置 logs_dir）
            base_logs = Path(self.params.get('logs_dir') or (PROJECT_ROOT / 'logs'))
            runtime_ports_file = base_logs / "runtime-ports.json"
            actual_ports = {}
            if runtime_ports_file.exists():
                try:
                    with open(runtime_ports_file, 'r', encoding='utf-8') as f:
                        actual_ports = json.load(f)
                    self.log_signal.emit(f"📌 读取到后端实际端口配置: {actual_ports}")
                except Exception as e:
                    self.log_signal.emit(f"⚠️ 读取端口配置失败: {e}，将使用GUI配置")

            # 构建命令行参数
            cmd = [sys.executable, "src/frontend/pdf-home/launcher.py"]

            # 优先使用后端实际端口，否则使用GUI配置
            vite_port = actual_ports.get("vite_port") or self.params.get("vite_port")
            msgCenter_port = actual_ports.get("msgCenter_port") or self.params.get("msgCenter_port")
            pdfFile_port = actual_ports.get("pdfFile_port") or self.params.get("pdfFile_port")

            if vite_port:
                cmd.extend(["--vite-port", str(vite_port)])
            if msgCenter_port:
                cmd.extend(["--msgCenter-port", str(msgCenter_port)])
            if pdfFile_port:
                cmd.extend(["--pdfFile-port", str(pdfFile_port)])

            # 默认保持后端不被前端窗口关闭时停止
            try:
                cmd.append("--keep-backend")
            except Exception:
                pass

            # 使用subprocess.Popen在后台启动
            process = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )

            # 记录进程信息（写入可配置 logs_dir）
            import json
            from pathlib import Path
            frontend_info_path = base_logs / "frontend-process-info.json"
            frontend_info_path.parent.mkdir(exist_ok=True)

            if frontend_info_path.exists():
                with open(frontend_info_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {"frontend": {}}

            data.setdefault("frontend", {})["pdf-home"] = {
                "pid": process.pid,
                "command": " ".join(cmd),
                "started_at": str(Path(__file__).stat().st_mtime)
            }

            with open(frontend_info_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            self.log_signal.emit(f"✅ PDF-Home 启动成功 (PID: {process.pid})")
            if vite_port:
                self.log_signal.emit(f"   Vite端口: {vite_port}")
            if msgCenter_port:
                port_source = "（实际端口）" if actual_ports.get("msgCenter_port") else "（GUI配置）"
                self.log_signal.emit(f"   WebSocket端口: {msgCenter_port} {port_source}")
            if pdfFile_port:
                self.log_signal.emit(f"   HTTP文件服务器端口: {pdfFile_port}")
            self.finished_signal.emit(True, "PDF-Home 启动成功")

        except Exception as e:
            self.log_signal.emit(f"❌ PDF-Home 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"PDF-Home 启动失败: {e}")

    def _start_pdf_viewer(self):
        """启动 PDF-Viewer（使用launcher脚本）"""
        self.log_signal.emit("📄 正在启动 PDF-Viewer...")

        pdf_id = self.params.get("pdf_id")
        page_at = self.params.get("page_at")
        position = self.params.get("position")

        if not pdf_id:
            self.log_signal.emit("💡 提示: 未指定 PDF ID，将启动空白查看器")

        try:
            import subprocess
            import json

            # 读取后端实际使用的端口配置（基于可配置 logs_dir）
            base_logs = Path(self.params.get('logs_dir') or (PROJECT_ROOT / 'logs'))
            runtime_ports_file = base_logs / "runtime-ports.json"
            actual_ports = {}
            if runtime_ports_file.exists():
                try:
                    with open(runtime_ports_file, 'r', encoding='utf-8') as f:
                        actual_ports = json.load(f)
                    self.log_signal.emit(f"📌 读取到后端实际端口配置: {actual_ports}")
                except Exception as e:
                    self.log_signal.emit(f"⚠️ 读取端口配置失败: {e}，将使用GUI配置")

            # 构建命令行参数
            cmd = [sys.executable, "src/frontend/pdf-viewer/launcher.py"]

            # 优先使用后端实际端口，否则使用GUI配置
            vite_port = actual_ports.get("vite_port") or self.params.get("vite_port")
            msgCenter_port = actual_ports.get("msgCenter_port") or self.params.get("msgCenter_port")
            pdfFile_port = actual_ports.get("pdfFile_port") or self.params.get("pdfFile_port")

            if vite_port:
                cmd.extend(["--vite-port", str(vite_port)])
            if msgCenter_port:
                cmd.extend(["--msgCenter-port", str(msgCenter_port)])
            if pdfFile_port:
                cmd.extend(["--pdfFile-port", str(pdfFile_port)])
            if pdf_id:
                cmd.extend(["--pdf-id", pdf_id])
            if page_at:
                cmd.extend(["--page-at", str(page_at)])
            if position:
                cmd.extend(["--position", str(position)])

            # 默认保持后端不被前端窗口关闭时停止
            try:
                cmd.append("--keep-backend")
            except Exception:
                pass

            # 使用subprocess.Popen在后台启动
            process = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )

            # 记录进程信息（写入可配置 logs_dir）
            import json
            from pathlib import Path
            frontend_info_path = base_logs / "frontend-process-info.json"
            frontend_info_path.parent.mkdir(exist_ok=True)

            if frontend_info_path.exists():
                with open(frontend_info_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {"frontend": {}}

            viewer_key = f"pdf-viewer-{pdf_id}" if pdf_id else "pdf-viewer"
            data.setdefault("frontend", {})[viewer_key] = {
                "pid": process.pid,
                "command": " ".join(cmd),
                "started_at": str(Path(__file__).stat().st_mtime)
            }

            with open(frontend_info_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            self.log_signal.emit(f"✅ PDF-Viewer 启动成功 (PID: {process.pid})")
            if pdf_id:
                self.log_signal.emit(f"   PDF ID: {pdf_id}")
            if page_at:
                self.log_signal.emit(f"   目标页码: {page_at}")
            if position:
                self.log_signal.emit(f"   页面位置: {position}%")
            if vite_port:
                self.log_signal.emit(f"   Vite端口: {vite_port}")
            if msgCenter_port:
                port_source = "（实际端口）" if actual_ports.get("msgCenter_port") else "（GUI配置）"
                self.log_signal.emit(f"   WebSocket端口: {msgCenter_port} {port_source}")
            if pdfFile_port:
                self.log_signal.emit(f"   HTTP文件服务器端口: {pdfFile_port}")
            self.finished_signal.emit(True, "PDF-Viewer 启动成功")

        except Exception as e:
            self.log_signal.emit(f"❌ PDF-Viewer 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"PDF-Viewer 启动失败: {e}")

    def _stop_all(self):
        """停止所有服务"""
        self.log_signal.emit("⏹️ 正在停止所有服务...")

        # 停止 Vite
        if _ai is None or not hasattr(_ai, '_stop_vite') or _ai._stop_vite():
            self.log_signal.emit("✅ Vite 已停止")
        else:
            self.log_signal.emit("⚠️ Vite 停止失败或未运行")

        # 停止前端
        if _ai is None or not hasattr(_ai, '_stop_frontend') or _ai._stop_frontend():
            self.log_signal.emit("✅ 前端模块已停止")
        else:
            self.log_signal.emit("⚠️ 前端模块停止失败或未运行")

        # 停止后端
        # 需要检查是否有BackendLauncher实例
        backend_launcher_instance = self.params.get('_backend_launcher_instance')
        if backend_launcher_instance:
            self.log_signal.emit("⏹️ 停止 BackendLauncher 实例...")
            try:
                backend_launcher_instance.stop()
                self.log_signal.emit("✅ BackendLauncher 已停止")
            except Exception as e:
                self.log_signal.emit(f"⚠️ BackendLauncher 停止异常: {e}")

        # 也尝试停止Legacy方式的后端
        if _ai is None or not hasattr(_ai, '_stop_backend') or _ai._stop_backend():
            self.log_signal.emit("✅ 后端已停止")
        else:
            self.log_signal.emit("⚠️ 后端停止失败或未运行")

        self.finished_signal.emit(True, "所有服务已停止")

    def _get_ports(self) -> Dict[str, int]:
        """获取端口配置"""
        return {
            "vite_port": self.params.get("vite_port", 3000),
            "msgCenter_port": self.params.get("msgCenter_port", 8765),
            "pdfFile_port": self.params.get("pdfFile_port", 8080)
        }


class GUILauncher(QMainWindow):
    """主窗口（重构版）：提供 Hosted 与 CLI 两种启动体验"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Anki LinkMaster PDFJS - 启动器（重构版）")
        # 增加默认与最小高度，避免控件被压缩
        self.setGeometry(100, 100, 1024, 860)
        self.setMinimumSize(960, 760)

        # 当前运行的线程
        self.current_thread: Optional[LauncherThread] = None

        # 后端启动模式（默认使用 Qt 线程模式）
        self.backend_mode = BackendMode.QTHREAD

        # 保存BackendLauncher实例（Qt线程模式）
        self.backend_launcher_instance = None

        # 运行时日志目录（可变，来源于配置），以及配置文件路径
        # 初始不强制 logs_dir，保持为空以让运行时自动推断；若配置中提供则应用
        self._logs_dir: Path = None  # type: ignore
        self._config_path: Path = (LOGS_DIR / "gui-launcher-config.json")
        self._config: Dict[str, Any] = {}

        # 载入配置（若存在），可切换日志目录
        self._load_config()

        # 初始化UI
        self._init_ui()

        # 事件驱动：文件系统监听替代高频轮询
        self._init_status_watchers()

        # 初始状态检查
        self._update_status()

    def _init_ui(self):
        """初始化UI"""
        # 使用滚动容器包裹主内容，保证小屏幕也能完整查看
        central_widget = QWidget()
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(central_widget)
        self.setCentralWidget(scroll)

        main_layout = QVBoxLayout()
        central_widget.setLayout(main_layout)

        # 标题
        title_label = QLabel("🚀 Anki LinkMaster PDFJS 增强启动器")
        title_font = QFont()
        title_font.setPointSize(16)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        main_layout.addWidget(title_label)

        # 主区域：左右布局，右侧用于日志
        content_row = QHBoxLayout()
        main_layout.addLayout(content_row)

        # 左侧：Tabs + 状态 + 底部按钮
        left_col = QVBoxLayout()
        tabs = QTabWidget(); self._tabs = tabs
        tabs.addTab(self._create_hosted_tab(), "Hosted（Anki模拟）")
        tabs.addTab(self._create_cli_tab(), "CLI（命令行模拟）")
        left_col.addWidget(tabs)
        status_group = self._create_status_group()
        left_col.addWidget(status_group)
        button_layout = self._create_bottom_buttons()
        left_col.addLayout(button_layout)
        left_col.addStretch()

        # 右侧：日志
        right_col = QVBoxLayout()
        log_group = self._create_log_group()
        right_col.addWidget(log_group)

        # 放入横向布局，设置伸展比例（左：右 = 3:2）
        content_row.addLayout(left_col, 3)
        content_row.addLayout(right_col, 2)

    def _create_hosted_tab(self) -> QWidget:
        """Hosted（Anki 模拟）选项卡"""
        widget = QWidget()
        layout = QVBoxLayout(widget)

        info = QLabel("在当前 GUI 中以 Hosted 模式（无子进程）运行后端与前端，模拟 Anki 环境。")
        info.setStyleSheet("padding: 8px; background: #f5f5f5; border-radius: 6px; color: #333;")
        layout.addWidget(info)

        # PDF 参数
        grp = QGroupBox("PDF 参数（可选）")
        gl = QHBoxLayout(grp)
        self.h_pdf_id = QLineEdit()
        self.h_page_at = QSpinBox(); self.h_page_at.setRange(0, 999999); self.h_page_at.setSpecialValueText("不指定")
        self.h_position = QDoubleSpinBox(); self.h_position.setRange(0.0, 100.0); self.h_position.setDecimals(1); self.h_position.setSingleStep(5.0)
        self.h_keep_backend = QCheckBox("关闭窗口保留后端")
        gl.addWidget(QLabel("pdf_id")); gl.addWidget(self.h_pdf_id)
        gl.addWidget(QLabel("page_at")); gl.addWidget(self.h_page_at)
        gl.addWidget(QLabel("position%")); gl.addWidget(self.h_position)
        gl.addWidget(self.h_keep_backend)
        layout.addWidget(grp)

        # 操作
        row = QHBoxLayout()
        btn_b_start = QPushButton('启动后端(Hosted)'); btn_b_start.clicked.connect(self._start_backend_hosted)
        btn_home = QPushButton('启动 PDF-Home (Hosted)'); btn_home.clicked.connect(self._start_pdf_home_hosted)
        btn_viewer = QPushButton('启动 PDF-Viewer (Hosted)'); btn_viewer.clicked.connect(self._start_pdf_viewer_hosted)
        btn_stop = QPushButton('停止所有'); btn_stop.clicked.connect(self._on_stop_all)
        row.addWidget(btn_b_start); row.addWidget(btn_home); row.addWidget(btn_viewer); row.addWidget(btn_stop)
        layout.addLayout(row)

        # 高级设置（端口/路径）
        layout.addWidget(self._create_advanced_settings_panel())

        layout.addStretch()
        return widget

    def _create_cli_tab(self) -> QWidget:
        """CLI（命令行模拟 ai_launcher）选项卡"""
        widget = QWidget()
        layout = QVBoxLayout(widget)

        desc = QLabel("映射 ai_launcher 的 start/stop/status，便于在 GUI 中模拟命令行操作。")
        desc.setStyleSheet("padding: 8px; background:#f5f5f5; border-radius:6px; color:#333;")
        layout.addWidget(desc)

        row1 = QHBoxLayout()
        self.cli_module = QComboBox(); self.cli_module.addItems(["none", "pdf-home", "pdf-viewer"]) 
        self.cli_pdf_id = QLineEdit(); self.cli_pdf_id.setPlaceholderText("pdf_id，可空")
        self.cli_page_at = QSpinBox(); self.cli_page_at.setRange(0, 999999); self.cli_page_at.setSpecialValueText("不指定")
        self.cli_position = QDoubleSpinBox(); self.cli_position.setRange(0.0,100.0); self.cli_position.setDecimals(1); self.cli_position.setSingleStep(5.0)
        row1.addWidget(QLabel("module")); row1.addWidget(self.cli_module)
        row1.addWidget(QLabel("pdf_id")); row1.addWidget(self.cli_pdf_id)
        row1.addWidget(QLabel("page_at")); row1.addWidget(self.cli_page_at)
        row1.addWidget(QLabel("position%")); row1.addWidget(self.cli_position)
        layout.addLayout(row1)

        row2 = QHBoxLayout()
        sbtn = QPushButton("Start"); sbtn.clicked.connect(self._cli_start)
        pbtn = QPushButton("Stop"); pbtn.clicked.connect(self._cli_stop)
        stbtn = QPushButton("Status"); stbtn.clicked.connect(self._cli_status)
        row2.addWidget(sbtn); row2.addWidget(pbtn); row2.addWidget(stbtn)
        layout.addLayout(row2)

        layout.addWidget(self._create_advanced_settings_panel())

        layout.addStretch()
        return widget

    def _create_advanced_settings_panel(self) -> QWidget:
        """统一的高级设置（端口/路径/后端模式），供多个 Tab 复用"""
        widget = QGroupBox("高级设置（端口/路径/模式）")
        layout = QVBoxLayout()
        widget.setLayout(layout)

        info_label = QLabel(
            "自定义端口配置。留空则使用默认值或自动分配。"
        )
        info_label.setStyleSheet("padding: 10px; background-color: #f0f0f0; border-radius: 5px;")
        layout.addWidget(info_label)

        # ========== 新增：后端启动模式选择 ==========
        backend_mode_group = QGroupBox("后端启动模式")
        backend_mode_layout = QVBoxLayout()
        backend_mode_group.setLayout(backend_mode_layout)

        # 说明文字
        mode_desc = QLabel(
            "选择后端服务器的启动方式：\n"
            "• 子进程模式：使用独立子进程（兼容性好，资源占用较高）\n"
            "• Qt线程模式：使用PyQt组件（推荐，无子进程，适合Anki集成）"
        )
        mode_desc.setStyleSheet("font-size: 11px; color: #666; padding: 5px;")
        backend_mode_layout.addWidget(mode_desc)

        # RadioButton组
        radio_layout = QHBoxLayout()
        self.backend_mode_group = QButtonGroup(self)

        self.subprocess_radio = QRadioButton("子进程模式（Legacy）")
        self.subprocess_radio.toggled.connect(self._on_backend_mode_changed)
        self.backend_mode_group.addButton(self.subprocess_radio, 0)
        radio_layout.addWidget(self.subprocess_radio)

        self.qthread_radio = QRadioButton("Qt线程模式（PyQt集成）")
        self.qthread_radio.setChecked(True)  # 默认选中 Qt 线程模式
        self.qthread_radio.toggled.connect(self._on_backend_mode_changed)
        self.backend_mode_group.addButton(self.qthread_radio, 1)
        radio_layout.addWidget(self.qthread_radio)

        radio_layout.addStretch()
        backend_mode_layout.addLayout(radio_layout)

        # 模式说明标签（默认显示 Qt 线程模式）
        self.mode_info_label = QLabel("✅ 当前: Qt线程模式（使用BackendLauncher，无子进程）")
        self.mode_info_label.setStyleSheet("color: blue; font-weight: bold; padding: 5px;")
        backend_mode_layout.addWidget(self.mode_info_label)

        layout.addWidget(backend_mode_group)

        # Vite 端口
        vite_layout = QHBoxLayout()
        vite_label = QLabel("Vite 端口:")
        self.vite_port_input = QSpinBox()
        self.vite_port_input.setMinimum(0)
        self.vite_port_input.setMaximum(65535)
        self.vite_port_input.setValue(3000)
        self.vite_port_input.setSpecialValueText("自动")
        vite_layout.addWidget(vite_label)
        vite_layout.addWidget(self.vite_port_input)
        vite_layout.addStretch()
        layout.addLayout(vite_layout)

        # WebSocket 端口
        ws_layout = QHBoxLayout()
        ws_label = QLabel("WebSocket 端口:")
        self.msgCenter_port_input = QSpinBox()
        self.msgCenter_port_input.setMinimum(0)
        self.msgCenter_port_input.setMaximum(65535)
        self.msgCenter_port_input.setValue(8765)
        self.msgCenter_port_input.setSpecialValueText("自动")
        ws_layout.addWidget(ws_label)
        ws_layout.addWidget(self.msgCenter_port_input)
        ws_layout.addStretch()
        layout.addLayout(ws_layout)

        # HTTP 端口
        http_layout = QHBoxLayout()
        http_label = QLabel("HTTP 文件服务器端口:")
        self.pdfFile_port_input = QSpinBox()
        self.pdfFile_port_input.setMinimum(0)
        self.pdfFile_port_input.setMaximum(65535)
        self.pdfFile_port_input.setValue(8080)
        self.pdfFile_port_input.setSpecialValueText("自动")
        http_layout.addWidget(http_label)
        http_layout.addWidget(self.pdfFile_port_input)
        http_layout.addStretch()
        layout.addLayout(http_layout)

        # ========= 运行环境与路径覆盖 =========
        env_group = QGroupBox("运行环境与路径（参数优先，无环境变量）")
        env_layout = QVBoxLayout()
        env_group.setLayout(env_layout)

        # 运行模式
        rm_layout = QHBoxLayout()
        rm_label = QLabel("运行模式(runtime_mode):")
        self.runtime_mode_select = QComboBox()
        self.runtime_mode_select.addItems(["single", "anki"])  # 默认 single
        self.runtime_mode_select.setCurrentText("single")
        rm_layout.addWidget(rm_label)
        rm_layout.addWidget(self.runtime_mode_select)
        rm_layout.addStretch()
        env_layout.addLayout(rm_layout)

        # Anki 插件根目录（当模式=anki 时需要）
        anki_layout = QHBoxLayout()
        anki_label = QLabel("Anki 插件根(ankiaddon_root_path):")
        self.ankiaddon_root_input = QLineEdit()
        self.ankiaddon_root_input.setPlaceholderText("例如: C:/Users/you/AppData/Roaming/Anki2/addons21/hjp_linkmaster_dev")
        anki_layout.addWidget(anki_label)
        anki_layout.addWidget(self.ankiaddon_root_input)
        env_layout.addLayout(anki_layout)

        # 数据目录
        data_layout = QHBoxLayout()
        data_label = QLabel("数据目录(data_dir):")
        self.data_dir_input = QLineEdit()
        self.data_dir_input.setPlaceholderText("留空则: <component_root>/data")
        data_layout.addWidget(data_label)
        data_layout.addWidget(self.data_dir_input)
        env_layout.addLayout(data_layout)

        # 数据库文件
        db_layout = QHBoxLayout()
        db_label = QLabel("数据库文件(db_path):")
        self.db_path_input = QLineEdit()
        self.db_path_input.setPlaceholderText("留空则: <data_dir>/anki_linkmaster.db")
        db_layout.addWidget(db_label)
        db_layout.addWidget(self.db_path_input)
        env_layout.addLayout(db_layout)

        # 静态目录
        static_layout = QHBoxLayout()
        static_label = QLabel("静态目录(static_dir):")
        self.static_dir_input = QLineEdit()
        self.static_dir_input.setPlaceholderText("留空: anki=<component_root>/static; single=工程回退")
        static_layout.addWidget(static_label)
        static_layout.addWidget(self.static_dir_input)
        env_layout.addLayout(static_layout)

        # PDFs 目录
        pdfs_layout = QHBoxLayout()
        pdfs_label = QLabel("PDF库目录(pdfs_dir):")
        self.pdfs_dir_input = QLineEdit()
        self.pdfs_dir_input.setPlaceholderText("留空则: <data_dir>/pdfs")
        pdfs_layout.addWidget(pdfs_label)
        pdfs_layout.addWidget(self.pdfs_dir_input)
        env_layout.addLayout(pdfs_layout)

        # 日志目录（新增）
        logs_layout = QHBoxLayout()
        logs_label = QLabel("日志目录(logs_dir):")
        self.logs_dir_input = QLineEdit()
        # 默认为空，让运行时自动推断；占位提示说明为空表示自动
        self.logs_dir_input.setPlaceholderText("(留空=<component_root>/logs)")
        logs_layout.addWidget(logs_label)
        logs_layout.addWidget(self.logs_dir_input)
        env_layout.addLayout(logs_layout)

        layout.addWidget(env_group)

        # 操作行：保存/应用日志目录/打开日志目录
        ops = QHBoxLayout()
        btn_save = QPushButton("保存设置")
        btn_apply_logs = QPushButton("应用日志目录")
        btn_open_logs = QPushButton("打开日志目录")
        btn_save.clicked.connect(self._save_config_from_ui)
        btn_apply_logs.clicked.connect(self._apply_logs_dir_change)
        btn_open_logs.clicked.connect(self._open_logs_dir)
        ops.addWidget(btn_save)
        ops.addWidget(btn_apply_logs)
        ops.addWidget(btn_open_logs)
        ops.addStretch()
        layout.addLayout(ops)

        # 将已保存配置应用到控件
        try:
            self._apply_config_to_ui()
        except Exception:
            pass

        return widget

    def _collect_path_overrides(self) -> Dict[str, Any]:
        """收集运行模式与路径覆盖参数（空值表示不覆盖）。"""
        try:
            runtime_mode = self.runtime_mode_select.currentText().strip()
        except Exception:
            runtime_mode = "single"
        try:
            ankiaddon_root_path = self.ankiaddon_root_input.text().strip()
        except Exception:
            ankiaddon_root_path = ""
        try:
            data_dir = self.data_dir_input.text().strip()
        except Exception:
            data_dir = ""
        try:
            db_path = self.db_path_input.text().strip()
        except Exception:
            db_path = ""
        try:
            static_dir = self.static_dir_input.text().strip()
        except Exception:
            static_dir = ""
        try:
            pdfs_dir = self.pdfs_dir_input.text().strip()
        except Exception:
            pdfs_dir = ""

        params: Dict[str, Any] = {
            "runtime_mode": runtime_mode or None,
            "ankiaddon_root_path": ankiaddon_root_path or None,
            "data_dir": data_dir or None,
            "db_path": db_path or None,
            "static_dir": static_dir or None,
            "pdfs_dir": pdfs_dir or None,
        }
        if params["runtime_mode"] == "anki" and not params["ankiaddon_root_path"]:
            self._log("⚠️ anki 模式未提供 ankiaddon_root_path，后端可能拒绝启动")
        return params

    def _create_status_group(self) -> QGroupBox:
        """创建状态显示组"""
        group = QGroupBox("服务状态")
        layout = QHBoxLayout()
        group.setLayout(layout)

        # Vite 状态
        self.vite_status_label = QLabel("📦 Vite: ⚪ 未运行")
        layout.addWidget(self.vite_status_label)

        # 后端状态
        self.backend_status_label = QLabel("🚀 后端: ⚪ 未运行")
        layout.addWidget(self.backend_status_label)

        # 前端状态
        self.frontend_status_label = QLabel("📄 前端: ⚪ 未运行")
        layout.addWidget(self.frontend_status_label)

        return group

    def _create_log_group(self) -> QGroupBox:
        """创建日志显示组"""
        group = QGroupBox("运行日志")
        layout = QVBoxLayout()
        group.setLayout(layout)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        # 使日志区域在所在列内尽可能填满
        group.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.log_text.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        layout.addWidget(self.log_text, 1)

        return group

    # ================= 事件驱动：状态文件监听 =================
    def _init_status_watchers(self):
        """初始化文件系统监听，基于现有状态文件实现事件驱动刷新。"""
        try:
            self.fs_watcher = QFileSystemWatcher(self)
            # 监听日志目录（新增/删除文件时触发）
            try:
                base = (self._logs_dir or (PROJECT_ROOT / 'logs'))
                self.fs_watcher.addPath(str(base))
            except Exception:
                pass

            # 监听已存在的状态文件
            self._attach_known_status_files()

            # 变更信号绑定（文件与目录）
            self.fs_watcher.fileChanged.connect(self._on_status_file_changed)
            self.fs_watcher.directoryChanged.connect(self._on_status_dir_changed)

            # 去抖动计时器，避免频繁重入
            self._status_debounce_timer = QTimer(self)
            self._status_debounce_timer.setSingleShot(True)
            self._status_debounce_timer.timeout.connect(self._update_status)
        except Exception:
            # 监听失败不影响基础功能，用户可手动刷新
            self.fs_watcher = None
            self._status_debounce_timer = None

    def _attach_known_status_files(self):
        """将已存在的状态文件加入监听。"""
        if not getattr(self, 'fs_watcher', None):
            return
        try:
            files_now = set(self.fs_watcher.files())
        except Exception:
            files_now = set()

        for name in ("dev-process-info.json", "backend-process-info.json", "frontend-process-info.json"):
            try:
                base = (self._logs_dir or LOGS_DIR)
                path = base / name
                if path.exists():
                    spath = str(path)
                    if spath not in files_now:
                        self.fs_watcher.addPath(spath)
            except Exception:
                pass

    def _on_status_dir_changed(self, path: str):
        # 目录变更后尝试附加新出现的状态文件
        self._attach_known_status_files()
        self._schedule_status_update(150)

    def _on_status_file_changed(self, path: str):
        # 某个状态文件发生变更，轻微去抖后刷新
        self._schedule_status_update(100)

    def _schedule_status_update(self, delay_ms: int = 120):
        if not getattr(self, '_status_debounce_timer', None):
            # 无去抖计时器则直接刷新
            self._update_status()
            return
        try:
            # 重启单次计时器
            if self._status_debounce_timer.isActive():
                self._status_debounce_timer.stop()
            self._status_debounce_timer.start(max(0, int(delay_ms)))
        except Exception:
            self._update_status()

    def _create_bottom_buttons(self) -> QHBoxLayout:
        """创建底部按钮"""
        layout = QHBoxLayout()

        # 刷新状态按钮
        refresh_btn = QPushButton("🔄 刷新状态")
        refresh_btn.clicked.connect(self._update_status)
        layout.addWidget(refresh_btn)

        # 停止所有按钮
        stop_btn = QPushButton("⏹️ 停止所有服务")
        stop_btn.clicked.connect(self._on_stop_all)
        stop_btn.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                font-weight: bold;
                padding: 8px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #da190b;
            }
        """)
        layout.addWidget(stop_btn)

        # 打开日志目录
        open_btn = QPushButton("📂 打开日志目录")
        open_btn.clicked.connect(self._open_logs_dir)
        layout.addWidget(open_btn)

        return layout

    def _on_backend_mode_changed(self):
        """后端模式切换事件"""
        if self.subprocess_radio.isChecked():
            self.backend_mode = BackendMode.SUBPROCESS
            self.mode_info_label.setText("✅ 当前: 子进程模式（使用subprocess创建独立进程）")
            self.mode_info_label.setStyleSheet("color: green; font-weight: bold; padding: 5px;")
        else:
            self.backend_mode = BackendMode.QTHREAD
            self.mode_info_label.setText("✅ 当前: Qt线程模式（使用BackendLauncher，无子进程）")
            self.mode_info_label.setStyleSheet("color: blue; font-weight: bold; padding: 5px;")

        self._log(f"后端启动模式已切换: {self.backend_mode.value}")

    def _switch_to_tab(self, index: int):
        """切换到指定选项卡"""
        tabs = self.findChild(QTabWidget)
        if tabs:
            tabs.setCurrentIndex(index)

    def _log(self, message: str):
        """添加日志"""
        self.log_text.append(message)
        # 自动滚动到底部
        self.log_text.moveCursor(QTextCursor.MoveOperation.End)

    def _update_status(self):
        """更新服务状态"""
        # 读取状态文件（兼容无 ai_launcher 环境）
        base = (self._logs_dir or (PROJECT_ROOT / 'logs'))
        dev_info = _read_json_safe(base / "dev-process-info.json")
        backend_info = _read_json_safe(base / "backend-process-info.json")
        frontend_info = _read_json_safe(base / "frontend-process-info.json")

        # 更新 Vite 状态
        vite_pid = dev_info.get("vite", {}).get("pid")
        if vite_pid and _is_process_running(vite_pid):
            vite_port = dev_info.get("vite", {}).get("port", 3000)
            self.vite_status_label.setText(f"📦 Vite: 🟢 运行中 (:{vite_port})")
            self.vite_status_label.setStyleSheet("color: green;")
        else:
            self.vite_status_label.setText("📦 Vite: ⚪ 未运行")
            self.vite_status_label.setStyleSheet("color: gray;")

        # 更新后端状态
        # 检查两种模式
        backend_running = False
        backend_info_text = ""

        # 检查Legacy模式
        backend_pid = backend_info.get("backend", {}).get("pid")
        if backend_pid and _is_process_running(backend_pid):
            ws_port = backend_info.get("backend", {}).get("ports", {}).get("msgCenter_port", 8765)
            http_port = backend_info.get("backend", {}).get("ports", {}).get("pdfFile_port", 8080)
            backend_info_text = f"🚀 后端: 🟢 运行中 [子进程] (WS:{ws_port}, HTTP:{http_port})"
            backend_running = True

        # 检查Qt线程模式
        if not backend_running and self.backend_launcher_instance:
            try:
                if self.backend_launcher_instance.is_ws_running() or self.backend_launcher_instance.is_http_running():
                    ws_port = self.backend_launcher_instance.ws_server.port if self.backend_launcher_instance.ws_server else 8765
                    http_port = self.backend_launcher_instance.http_server.port if self.backend_launcher_instance.http_server else 8080
                    backend_info_text = f"🚀 后端: 🟢 运行中 [Qt线程] (WS:{ws_port}, HTTP:{http_port})"
                    backend_running = True
            except:
                pass

        if backend_running:
            self.backend_status_label.setText(backend_info_text)
            self.backend_status_label.setStyleSheet("color: green;")
        else:
            self.backend_status_label.setText("🚀 后端: ⚪ 未运行")
            self.backend_status_label.setStyleSheet("color: gray;")

        # 更新前端状态
        frontend_processes = frontend_info.get("frontend", {})
        if frontend_processes:
            running_count = sum(
                1 for p in frontend_processes.values()
                if p.get("pid") and _is_process_running(p.get("pid"))
            )
            if running_count > 0:
                self.frontend_status_label.setText(f"📄 前端: 🟢 {running_count} 个模块运行中")
                self.frontend_status_label.setStyleSheet("color: green;")
            else:
                self.frontend_status_label.setText("📄 前端: ⚪ 未运行")
                self.frontend_status_label.setStyleSheet("color: gray;")
        else:
            self.frontend_status_label.setText("📄 前端: ⚪ 未运行")
            self.frontend_status_label.setStyleSheet("color: gray;")

    def _start_task(self, task_type: str, params: Dict[str, Any]):
        """启动后台任务"""
        if self.current_thread and self.current_thread.isRunning():
            QMessageBox.warning(self, "警告", "已有任务正在运行，请等待完成")
            return

        self._log(f"开始任务: {task_type}")

        # 传递后端启动模式
        # 注入 logs_dir 供子线程读写统一日志文件
        params = dict(params)
        params['logs_dir'] = str(self._logs_dir or (PROJECT_ROOT / 'logs'))
        self.current_thread = LauncherThread(task_type, params, self.backend_mode)
        self.current_thread.log_signal.connect(self._log)
        self.current_thread.finished_signal.connect(self._on_task_finished)
        self.current_thread.start()

    def _on_task_finished(self, success: bool, message: str):
        """任务完成"""
        if success:
            self._log(f"✅ {message}")

            # 如果是后端Qt线程模式启动成功，保存实例引用
            if self.backend_mode == BackendMode.QTHREAD and self.current_thread:
                launcher_instance = self.current_thread.params.get('_backend_launcher_instance')
                if launcher_instance:
                    self.backend_launcher_instance = launcher_instance
                    self._log("📌 BackendLauncher 实例已保存")
        else:
            self._log(f"❌ {message}")
            QMessageBox.critical(self, "错误", message)

        # 清理当前线程引用（重要：允许新任务启动）
        self.current_thread = None

        # 更新状态
        self._update_status()

    def _create_dist_tools_tab(self) -> QWidget:
        """创建 Dist 工具（Hosted 调试）选项卡。

        - 后端（Hosted）：使用 BackendLauncher(parent_app=QApplication.instance())
        - PDF-Home/Viewer（Hosted）：直接 import 启动类，传入 LaunchConfig
        - 使用 dist/latest 作为 data_dir 静态基准（可在端口配置页修改端口）
        """
        widget = QWidget()
        layout = QVBoxLayout()
        widget.setLayout(layout)

        info = QLabel("在当前 GUI 中以 Hosted 模式嵌入后端与前端（不创建子进程）。")
        info.setStyleSheet("padding: 8px; background: #f5f5f5; border-radius: 6px; color: #333;")
        layout.addWidget(info)

        row = QHBoxLayout()
        btn_b_start = QPushButton('启动后端(Hosted)')
        btn_b_stop = QPushButton('停止后端')
        btn_b_stat = QPushButton('后端状态')
        btn_b_start.clicked.connect(self._start_backend_hosted)
        btn_b_stop.clicked.connect(self._stop_backend_hosted)
        btn_b_stat.clicked.connect(self._status_backend_hosted)
        row.addWidget(btn_b_start)
        row.addWidget(btn_b_stop)
        row.addWidget(btn_b_stat)
        layout.addLayout(row)

        row2 = QHBoxLayout()
        btn_home = QPushButton('启动 PDF-Home (Hosted)')
        btn_viewer = QPushButton('启动 PDF-Viewer (Hosted)')
        btn_home.clicked.connect(self._start_pdf_home_hosted)
        btn_viewer.clicked.connect(self._start_pdf_viewer_hosted)
        row2.addWidget(btn_home)
        row2.addWidget(btn_viewer)
        layout.addLayout(row2)

        return widget

    # ---- Dist 工具：Hosted 后端/前端 ----
    def _dist_root(self) -> Path:
        return PROJECT_ROOT / 'dist' / 'latest'

    def _runtime_ports(self) -> Dict[str, Any]:
        """读取后端实际端口配置，来源于当前 logs_dir（留空则 <component_root>/logs）。"""
        try:
            import json
            base = (self._logs_dir or (PROJECT_ROOT / 'logs'))
            p = base / 'runtime-ports.json'
            if p.exists():
                return json.loads(p.read_text(encoding='utf-8') or '{}')
        except Exception:
            pass
        return {}

    def _start_backend_hosted(self) -> None:
        try:
            from PyQt6.QtWidgets import QApplication
            from src.backend.launcher import BackendLauncher
            app = QApplication.instance()
            dist_root = self._dist_root()
            data_dir = str(dist_root / 'data')
            db_path = str(dist_root / 'data' / 'anki_linkmaster.db')

            self.backend_launcher_instance = BackendLauncher(
                parent_app=app,
                show_ui=False,
                runtime_mode='single',
                data_dir=data_dir,
                db_path=db_path,
                static_dir=str(dist_root / 'static'),
                pdfs_dir=str(dist_root / 'data' / 'pdfs'),
            )
            ok = self.backend_launcher_instance.start(
                msgCenter_port=self.msgCenter_port_input.value() or None,
                pdfFile_port=self.pdfFile_port_input.value() or None,
            )
            self._log(f"后端 Hosted 启动: {ok}")
        except Exception as e:
            self._log(f"[ERROR] 后端 Hosted 启动异常: {e}")

    def _stop_backend_hosted(self) -> None:
        try:
            if getattr(self, 'backend_launcher_instance', None):
                self.backend_launcher_instance.stop()
                self._log('后端 Hosted 已停止')
                self.backend_launcher_instance = None
            else:
                self._log('后端 Hosted 未运行')
        except Exception as e:
            self._log(f"[WARN] 停止后端失败: {e}")

    def _status_backend_hosted(self) -> None:
        try:
            if getattr(self, 'backend_launcher_instance', None):
                self._log(__import__('json').dumps(self.backend_launcher_instance.get_status(), ensure_ascii=False, indent=2))
            else:
                # 回退：打印 CLI 状态
                import subprocess
                cmd = [sys.executable, str(PROJECT_ROOT / 'src' / 'backend' / 'launcher.py'), 'status']
                subprocess.run(cmd, cwd=str(PROJECT_ROOT), check=False)
        except Exception as e:
            self._log(f"[WARN] Hosted 状态异常: {e}")

    def _start_pdf_home_hosted(self) -> None:
        try:
            from PyQt6.QtWidgets import QApplication
            import importlib.util as _il
            launcher_path = PROJECT_ROOT / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'
            spec = _il.spec_from_file_location('pdf_home_launcher', str(launcher_path))
            if spec is None or spec.loader is None:
                raise ImportError('无法定位 pdf-home launcher 模块')
            mod = _il.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore
            from src.frontend.common.launch_config import LaunchConfig  # type: ignore
            ports = self._runtime_ports()
            cfg = LaunchConfig(is_prod=True, keep_backend=True,
                               msgCenter_port=ports.get('msgCenter_port'),
                               pdfFile_port=ports.get('pdfFile_port'), source='gui')
            app = QApplication.instance()
            PdfHomeApp = getattr(mod, 'PdfHomeApp')
            inst = PdfHomeApp(cfg, parent_app=app)
            rc = inst.run()
            self._log(f"PDF-Home (Hosted) 启动 rc={rc}")
        except Exception as e:
            self._log(f"[ERROR] 启动 pdf-home (Hosted) 异常: {e}")

    def _start_pdf_viewer_hosted(self) -> None:
        try:
            from PyQt6.QtWidgets import QApplication
            import importlib.util as _il
            launcher_path = PROJECT_ROOT / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'
            spec = _il.spec_from_file_location('pdf_viewer_launcher', str(launcher_path))
            if spec is None or spec.loader is None:
                raise ImportError('无法定位 pdf-viewer launcher 模块')
            mod = _il.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore
            from src.frontend.common.launch_config import LaunchConfig  # type: ignore
            ports = self._runtime_ports()
            cfg = LaunchConfig(is_prod=True, keep_backend=True,
                               msgCenter_port=ports.get('msgCenter_port'),
                               pdfFile_port=ports.get('pdfFile_port'), source='gui')
            app = QApplication.instance()
            PdfViewerApp = getattr(mod, 'PdfViewerApp')
            inst = PdfViewerApp(cfg, parent_app=app)
            rc = inst.run()
            self._log(f"PDF-Viewer (Hosted) 启动 rc={rc}")
        except Exception as e:
            self._log(f"[ERROR] 启动 pdf-viewer (Hosted) 异常: {e}")

    def _on_start_vite(self):
        """启动 Vite"""
        params = {
            "vite_port": self.vite_port_input.value() or None
        }
        self._start_task("vite", params)

    # ---- CLI 映射：调用 ai_launcher.main(argv) ----
    def _cli_build_argv(self, command: str) -> list[str]:
        argv: list[str] = [command]
        if command == "start":
            # 端口
            if self.vite_port_input.value():
                argv += ["--vite-port", str(int(self.vite_port_input.value()))]
            if self.msgCenter_port_input.value():
                argv += ["--msgServer-port", str(int(self.msgCenter_port_input.value()))]
            if self.pdfFile_port_input.value():
                argv += ["--pdfFileServer-port", str(int(self.pdfFile_port_input.value()))]
            # 模块
            mod = None
            try:
                mod = self.cli_module.currentText()
            except Exception:
                mod = None
            if mod and mod != "none":
                argv += ["--module", mod]
            # PDF 参数
            try:
                pdf_id = self.cli_pdf_id.text().strip()
                if pdf_id:
                    argv += ["--pdf-id", pdf_id]
            except Exception:
                pass
            try:
                if self.cli_page_at.value():
                    argv += ["--page-at", str(int(self.cli_page_at.value()))]
            except Exception:
                pass
            try:
                if self.cli_position.value():
                    argv += ["--position", str(float(self.cli_position.value()))]
            except Exception:
                pass
            # 路径/模式
            try:
                mode = (self.runtime_mode_select.currentText() or "single").strip()
                argv += ["--runtime-mode", mode]
            except Exception:
                pass
            for flag, widget in (
                ("--ankiaddon-root-path", getattr(self, 'ankiaddon_root_input', None)),
                ("--data-dir", getattr(self, 'data_dir_input', None)),
                ("--db-path", getattr(self, 'db_path_input', None)),
                ("--static-dir", getattr(self, 'static_dir_input', None)),
                ("--pdfs-dir", getattr(self, 'pdfs_dir_input', None)),
            ):
                try:
                    if widget and widget.text().strip():
                        argv += [flag, widget.text().strip()]
                except Exception:
                    pass
        return argv

    def _cli_start(self) -> None:
        argv = self._cli_build_argv("start")
        self._run_ai_launcher(argv)

    def _cli_stop(self) -> None:
        self._run_ai_launcher(["stop"])

    def _cli_status(self) -> None:
        self._run_ai_launcher(["status"])

    def _run_ai_launcher(self, argv: list[str]) -> None:
        if _ai is None:
            self._log("[WARN] ai_launcher 不可用，无法执行 CLI 模式")
            return
        # 注入 --logs-dir 以与 GUI 当前日志目录保持一致
        argv = list(argv)
        base = str(self._logs_dir or (PROJECT_ROOT / 'logs'))
        if argv and argv[0] == 'start':
            argv += ['--logs-dir', base]
        t = _AiThread(argv)
        t.log_signal.connect(self._log)
        t.finished_signal.connect(lambda rc: self._update_status())
        t.start()

    def _on_start_backend(self):
        """启动后端"""
        # Qt线程模式：直接在主线程启动（避免线程安全问题）
        if self.backend_mode == BackendMode.QTHREAD:
            self._start_backend_qt_mode()
        else:
            # 子进程模式：使用后台线程
            params = {
                "msgCenter_port": self.msgCenter_port_input.value() or None,
                "pdfFile_port": self.pdfFile_port_input.value() or None,
                **self._collect_path_overrides(),
            }
            self._start_task("backend", params)

    def _start_backend_qt_mode(self):
        """在主线程中启动Qt线程模式的后端"""
        try:
            from src.backend.launcher import BackendLauncher
            from PyQt6.QtWidgets import QApplication

            msgCenter_port = self.msgCenter_port_input.value() or None
            pdfFile_port = self.pdfFile_port_input.value() or None

            self._log("开始任务: backend")
            self._log("🚀 正在启动后端服务器 (Qt线程模式)...")
            self._log("📌 使用 BackendLauncher (Qt线程模式，主线程启动)...")

            # 获取当前的QApplication实例
            current_app = QApplication.instance()

            # 创建BackendLauncher实例（传入路径与模式覆盖）
            overrides = self._collect_path_overrides()
            self.backend_launcher_instance = BackendLauncher(
                parent_app=current_app,
                show_ui=False,
                runtime_mode=overrides.get("runtime_mode") or "single",
                ankiaddon_root_path=overrides.get("ankiaddon_root_path"),
                data_dir=overrides.get("data_dir"),
                db_path=overrides.get("db_path"),
                static_dir=overrides.get("static_dir"),
                pdfs_dir=overrides.get("pdfs_dir"),
            )

            # 启动服务器
            success = self.backend_launcher_instance.start(
                msgCenter_port=msgCenter_port,
                pdfFile_port=pdfFile_port
            )

            if success:
                ws_port = self.backend_launcher_instance.ws_server.port if self.backend_launcher_instance.ws_server else msgCenter_port
                http_port = self.backend_launcher_instance.http_server.port if self.backend_launcher_instance.http_server else pdfFile_port

                self._log("✅ 后端启动成功 [Qt线程模式]")
                self._log(f"   WebSocket: ws://127.0.0.1:{ws_port}")
                self._log(f"   HTTP: http://127.0.0.1:{http_port}")
                self._log("   特性: 无子进程、Qt事件循环、信号槽通信")
                self._log("📌 BackendLauncher 实例已保存")

                # 更新状态
                self._update_status()
            else:
                self._log("❌ 后端启动失败 [Qt线程模式]")
                QMessageBox.critical(self, "错误", "后端启动失败 [Qt线程模式]")

        except ImportError as e:
            self._log(f"❌ 无法导入 BackendLauncher: {e}")
            self._log("💡 提示: 确保 src/backend/launcher.py 存在")
            QMessageBox.critical(self, "错误", f"后端启动失败: 无法导入 BackendLauncher")
        except Exception as e:
            self._log(f"❌ BackendLauncher 启动异常: {e}")
            import traceback
            self._log(f"   错误详情: {traceback.format_exc()}")
            QMessageBox.critical(self, "错误", f"后端启动失败: {e}")

    def _on_start_pdf_home(self):
        """启动 PDF-Home"""
        params = {
            "vite_port": self.vite_port_input.value() or 3000,
            "msgCenter_port": self.msgCenter_port_input.value() or 8765,
            "pdfFile_port": self.pdfFile_port_input.value() or 8080
        }
        self._start_task("pdf-home", params)

    def _on_start_pdf_viewer(self):
        """启动 PDF-Viewer"""
        pdf_id = self.pdf_id_input.text().strip()

        # PDF ID 可以为空 - 启动空白查看器
        if not pdf_id:
            self._log("💡 提示: 未指定 PDF ID，将启动空白查看器")

        params = {
            "vite_port": self.vite_port_input.value() or 3000,
            "msgCenter_port": self.msgCenter_port_input.value() or 8765,
            "pdfFile_port": self.pdfFile_port_input.value() or 8080,
            "pdf_id": pdf_id if pdf_id else None,  # 空字符串转为 None
            "page_at": self.page_at_input.value() if self.page_at_input.value() > 0 else None,
            "position": self.position_input.value() if self.position_input.value() > 0 else None
        }
        self._start_task("pdf-viewer", params)

    def _on_stop_all(self):
        """停止所有服务"""
        reply = QMessageBox.question(
            self, "确认",
            "确定要停止所有服务吗？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            # 传递backend_launcher_instance以便停止
            params = {}
            if self.backend_launcher_instance:
                params['_backend_launcher_instance'] = self.backend_launcher_instance

            self._start_task("stop", params)

    # ============ 配置持久化与日志目录管理 ============
    def _load_config(self) -> None:
        try:
            if self._config_path.exists():
                self._config = _read_json_safe(self._config_path)
                logs_dir = self._config.get("paths", {}).get("logs_dir")
                if logs_dir:
                    self._set_logs_dir(Path(logs_dir))
        except Exception:
            self._config = {}

    def _apply_config_to_ui(self) -> None:
        cfg = self._config or {}
        ports = cfg.get("ports", {})
        try:
            self.vite_port_input.setValue(int(ports.get("vite_port") or 0))
            self.msgCenter_port_input.setValue(int(ports.get("msgCenter_port") or 0))
            self.pdfFile_port_input.setValue(int(ports.get("pdfFile_port") or 0))
        except Exception:
            pass
        paths = cfg.get("paths", {})
        try:
            self.runtime_mode_select.setCurrentText(str(paths.get("runtime_mode") or "single"))
            self.ankiaddon_root_input.setText(str(paths.get("ankiaddon_root_path") or ""))
            self.data_dir_input.setText(str(paths.get("data_dir") or ""))
            self.db_path_input.setText(str(paths.get("db_path") or ""))
            self.static_dir_input.setText(str(paths.get("static_dir") or ""))
            self.pdfs_dir_input.setText(str(paths.get("pdfs_dir") or ""))
            self.logs_dir_input.setText(str(paths.get("logs_dir") or ""))
        except Exception:
            pass

    def _save_config_from_ui(self) -> None:
        cfg = {
            "ports": {
                "vite_port": int(self.vite_port_input.value() or 0),
                "msgCenter_port": int(self.msgCenter_port_input.value() or 0),
                "pdfFile_port": int(self.pdfFile_port_input.value() or 0),
            },
            "paths": {
                "runtime_mode": (self.runtime_mode_select.currentText() or "single").strip(),
                "ankiaddon_root_path": self.ankiaddon_root_input.text().strip() or None,
                "data_dir": self.data_dir_input.text().strip() or None,
                "db_path": self.db_path_input.text().strip() or None,
                "static_dir": self.static_dir_input.text().strip() or None,
                "pdfs_dir": self.pdfs_dir_input.text().strip() or None,
                "logs_dir": self.logs_dir_input.text().strip() or str(self._logs_dir),
            }
        }
        try:
            self._config = cfg
            self._config_path.parent.mkdir(parents=True, exist_ok=True)
            self._config_path.write_text(__import__('json').dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
            self._log("✅ 设置已保存")
        except Exception as e:
            self._log(f"[WARN] 保存设置失败: {e}")

    def _apply_logs_dir_change(self) -> None:
        text = self.logs_dir_input.text().strip()
        if text:
            self._set_logs_dir(Path(text))
        else:
            # 清空为自动推断模式
            self._logs_dir = None  # type: ignore
            self._config_path = (LOGS_DIR / "gui-launcher-config.json")
            self._init_status_watchers()
            self._log("📁 日志目录恢复自动推断")
        self._save_config_from_ui()
        self._update_status()

    def _set_logs_dir(self, new_dir: Path) -> None:
        try:
            new_dir.mkdir(parents=True, exist_ok=True)
            self._logs_dir = new_dir
            self._config_path = self._logs_dir / "gui-launcher-config.json"
            # 重新绑定文件系统监听
            self._init_status_watchers()
            self._log(f"📁 日志目录已切换到: {new_dir}")
        except Exception as e:
            self._log(f"[WARN] 切换日志目录失败: {e}")

    def _open_logs_dir(self) -> None:
        try:
            p = str(self._logs_dir)
            if sys.platform.startswith('win'):
                os.startfile(p)  # type: ignore
            elif sys.platform == 'darwin':
                os.system(f"open '{p}'")
            else:
                os.system(f"xdg-open '{p}'")
        except Exception as e:
            self._log(f"[WARN] 打开日志目录失败: {e}")

class _AiThread(QThread):
    """后台线程运行 ai_launcher.main(argv) 并输出日志"""
    log_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(int)
    def __init__(self, argv: list[str]):
        super().__init__()
        self.argv = argv
    def run(self):
        if _ai is None:
            self.finished_signal.emit(-1)
            return
        import io, contextlib, traceback
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                rc = _ai.main(self.argv)
        except SystemExit as se:
            rc = int(getattr(se, 'code', 0) or 0)
        except Exception:
            rc = 1
            buf.write(traceback.format_exc())
        out = buf.getvalue()
        if out:
            for line in out.splitlines():
                self.log_signal.emit(line)
        self.finished_signal.emit(int(rc))


def main():
    """主函数"""
    # 在创建 QApplication 之前预设置 Qt 属性并预导入 WebEngine，确保 Hosted 模式下 QtWebEngine 按时序就绪
    try:
        from PyQt6.QtCore import QCoreApplication, Qt
        try:
            QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts, True)
        except Exception:
            pass
        try:
            # 预导入以加载 WebEngine 插件
            import PyQt6.QtWebEngineCore  # type: ignore
            import PyQt6.QtWebEngineWidgets  # type: ignore
        except Exception:
            pass
    except Exception:
        pass

    app = QApplication(sys.argv)

    # 设置应用样式
    app.setStyle("Fusion")

    window = GUILauncher()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
