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
    QRadioButton, QButtonGroup
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QTextCursor

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

# 导入 ai_launcher 的功能
import ai_launcher

# 导入启动配置（用于参数传递）
from src.frontend.common.launch_config import LaunchConfig


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
        pid = ai_launcher._start_vite(vite_port)

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
            success = ai_launcher._start_backend(msgCenter_port, pdfFile_port)
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
                self.backend_launcher = BackendLauncher(
                    parent_app=current_app,  # 使用GUI的QApplication
                    show_ui=False            # 不显示测试UI
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

            # 读取后端实际使用的端口配置
            runtime_ports_file = PROJECT_ROOT / "logs" / "runtime-ports.json"
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

            # 使用subprocess.Popen在后台启动
            process = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )

            # 记录进程信息
            import json
            from pathlib import Path
            frontend_info_path = Path("logs") / "frontend-process-info.json"
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

            # 读取后端实际使用的端口配置
            runtime_ports_file = PROJECT_ROOT / "logs" / "runtime-ports.json"
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

            # 使用subprocess.Popen在后台启动
            process = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )

            # 记录进程信息
            import json
            from pathlib import Path
            frontend_info_path = Path("logs") / "frontend-process-info.json"
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
        if ai_launcher._stop_vite():
            self.log_signal.emit("✅ Vite 已停止")
        else:
            self.log_signal.emit("⚠️ Vite 停止失败或未运行")

        # 停止前端
        if ai_launcher._stop_frontend():
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
        if ai_launcher._stop_backend():
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
    """主窗口"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Anki LinkMaster PDFJS - 增强启动器")
        self.setGeometry(100, 100, 950, 750)
        self.setMinimumSize(850, 650)

        # 当前运行的线程
        self.current_thread: Optional[LauncherThread] = None

        # 后端启动模式（默认使用 Qt 线程模式）
        self.backend_mode = BackendMode.QTHREAD

        # 保存BackendLauncher实例（Qt线程模式）
        self.backend_launcher_instance = None

        # 初始化UI
        self._init_ui()

        # 启动状态检查定时器
        self.status_timer = QTimer(self)
        self.status_timer.timeout.connect(self._update_status)
        self.status_timer.start(3000)  # 每3秒更新一次状态

        # 初始状态检查
        self._update_status()

    def _init_ui(self):
        """初始化UI"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

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

        # 选项卡
        tabs = QTabWidget()
        main_layout.addWidget(tabs)

        # Tab 1: 快速启动
        tabs.addTab(self._create_quick_start_tab(), "快速启动")

        # Tab 2: PDF-Viewer 详细设置
        tabs.addTab(self._create_pdf_viewer_tab(), "PDF-Viewer")

        # Tab 3: 端口配置（新增后端模式选择）
        tabs.addTab(self._create_port_config_tab(), "端口配置")

        # 状态显示
        status_group = self._create_status_group()
        main_layout.addWidget(status_group)

        # 日志显示
        log_group = self._create_log_group()
        main_layout.addWidget(log_group)

        # 底部按钮
        button_layout = self._create_bottom_buttons()
        main_layout.addLayout(button_layout)

    def _create_quick_start_tab(self) -> QWidget:
        """创建快速启动选项卡"""
        widget = QWidget()
        layout = QVBoxLayout()
        widget.setLayout(layout)

        # 说明文字
        info_label = QLabel(
            "快速启动项目的各个组件。推荐顺序：\n"
            "1️⃣ 先启动 Vite 和后端\n"
            "2️⃣ 再启动 PDF-Home 或 PDF-Viewer\n\n"
            "💡 提示：后端启动模式可在「端口配置」选项卡中切换"
        )
        info_label.setStyleSheet("padding: 10px; background-color: #f0f0f0; border-radius: 5px;")
        layout.addWidget(info_label)

        # 按钮组
        btn_layout = QVBoxLayout()
        btn_layout.setSpacing(15)

        # Vite 按钮
        vite_btn = QPushButton("📦 启动 Vite 开发服务器")
        vite_btn.setMinimumHeight(50)
        vite_btn.clicked.connect(self._on_start_vite)
        vite_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        btn_layout.addWidget(vite_btn)

        # 后端按钮
        backend_btn = QPushButton("🚀 启动后端服务器")
        backend_btn.setMinimumHeight(50)
        backend_btn.clicked.connect(self._on_start_backend)
        backend_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #0b7dda;
            }
        """)
        btn_layout.addWidget(backend_btn)

        # PDF-Home 按钮
        pdf_home_btn = QPushButton("🏠 启动 PDF-Home")
        pdf_home_btn.setMinimumHeight(50)
        pdf_home_btn.clicked.connect(self._on_start_pdf_home)
        pdf_home_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #e68900;
            }
        """)
        btn_layout.addWidget(pdf_home_btn)

        # PDF-Viewer 按钮
        pdf_viewer_btn = QPushButton("📄 启动 PDF-Viewer（使用详细设置）")
        pdf_viewer_btn.setMinimumHeight(50)
        pdf_viewer_btn.clicked.connect(lambda: self._switch_to_tab(1))
        pdf_viewer_btn.setStyleSheet("""
            QPushButton {
                background-color: #9C27B0;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #7B1FA2;
            }
        """)
        btn_layout.addWidget(pdf_viewer_btn)

        layout.addLayout(btn_layout)
        layout.addStretch()

        return widget

    def _create_pdf_viewer_tab(self) -> QWidget:
        """创建 PDF-Viewer 详细设置选项卡"""
        widget = QWidget()
        layout = QVBoxLayout()
        widget.setLayout(layout)

        # PDF ID
        pdf_id_group = QGroupBox("PDF 标识符")
        pdf_id_layout = QHBoxLayout()
        pdf_id_group.setLayout(pdf_id_layout)

        pdf_id_label = QLabel("PDF ID:")
        self.pdf_id_input = QLineEdit()
        self.pdf_id_input.setPlaceholderText("例如: sample, my-document (留空则启动空白查看器)")
        pdf_id_layout.addWidget(pdf_id_label)
        pdf_id_layout.addWidget(self.pdf_id_input)

        layout.addWidget(pdf_id_group)

        # 页面导航
        nav_group = QGroupBox("页面导航（可选）")
        nav_layout = QVBoxLayout()
        nav_group.setLayout(nav_layout)

        # 页码
        page_layout = QHBoxLayout()
        page_label = QLabel("目标页码:")
        self.page_at_input = QSpinBox()
        self.page_at_input.setMinimum(0)
        self.page_at_input.setMaximum(99999)
        self.page_at_input.setValue(0)
        self.page_at_input.setSpecialValueText("不指定")
        page_layout.addWidget(page_label)
        page_layout.addWidget(self.page_at_input)
        page_layout.addStretch()
        nav_layout.addLayout(page_layout)

        # 位置
        pos_layout = QHBoxLayout()
        pos_label = QLabel("页面位置 (%):")
        self.position_input = QDoubleSpinBox()
        self.position_input.setMinimum(0.0)
        self.position_input.setMaximum(100.0)
        self.position_input.setValue(0.0)
        self.position_input.setDecimals(1)
        self.position_input.setSingleStep(5.0)
        pos_layout.addWidget(pos_label)
        pos_layout.addWidget(self.position_input)
        pos_layout.addStretch()
        nav_layout.addLayout(pos_layout)

        layout.addWidget(nav_group)

        # 启动按钮
        start_btn = QPushButton("🚀 启动 PDF-Viewer")
        start_btn.setMinimumHeight(50)
        start_btn.clicked.connect(self._on_start_pdf_viewer)
        start_btn.setStyleSheet("""
            QPushButton {
                background-color: #9C27B0;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #7B1FA2;
            }
        """)
        layout.addWidget(start_btn)

        layout.addStretch()

        return widget

    def _create_port_config_tab(self) -> QWidget:
        """创建端口配置选项卡（新增后端模式选择）"""
        widget = QWidget()
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
        # ========================================

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

        layout.addStretch()

        return widget

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
        self.log_text.setMaximumHeight(200)
        layout.addWidget(self.log_text)

        return group

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
        # 读取状态文件
        dev_info = ai_launcher.read_json(ai_launcher.LOGS_DIR / "dev-process-info.json")
        backend_info = ai_launcher.read_json(ai_launcher.LOGS_DIR / "backend-process-info.json")
        frontend_info = ai_launcher.read_json(ai_launcher.LOGS_DIR / "frontend-process-info.json")

        # 更新 Vite 状态
        vite_pid = dev_info.get("vite", {}).get("pid")
        if vite_pid and ai_launcher.is_process_running(vite_pid):
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
        if backend_pid and ai_launcher.is_process_running(backend_pid):
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
                if p.get("pid") and ai_launcher.is_process_running(p.get("pid"))
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

    def _on_start_vite(self):
        """启动 Vite"""
        params = {
            "vite_port": self.vite_port_input.value() or None
        }
        self._start_task("vite", params)

    def _on_start_backend(self):
        """启动后端"""
        # Qt线程模式：直接在主线程启动（避免线程安全问题）
        if self.backend_mode == BackendMode.QTHREAD:
            self._start_backend_qt_mode()
        else:
            # 子进程模式：使用后台线程
            params = {
                "msgCenter_port": self.msgCenter_port_input.value() or None,
                "pdfFile_port": self.pdfFile_port_input.value() or None
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

            # 创建BackendLauncher实例
            self.backend_launcher_instance = BackendLauncher(
                parent_app=current_app,
                show_ui=False
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


def main():
    """主函数"""
    app = QApplication(sys.argv)

    # 设置应用样式
    app.setStyle("Fusion")

    window = GUILauncher()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
