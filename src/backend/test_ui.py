#!/usr/bin/env python3
"""
后端服务器测试UI

提供可视化的服务器状态监控界面,用于开发和调试。
通过环境变量 BACKEND_SHOW_UI=1 控制是否显示。

功能:
- 显示服务器运行状态
- 显示端口信息
- 显示客户端连接数
- 提供停止按钮
"""

from typing import Optional
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QGroupBox, QTextEdit
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont


class TestUI(QWidget):
    """
    后端服务器测试UI

    功能:
    - 实时显示服务器状态（运行/停止）
    - 显示WebSocket和HTTP服务器端口信息
    - 显示WebSocket客户端连接数
    - 提供停止服务器按钮
    - 关闭窗口时自动停止服务器

    信号:
    - stop_requested: 用户请求停止服务器时发射
    """

    # 信号
    stop_requested = pyqtSignal()

    def __init__(self, launcher: Optional['BackendLauncher'] = None, parent: Optional[QWidget] = None):
        """
        初始化测试UI

        Args:
            launcher: BackendLauncher 实例（用于获取状态和停止服务）
            parent: 父窗口
        """
        super().__init__(parent)

        self.launcher = launcher

        # 设置窗口属性
        self.setWindowTitle("PDF Backend Server - Test UI")
        self.setGeometry(100, 100, 500, 400)
        self.setMinimumSize(400, 300)

        # 初始化UI
        self._init_ui()

        # 启动定时器，每秒更新状态
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self._update_status)
        self.update_timer.start(1000)  # 1秒更新一次

        # 初始更新
        self._update_status()

    def _init_ui(self):
        """初始化UI组件"""
        layout = QVBoxLayout()
        layout.setSpacing(10)
        layout.setContentsMargins(15, 15, 15, 15)

        # 标题
        title_label = QLabel("📡 后端服务器监控")
        title_font = QFont()
        title_font.setPointSize(14)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title_label)

        # 状态组
        status_group = self._create_status_group()
        layout.addWidget(status_group)

        # WebSocket 信息组
        ws_group = self._create_websocket_group()
        layout.addWidget(ws_group)

        # HTTP 信息组
        http_group = self._create_http_group()
        layout.addWidget(http_group)

        # 日志区域
        log_group = self._create_log_group()
        layout.addWidget(log_group)

        # 按钮区域
        button_layout = self._create_button_layout()
        layout.addLayout(button_layout)

        self.setLayout(layout)

    def _create_status_group(self) -> QGroupBox:
        """创建状态组"""
        group = QGroupBox("服务器状态")
        layout = QVBoxLayout()

        self.status_label = QLabel("🟢 服务器运行中")
        status_font = QFont()
        status_font.setPointSize(12)
        self.status_label.setFont(status_font)
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.status_label)

        self.mode_label = QLabel("模式: 子进程")
        self.mode_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.mode_label)

        group.setLayout(layout)
        return group

    def _create_websocket_group(self) -> QGroupBox:
        """创建WebSocket信息组"""
        group = QGroupBox("WebSocket 服务器")
        layout = QVBoxLayout()

        self.ws_status_label = QLabel("状态: ✅ 运行中")
        layout.addWidget(self.ws_status_label)

        self.ws_port_label = QLabel("端口: ws://127.0.0.1:8765")
        layout.addWidget(self.ws_port_label)

        self.ws_clients_label = QLabel("客户端连接数: 0")
        layout.addWidget(self.ws_clients_label)

        group.setLayout(layout)
        return group

    def _create_http_group(self) -> QGroupBox:
        """创建HTTP信息组"""
        group = QGroupBox("HTTP 文件服务器")
        layout = QVBoxLayout()

        self.http_status_label = QLabel("状态: ✅ 运行中")
        layout.addWidget(self.http_status_label)

        self.http_port_label = QLabel("端口: http://127.0.0.1:8080")
        layout.addWidget(self.http_port_label)

        group.setLayout(layout)
        return group

    def _create_log_group(self) -> QGroupBox:
        """创建日志区域"""
        group = QGroupBox("状态日志")
        layout = QVBoxLayout()

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(100)
        self.log_text.setPlaceholderText("状态更新将显示在这里...")
        layout.addWidget(self.log_text)

        group.setLayout(layout)
        return group

    def _create_button_layout(self) -> QHBoxLayout:
        """创建按钮布局"""
        layout = QHBoxLayout()

        # 刷新按钮
        refresh_btn = QPushButton("🔄 刷新状态")
        refresh_btn.clicked.connect(self._update_status)
        layout.addWidget(refresh_btn)

        # 停止按钮
        self.stop_btn = QPushButton("⏹️ 停止服务器")
        self.stop_btn.clicked.connect(self._on_stop_clicked)
        self.stop_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                font-weight: bold;
                padding: 8px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        layout.addWidget(self.stop_btn)

        return layout

    def _update_status(self):
        """更新状态显示"""
        if not self.launcher:
            return

        try:
            # 获取状态
            status = self.launcher.get_status()

            # 更新模式标签
            mode_text = "子进程" if status["mode"] == "subprocess" else "寄宿"
            self.mode_label.setText(f"模式: {mode_text}")

            # 更新WebSocket状态
            ws_status = status.get("websocket", {})
            ws_running = ws_status.get("running", False)
            ws_port = ws_status.get("port", 8765)
            ws_clients = ws_status.get("clients", 0)

            if ws_running:
                self.ws_status_label.setText("状态: ✅ 运行中")
                self.ws_port_label.setText(f"端口: ws://127.0.0.1:{ws_port}")
                self.ws_clients_label.setText(f"客户端连接数: {ws_clients}")
            else:
                self.ws_status_label.setText("状态: ❌ 未运行")
                self.ws_port_label.setText("端口: N/A")
                self.ws_clients_label.setText("客户端连接数: 0")

            # 更新HTTP状态
            http_status = status.get("http", {})
            http_running = http_status.get("running", False)
            http_port = http_status.get("port", 8080)

            if http_running:
                self.http_status_label.setText("状态: ✅ 运行中")
                self.http_port_label.setText(f"端口: http://127.0.0.1:{http_port}")
            else:
                self.http_status_label.setText("状态: ❌ 未运行")
                self.http_port_label.setText("端口: N/A")

            # 更新总体状态
            if ws_running and http_running:
                self.status_label.setText("🟢 服务器运行中")
                self.status_label.setStyleSheet("color: green;")
            elif ws_running or http_running:
                self.status_label.setText("🟡 部分服务运行中")
                self.status_label.setStyleSheet("color: orange;")
            else:
                self.status_label.setText("🔴 服务器已停止")
                self.status_label.setStyleSheet("color: red;")

        except Exception as e:
            self._log(f"更新状态失败: {e}")

    def _on_stop_clicked(self):
        """停止按钮点击事件"""
        self._log("用户请求停止服务器...")

        # 发射停止信号
        self.stop_requested.emit()

        # 如果有launcher实例，直接调用stop
        if self.launcher:
            try:
                self.launcher.stop()
                self._log("✅ 服务器已停止")
                self._update_status()

                # 禁用停止按钮
                self.stop_btn.setEnabled(False)
                self.stop_btn.setText("⏹️ 已停止")

            except Exception as e:
                self._log(f"❌ 停止服务器失败: {e}")

    def _log(self, message: str):
        """添加日志消息"""
        import time
        timestamp = time.strftime("%H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        self.log_text.append(log_message)

        # 自动滚动到底部
        self.log_text.verticalScrollBar().setValue(
            self.log_text.verticalScrollBar().maximum()
        )

    def closeEvent(self, event):
        """窗口关闭事件 - 自动停止服务器"""
        self._log("窗口关闭，停止服务器...")

        # 停止定时器
        if hasattr(self, 'update_timer'):
            self.update_timer.stop()

        # 停止服务器（如果还在运行）
        if self.launcher:
            try:
                if self.launcher.is_ws_running() or self.launcher.is_http_running():
                    self.launcher.stop()
                    self._log("✅ 服务器已停止")
            except Exception as e:
                self._log(f"❌ 停止服务器失败: {e}")

        # 发射停止信号
        self.stop_requested.emit()

        # 接受关闭事件
        event.accept()


def main():
    """测试UI独立运行（用于测试）"""
    import sys
    from PyQt6.QtWidgets import QApplication

    app = QApplication(sys.argv)

    # 创建测试UI（不传launcher，仅显示UI）
    ui = TestUI()
    ui.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
