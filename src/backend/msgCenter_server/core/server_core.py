from typing import Optional
from src.qt.compat import QObject, pyqtSignal, QWebSocketServer, QWebSocket, QHostAddress, QAbstractSocket
import json
import os
from datetime import datetime


class WebSocketServerCore(QObject):
    """
    仅负责 Qt WebSocket 服务器的启停、连接管理与文本消息转发。
    不涉及业务解析与路由，业务由上层组合类处理。
    """
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    text_message_received = pyqtSignal(QWebSocket, str)
    socket_error = pyqtSignal(int)

    def __init__(self, host: str = "127.0.0.1", port: int = 8765, parent: Optional[QObject] = None):
        super().__init__(parent)
        self.host = host
        self.port = port
        self.server = QWebSocketServer("Anki LinkMaster Standard Server", QWebSocketServer.SslMode.NonSecureMode)
        self.clients: list[QWebSocket] = []
        self.running = False
        self.server.newConnection.connect(self._on_new_connection)

    def start(self) -> bool:
        if self.running:
            return True
        if self.server.listen(QHostAddress.SpecialAddress.LocalHost, self.port):
            self.running = True
            try:
                # 写入探针文件，便于外部诊断端口/地址是否真正绑定
                self._write_probe(True)
            except Exception:
                pass
            return True
        return False

    def stop(self) -> None:
        if not self.running:
            return
        self.server.close()
        for c in list(self.clients):
            try:
                c.close()
            except Exception:
                pass
        self.clients.clear()
        self.running = False
        try:
            self._write_probe(False)
        except Exception:
            pass

    def get_client_count(self) -> int:
        return len(self.clients)

    def broadcast_text(self, text: str) -> None:
        for c in self.clients:
            if c.state() == QAbstractSocket.SocketState.ConnectedState:
                c.sendTextMessage(text)

    def send_text(self, client: QWebSocket, text: str) -> bool:
        try:
            if client.state() == QAbstractSocket.SocketState.ConnectedState:
                client.sendTextMessage(text)
                return True
        except Exception:
            pass
        return False

    # -------------- internal slots --------------
    def _on_new_connection(self) -> None:
        socket = self.server.nextPendingConnection()
        if not socket:
            return
        socket.textMessageReceived.connect(lambda msg, s=socket: self.text_message_received.emit(s, msg))
        socket.disconnected.connect(lambda s=socket: self._on_client_disconnected(s))
        # PyQt6 传递的是 QAbstractSocket.SocketError 枚举，不能直接 int(e)
        try:
            socket.errorOccurred.disconnect()
        except Exception:
            pass
        socket.errorOccurred.connect(self._on_socket_error)
        self.clients.append(socket)
        self.client_connected.emit(socket)

    def _on_client_disconnected(self, socket: QWebSocket) -> None:
        try:
            if socket in self.clients:
                self.clients.remove(socket)
        except Exception:
            pass
        self.client_disconnected.emit(socket)

    def _on_socket_error(self, err) -> None:
        """兼容 PyQt5/6 的 SocketError 发射枚举，统一转为 int 代码。"""
        try:
            code = getattr(err, 'value', err)
            code = int(code)
        except Exception:
            code = 0
        self.socket_error.emit(code)

    # -------------- diagnostics --------------
    def _write_probe(self, running: bool) -> None:
        """写入诊断探针文件（logs/ws-probe.json，UTF-8，覆盖写）"""
        try:
            os.makedirs("logs", exist_ok=True)
            info = {
                "running": bool(running),
                "bound_address": str(self.server.serverAddress().toString() if self.server else ""),
                "bound_port": int(self.server.serverPort() if self.server else 0),
                "configured_host": str(self.host),
                "configured_port": int(self.port),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            with open(os.path.join("logs", "ws-probe.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(info, f, ensure_ascii=False, indent=2)
        except Exception:
            # 诊断辅助，失败忽略
            pass
