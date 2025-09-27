"""
WebSocket客户端连接管理模块
"""
import json
import logging
from src.qt.compat import QObject, pyqtSignal, QTimer, pyqtSlot
from src.qt.compat import QWebSocket

logger = logging.getLogger(__name__)

class WebSocketClient(QObject):
    """WebSocket客户端连接管理类"""
    
    message_received = pyqtSignal(str, str)  # client_id, message
    disconnected = pyqtSignal(str)  # client_id
    
    def __init__(self, socket, client_id):
        super().__init__()
        self.socket = socket
        self.client_id = client_id
        self.heartbeat_timer = QTimer()
        self.heartbeat_timer.timeout.connect(self.send_heartbeat)
        
        # 设置WebSocket信号
        self.socket.textMessageReceived.connect(self.on_message_received)
        self.socket.disconnected.connect(self.on_disconnected)
        self.socket.errorOccurred.connect(self.on_error)
        
        # 启动心跳
        self.heartbeat_timer.start(30000)  # 30秒心跳
        
        logger.info(f"WebSocket client initialized: {client_id}")
        
    @pyqtSlot(str)
    def on_message_received(self, message):
        """处理接收到的消息"""
        try:
            logger.debug(f"Received message from {self.client_id}: {message}")
            self.message_received.emit(self.client_id, message)
        except Exception as e:
            logger.error(f"Failed to process message from {self.client_id}: {e}")
    
    def send_message(self, message):
        """发送WebSocket消息"""
        try:
            if isinstance(message, dict):
                message = json.dumps(message)
            
            # 使用QWebSocket的sendTextMessage方法
            self.socket.sendTextMessage(message)
            logger.info(f"Message sent to {self.client_id}: {message}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message to {self.client_id}: {e}")
            return False
    
    def send_heartbeat(self):
        """发送心跳包"""
        self.send_message({"type": "ping"})
    
    @pyqtSlot()
    def on_disconnected(self):
        """客户端断开连接处理"""
        self.heartbeat_timer.stop()
        logger.info(f"Client {self.client_id} disconnected")
        self.disconnected.emit(self.client_id)
    
    def on_error(self):
        """处理socket错误"""
        logger.error(f"Socket error for {self.client_id}: {self.socket.errorString()}")
        self.socket.close()
    
    def close(self):
        """关闭客户端连接"""
        self.heartbeat_timer.stop()
        if self.socket.state() == QWebSocket.State.ConnectedState:
            self.socket.close()