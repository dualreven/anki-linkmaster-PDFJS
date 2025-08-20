"""
WebSocket服务器模块
负责处理前端与后端的实时通信
"""

import logging
import json
from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtNetwork import QTcpServer, QHostAddress
from .client import WebSocketClient

logger = logging.getLogger(__name__)


class WebSocketServer(QObject):
    """WebSocket服务器类"""
    
    # 定义信号
    client_connected = pyqtSignal(str)      # 客户端连接成功
    client_disconnected = pyqtSignal(str)   # 客户端断开连接
    message_received = pyqtSignal(str, dict)  # 收到消息 (client_id, message)
    
    def __init__(self, host="127.0.0.1", port=8765):
        """初始化WebSocket服务器
        
        Args:
            host: 服务器地址，默认127.0.0.1
            port: 服务器端口，默认8765
        """
        super().__init__()
        self.host = host
        self.port = port
        self.server = QTcpServer()
        self.clients = {}  # client_id -> WebSocketClient
        self.running = False
        self.client_counter = 0
        
        # 设置服务器信号
        self.server.newConnection.connect(self.on_new_connection)
        
    def start(self):
        """启动WebSocket服务器
        
        Returns:
            bool: 启动成功返回True，失败返回False
        """
        if self.running:
            logger.warning("WebSocket服务器已在运行")
            return False
            
        try:
            success = self.server.listen(QHostAddress(self.host), self.port)
            if success:
                self.running = True
                logger.info(f"WebSocket服务器启动成功: {self.host}:{self.port}")
                return True
            else:
                logger.error(f"WebSocket服务器启动失败: 端口{self.port}可能已被占用")
                return False
                
        except Exception as e:
            logger.error(f"WebSocket服务器启动失败: {e}")
            return False
            
    def stop(self):
        """停止WebSocket服务器"""
        if not self.running:
            return
            
        # 关闭所有客户端连接
        for client in list(self.clients.values()):
            client.close()
            
        self.server.close()
        self.running = False
        self.clients.clear()
        logger.info("WebSocket服务器已停止")
        
    def start_server(self):
        """启动WebSocket服务器（兼容测试别名）"""
        return self.start()
        
    def stop_server(self):
        """停止WebSocket服务器（兼容测试）"""
        return self.stop()
        
    def on_new_connection(self):
        """处理新客户端连接"""
        socket = self.server.nextPendingConnection()
        self.client_counter += 1
        client_id = f"client_{self.client_counter}"
        
        # 创建客户端管理器
        client = WebSocketClient(socket, client_id)
        
        # 连接信号
        client.message_received.connect(
            lambda cid, msg: self.on_message_received(cid, msg)
        )
        client.disconnected.connect(
            lambda cid: self.on_client_disconnected(cid)
        )
        
        self.clients[client_id] = client
        
        logger.info(f"新客户端连接: {client_id}")
        self.client_connected.emit(client_id)
        
    def on_message_received(self, client_id, message):
        """处理收到的消息
        
        Args:
            client_id: 客户端ID
            message: 消息内容
        """
        try:
            parsed_message = json.loads(message)
            logger.debug(f"收到消息 [{client_id}]: {parsed_message}")
            self.message_received.emit(client_id, parsed_message)
        except json.JSONDecodeError as e:
            logger.error(f"消息解析失败 [{client_id}]: {e}")
            
    def on_client_disconnected(self, client_id):
        """处理客户端断开连接
        
        Args:
            client_id: 断开连接的客户端ID
        """
        if client_id in self.clients:
            del self.clients[client_id]
            logger.info(f"客户端断开连接: {client_id}")
            self.client_disconnected.emit(client_id)
            
    def send_message(self, client_id, message):
        """发送消息给指定客户端
        
        Args:
            client_id: 目标客户端ID
            message: 消息内容（dict或str）
            
        Returns:
            bool: 发送成功返回True
        """
        if client_id not in self.clients:
            logger.warning(f"客户端不存在: {client_id}")
            return False
            
        client = self.clients[client_id]
        
        if isinstance(message, dict):
            message = json.dumps(message)
            
        success = client.send_message(message)
        if success:
            logger.debug(f"消息发送成功 [{client_id}]: {message}")
        else:
            logger.error(f"消息发送失败 [{client_id}]: {message}")
            
        return success
        
    def broadcast_message(self, message, exclude_client=None):
        """广播消息给所有客户端
        
        Args:
            message: 消息内容（dict或str）
            exclude_client: 排除的客户端ID（可选）
        """
        if isinstance(message, dict):
            message = json.dumps(message)
            
        sent_count = 0
        for client_id, client in self.clients.items():
            if client_id != exclude_client:
                if client.send_message(message):
                    sent_count += 1
                    
        logger.info(f"广播消息完成，发送给 {sent_count}/{len(self.clients)} 个客户端")
        
    def get_client_count(self):
        """获取当前连接的客户端数量
        
        Returns:
            int: 客户端数量
        """
        return len(self.clients)
        
    def get_client_ids(self):
        """获取所有客户端ID列表
        
        Returns:
            list: 客户端ID列表
        """
        return list(self.clients.keys())
        
    def is_running(self):
        """检查服务器是否在运行
        
        Returns:
            bool: 运行状态
        """
        return self.running