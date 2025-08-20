"""
WebSocket客户端连接管理模块
"""
import json
import struct
import hashlib
import base64
import logging
from PyQt6.QtCore import QObject, pyqtSignal, QTimer
from PyQt6.QtNetwork import QTcpSocket

logger = logging.getLogger(__name__)

class WebSocketClient(QObject):
    """WebSocket客户端连接管理类"""
    
    message_received = pyqtSignal(str, str)  # client_id, message
    disconnected = pyqtSignal(str)  # client_id
    
    def __init__(self, socket, client_id):
        super().__init__()
        self.socket = socket
        self.client_id = client_id
        self.handshake_done = False
        self.buffer = b''
        self.heartbeat_timer = QTimer()
        self.heartbeat_timer.timeout.connect(self.send_heartbeat)
        
        # 设置socket信号
        self.socket.readyRead.connect(self.on_ready_read)
        self.socket.disconnected.connect(self.on_disconnected)
        self.socket.errorOccurred.connect(self.on_error)
        
    def on_ready_read(self):
        """处理接收到的数据"""
        if not self.handshake_done:
            self.handle_handshake()
        else:
            self.handle_websocket_frame()
    
    def handle_handshake(self):
        """处理WebSocket握手"""
        data = self.socket.readAll().data()
        request = data.decode('utf-8')
        
        if 'Sec-WebSocket-Key' not in request:
            logger.warning(f"Invalid WebSocket handshake from {self.client_id}")
            self.socket.disconnectFromHost()
            return
            
        # 提取Sec-WebSocket-Key
        key = None
        for line in request.split('\r\n'):
            if line.startswith('Sec-WebSocket-Key:'):
                key = line.split(': ')[1]
                break
                
        if not key:
            self.socket.disconnectFromHost()
            return
            
        # 生成响应密钥
        magic_string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept_key = base64.b64encode(
            hashlib.sha1((key + magic_string).encode()).digest()
        ).decode()
        
        # 发送握手响应
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
        )
        
        self.socket.write(response.encode())
        self.handshake_done = True
        
        # 启动心跳
        self.heartbeat_timer.start(30000)  # 30秒心跳
        
        logger.info(f"WebSocket handshake completed for {self.client_id}")
    
    def handle_websocket_frame(self):
        """处理WebSocket数据帧"""
        data = self.socket.readAll().data()
        self.buffer += data
        
        while len(self.buffer) >= 2:
            # 解析WebSocket帧头
            first_byte = self.buffer[0]
            second_byte = self.buffer[1]
            
            # 检查是否为文本帧
            opcode = first_byte & 0x0F
            if opcode == 0x8:  # 关闭连接帧
                logger.info(f"Client {self.client_id} sent close frame")
                self.socket.disconnectFromHost()
                return
                
            # 获取负载长度
            payload_len = second_byte & 0x7F
            header_len = 2
            
            if payload_len == 126:
                if len(self.buffer) < 4:
                    return
                payload_len = struct.unpack('>H', self.buffer[2:4])[0]
                header_len = 4
            elif payload_len == 127:
                if len(self.buffer) < 10:
                    return
                payload_len = struct.unpack('>Q', self.buffer[2:10])[0]
                header_len = 10
                
            # 检查是否有完整的帧
            if len(self.buffer) < header_len + payload_len + 4:
                return
                
            # 提取掩码和负载
            mask = self.buffer[header_len:header_len+4]
            payload = self.buffer[header_len+4:header_len+4+payload_len]
            
            # 解码负载
            decoded = bytes([payload[i] ^ mask[i % 4] for i in range(len(payload))])
            
            try:
                message = decoded.decode('utf-8')
                self.message_received.emit(self.client_id, message)
                logger.debug(f"Received message from {self.client_id}: {message}")
            except UnicodeDecodeError as e:
                logger.error(f"Failed to decode message from {self.client_id}: {e}")
            
            # 移除已处理的数据
            self.buffer = self.buffer[header_len+4+payload_len:]
    
    def send_message(self, message):
        """发送WebSocket消息"""
        if not self.handshake_done:
            return False
            
        try:
            if isinstance(message, dict):
                message = json.dumps(message)
            
            message_bytes = message.encode('utf-8')
            
            # 构建WebSocket帧
            frame = b'\x81'  # 文本帧，FIN位设置
            
            # 负载长度
            length = len(message_bytes)
            if length < 126:
                frame += struct.pack('B', length)
            elif length < 65536:
                frame += struct.pack('B', 126) + struct.pack('>H', length)
            else:
                frame += struct.pack('B', 127) + struct.pack('>Q', length)
                
            frame += message_bytes
            
            bytes_sent = self.socket.write(frame)
            return bytes_sent > 0
            
        except Exception as e:
            logger.error(f"Failed to send message to {self.client_id}: {e}")
            return False
    
    def send_heartbeat(self):
        """发送心跳包"""
        self.send_message({"type": "ping"})
    
    def on_disconnected(self):
        """客户端断开连接处理"""
        self.heartbeat_timer.stop()
        logger.info(f"Client {self.client_id} disconnected")
        self.disconnected.emit(self.client_id)
    
    def on_error(self, socket_error):
        """处理socket错误"""
        logger.error(f"Socket error for {self.client_id}: {socket_error}")
        self.socket.disconnectFromHost()
    
    def close(self):
        """关闭客户端连接"""
        self.heartbeat_timer.stop()
        if self.socket.state() == QTcpSocket.SocketState.ConnectedState:
            # 发送关闭帧
            close_frame = b'\x88\x00'  # 关闭帧
            self.socket.write(close_frame)
            self.socket.disconnectFromHost()