"""
WebSocket服务器模块 (已重构，更简洁、更健壮)
"""
import logging
import json
from src.backend.qt.compat import (
    QObject, pyqtSignal, pyqtSlot,
    QWebSocketServer, QWebSocket,
    QHostAddress, QAbstractSocket
)

logger = logging.getLogger(__name__)

# WebSocketClient 类不再需要了，可以删除

class WebSocketServer(QObject):
    """WebSocket服务器类 (直接管理 QWebSocket)"""
    
    # 定义信号 (可以根据需要保留)
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    message_received = pyqtSignal(QWebSocket, dict)
    
    def __init__(self, host="127.0.0.1", port=8765):
        super().__init__()
        self.host = host
        self.port = port
        self.server = QWebSocketServer("Anki LinkMaster WebSocket Server", QWebSocketServer.SslMode.NonSecureMode)
        
        # 直接用一个列表来存储 QWebSocket 对象
        self.clients = []
        self.running = False
        
        self.server.newConnection.connect(self.on_new_connection)
        
    def start(self):
        if self.running:
            logger.warning("WebSocket服务器已在运行")
            return False
        
        if self.server.listen(QHostAddress.SpecialAddress.LocalHost, self.port):
            self.running = True
            logger.info(f"WebSocket服务器启动成功: ws://{self.host}:{self.port}")
            return True
        else:
            logger.error(f"WebSocket服务器启动失败: {self.server.errorString()}")
            return False
            
    def stop(self):
        if not self.running:
            return
        self.server.close()
        for client in self.clients:
            client.close()
        self.clients.clear()
        self.running = False
        logger.info("WebSocket服务器已停止")
        
    @pyqtSlot()
    def on_new_connection(self):
        """处理新客户端连接"""
        # socket 就是 QWebSocket 对象，它就是我们的客户端
        socket = self.server.nextPendingConnection()
        if not socket:
            logger.error("获取新连接失败")
            return
        
        # 设置更多的调试信息
        logger.info(f"新客户端连接请求: {socket.peerAddress().toString()}:{socket.peerPort()}")
        logger.info(f"客户端协议: {socket.requestUrl().toString()}")
        logger.info(f"客户端Origin: {socket.origin()}")
        
        # 直接将 socket 的信号连接到我们的处理槽函数
        socket.textMessageReceived.connect(self.on_message_received)
        socket.disconnected.connect(self.on_client_disconnected)
        socket.errorOccurred.connect(self.on_socket_error)
        
        self.clients.append(socket)
        logger.info(f"新客户端连接成功: {socket.peerAddress().toString()}:{socket.peerPort()}")
        logger.info(f"当前连接的客户端数量: {len(self.clients)}")
        self.client_connected.emit(socket)
        
    @pyqtSlot(str)
    def on_message_received(self, message):
        """处理收到的消息"""
        # sender() 会返回发送信号的那个 QWebSocket 对象
        client_socket = self.sender()
        logger.info(f"📨 收到来自 {client_socket.peerPort()} 的消息: {message}")
        logger.info(f"📨 客户端状态: {client_socket.state()}")
        try:
            parsed_message = json.loads(message)
            logger.info(f"📨 解析后的消息类型: {parsed_message.get('type', 'unknown')}")
            self.message_received.emit(client_socket, parsed_message)
        except json.JSONDecodeError as e:
            logger.error(f"❌ 消息解析失败: {e}")
            logger.error(f"❌ 原始消息内容: {message}")
            
    @pyqtSlot()
    def on_client_disconnected(self):
        """处理客户端断开连接"""
        client_socket = self.sender()
        if client_socket in self.clients:
            self.clients.remove(client_socket)
            logger.info(f"客户端断开连接: {client_socket.peerPort()}")
            self.client_disconnected.emit(client_socket)
    
    def on_socket_error(self, error):
        """处理WebSocket错误"""
        client_socket = self.sender()
        logger.error(f"WebSocket错误 from {client_socket.peerPort()}: {error}")
        if client_socket in self.clients:
            self.clients.remove(client_socket)
            
    def broadcast_message(self, message):
        """广播消息给所有客户端"""
        if isinstance(message, dict):
            message = json.dumps(message)
        
        logger.info(f"📡 准备向 {len(self.clients)} 个客户端广播消息: {message}")
        logger.info(f"📡 客户端列表: {[f'{c.peerPort()}' for c in self.clients]}")
        
        sent_count = 0
        # 清理无效的客户端连接
        valid_clients = []
        for client in self.clients:
            client_port = client.peerPort()
            client_state = client.state()
            logger.info(f"📡 检查客户端 {client_port}, 状态: {client_state}")
            
            if client_state == QAbstractSocket.SocketState.ConnectedState:
                try:
                    logger.info(f"📡 向客户端 {client_port} 发送消息")
                    client.sendTextMessage(message)
                    sent_count += 1
                    valid_clients.append(client)
                    logger.info(f"✅ 向客户端 {client_port} 发送成功")
                except Exception as e:
                    logger.error(f"❌ 向客户端 {client_port} 发送消息失败: {e}")
            else:
                logger.warning(f"⚠️ 客户端 {client_port} 已断开连接，从列表中移除")
        
        # 更新客户端列表
        self.clients = valid_clients
        logger.info(f"📡 广播消息完成，已成功发送给 {sent_count}/{len(self.clients)} 个客户端")
    
    def broadcast_event(self, event_name, payload):
        """Broadcast a JSON event to all connected clients."""
        try:
            msg = json.dumps({"event": event_name, "payload": payload})
        except (TypeError, ValueError) as e:
            logger.error(f"无法序列化 event/payload 为 JSON: {e}")
            return 0

        logger.info(f"📡 准备广播事件 '{event_name}' 到 {len(self.clients)} 个客户端")
        sent_count = 0
        valid_clients = []
        for client in list(self.clients):
            try:
                if client.state() == QAbstractSocket.SocketState.ConnectedState:
                    client.sendTextMessage(msg)
                    sent_count += 1
                    valid_clients.append(client)
                    logger.info(f"✅ 向客户端 {client.peerPort()} 发送事件 '{event_name}'")
                else:
                    logger.warning(f"⚠️ 客户 {client.peerPort()} 未连接，准备移除")
            except Exception as e:
                logger.error(f"❌ 向客户端 {getattr(client, 'peerPort', lambda: 'unknown')()} 发送事件失败: {e}")
                try:
                    if client in self.clients:
                        self.clients.remove(client)
                except Exception:
                    # 忽略移除时的任何异常
                    pass

        # 更新客户端列表为仍然有效的客户端
        self.clients = valid_clients
        logger.info(f"📡 事件广播完成，成功发送给 {sent_count} 个客户端")
        return sent_count

    def get_client_count(self):
        """获取当前连接的客户端数量"""
        return len(self.clients)
        
    def get_client_ids(self):
        """获取所有客户端ID列表"""
        return [f"client_{i}" for i in range(len(self.clients))]
    
    def send_message(self, client, response):
        """发送消息给指定客户端"""
        if isinstance(response, dict):
            response = json.dumps(response)
        
        # client 可以是 QWebSocket 对象或索引
        if isinstance(client, QWebSocket):
            try:
                if client.state() == QAbstractSocket.SocketState.ConnectedState:
                    client.sendTextMessage(response)
                    logger.info(f"websocket server 内部 向客户端 {client.peerPort()} 发送消息: {response}")
                    return True
                else:
                    logger.warning(f"客户端 {client.peerPort()} 未连接，无法发送消息")
                    return False
            except Exception as e:
                logger.error(f"向客户端 {client.peerPort()} 发送消息失败: {e}")
                return False
        elif isinstance(client, int) and 0 <= client < len(self.clients):
            target_client = self.clients[client]
            try:
                if target_client.state() == QAbstractSocket.SocketState.ConnectedState:
                    target_client.sendTextMessage(response)
                    logger.info(f"websocket server 内部 向客户端索引 {client} 发送消息: {response}")
                    return True
                else:
                    logger.warning(f"客户端索引 {client} 未连接，无法发送消息")
                    return False
            except Exception as e:
                logger.error(f"向客户端索引 {client} 发送消息失败: {e}")
                return False
        else:
            logger.error(f"无效的客户端参数: {client}")
            return False
