"""
标准WebSocket服务器 - 基于JSON通信标准
"""
import logging
import json
import time
from typing import Dict, Any, Optional
from PyQt6.QtCore import QObject, pyqtSignal, pyqtSlot
from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
from PyQt6.QtNetwork import QHostAddress, QAbstractSocket

from .standard_protocol import StandardMessageHandler, PDFMessageBuilder, MessageType
from ..pdf_manager.manager import PDFManager

logger = logging.getLogger(__name__)

class StandardWebSocketServer(QObject):
    """标准WebSocket服务器 - 支持JSON通信标准"""
    
    # 定义信号
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    message_received = pyqtSignal(QWebSocket, dict)
    
    def __init__(self, host="127.0.0.1", port=8765):
        super().__init__()
        self.host = host
        self.port = port
        self.server = QWebSocketServer("Anki LinkMaster Standard Server", QWebSocketServer.SslMode.NonSecureMode)
        
        # 客户端列表
        self.clients = []
        self.running = False
        
        # PDF管理器
        self.pdf_manager = PDFManager()
        
        # 连接信号
        self.server.newConnection.connect(self.on_new_connection)
        
        # 连接PDF管理器信号
        self.pdf_manager.file_added.connect(self.on_pdf_file_added)
        self.pdf_manager.file_removed.connect(self.on_pdf_file_removed)
        self.pdf_manager.file_list_changed.connect(self.on_pdf_list_changed)
        
    def start(self):
        """启动服务器"""
        if self.running:
            logger.warning("WebSocket服务器已在运行")
            return False
        
        if self.server.listen(QHostAddress.SpecialAddress.LocalHost, self.port):
            self.running = True
            logger.info(f"标准WebSocket服务器启动成功: ws://{self.host}:{self.port}")
            return True
        else:
            logger.error(f"标准WebSocket服务器启动失败: {self.server.errorString()}")
            return False
            
    def stop(self):
        """停止服务器"""
        if not self.running:
            return
        
        self.server.close()
        for client in self.clients:
            client.close()
        self.clients.clear()
        self.running = False
        logger.info("标准WebSocket服务器已停止")
        
    @pyqtSlot()
    def on_new_connection(self):
        """处理新客户端连接"""
        socket = self.server.nextPendingConnection()
        if not socket:
            logger.error("获取新连接失败")
            return
        
        logger.info(f"新客户端连接: {socket.peerAddress().toString()}:{socket.peerPort()}")
        
        # 连接信号
        socket.textMessageReceived.connect(self.on_message_received)
        socket.disconnected.connect(self.on_client_disconnected)
        socket.errorOccurred.connect(self.on_socket_error)
        
        self.clients.append(socket)
        self.client_connected.emit(socket)
        
        # 发送欢迎消息
        welcome_msg = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS.value,
            data={
                "status": "connected",
                "server_version": "1.0.0",
                "client_count": len(self.clients)
            }
        )
        self.send_message(socket, welcome_msg)
        
    @pyqtSlot(str)
    def on_message_received(self, message):
        """处理收到的消息"""
        client_socket = self.sender()
        logger.info(f"收到消息: {message[:200]}...")
        
        # 解析消息
        parsed_message, error = StandardMessageHandler.parse_message(message)
        if error:
            logger.error(f"消息解析错误: {error}")
            error_response = StandardMessageHandler.build_error_response(
                "unknown",
                "INVALID_MESSAGE",
                f"消息格式错误: {error}"
            )
            self.send_message(client_socket, error_response)
            return
        
        # 处理消息
        try:
            response = self.handle_message(parsed_message)
            if response:
                self.send_message(client_socket, response)
            
            # 发出原始消息信号
            self.message_received.emit(client_socket, parsed_message)
            
        except Exception as e:
            logger.error(f"处理消息时出错: {e}")
            request_id = parsed_message.get("request_id", "unknown")
            error_response = StandardMessageHandler.build_error_response(
                request_id,
                "PROCESSING_ERROR",
                str(e)
            )
            self.send_message(client_socket, error_response)
            
    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理具体消息"""
        message_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})
        
        logger.info(f"处理消息类型: {message_type}, 请求ID: {request_id}")
        
        # PDF列表请求
        if message_type == "get_pdf_list":
            return self.handle_pdf_list_request(request_id, data)
        
        # PDF上传请求
        elif message_type == "add_pdf":
            return self.handle_pdf_upload_request(request_id, data)
        
        # PDF删除请求
        elif message_type == "remove_pdf":
            return self.handle_pdf_remove_request(request_id, data)
        
        # PDF批量删除请求
        elif message_type == "batch_remove_pdf":
            return self.handle_batch_pdf_remove_request(request_id, data)
        
        # PDF详情请求
        elif message_type == "pdf_detail_request":
            return self.handle_pdf_detail_request(request_id, data)
        
        # 心跳消息
        elif message_type == "heartbeat":
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message="心跳响应",
                data={"timestamp": int(time.time())}
            )
        
        else:
            return StandardMessageHandler.build_error_response(
                request_id,
                "unknown_message_type",
                f"未知的消息类型: {message_type}",
                code=400
            )
    
    def handle_pdf_list_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF列表请求"""
        try:
            files = self.pdf_manager.get_files()
            return PDFMessageBuilder.build_pdf_list_response(request_id, files)
        except Exception as e:
            logger.error(f"获取PDF列表失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "PDF_LIST_ERROR",
                f"获取PDF列表失败: {str(e)}"
            )
    
    def handle_pdf_upload_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF上传请求"""
        try:
            filepath = data.get("filepath")
            if not filepath:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的filepath参数"
                )
            
            success = self.pdf_manager.add_file(filepath)
            if success:
                # 获取刚添加的文件信息
                file_id = None
                filename = None
                file_size = 0
                
                files = self.pdf_manager.get_files()
                for file_info in files:
                    if "original_path" in file_info and file_info["original_path"] == filepath:
                        file_id = file_info["id"]
                        filename = file_info["filename"]
                        file_size = file_info.get("size", 0)
                        break
                
                return PDFMessageBuilder.build_pdf_upload_response(
                    request_id,
                    file_id or "unknown",
                    filename or os.path.basename(filepath),
                    file_size
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "UPLOAD_FAILED",
                    "PDF文件上传失败"
                )
                
        except Exception as e:
            logger.error(f"上传PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "UPLOAD_ERROR",
                f"上传PDF失败: {str(e)}"
            )
    
    def handle_pdf_remove_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF删除请求"""
        try:
            file_id = data.get("file_id")
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            success = self.pdf_manager.remove_file(file_id)
            if success:
                return PDFMessageBuilder.build_pdf_remove_response(request_id, file_id)
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "REMOVE_FAILED",
                    "PDF文件删除失败"
                )
                
        except Exception as e:
            logger.error(f"删除PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "REMOVE_ERROR",
                f"删除PDF失败: {str(e)}"
            )
    
    def handle_batch_pdf_remove_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF批量删除请求"""
        try:
            file_ids = data.get("file_ids")
            if not file_ids or not isinstance(file_ids, list):
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_ids参数或参数类型错误"
                )
            
            # 调用PDF管理器的批量删除方法
            result = self.pdf_manager.batch_remove_files(file_ids)
            success = result.get("success", False)
            if success:
                return PDFMessageBuilder.build_batch_pdf_remove_response(
                    request_id,
                    result["removed_files"],
                    result.get("failed_files")
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "BATCH_REMOVE_FAILED",
                    result.get("message", "PDF文件批量删除失败")
                )
                
        except Exception as e:
            logger.error(f"批量删除PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "BATCH_REMOVE_ERROR",
                f"批量删除PDF失败: {str(e)}"
            )
    
    def handle_pdf_detail_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF详情请求"""
        try:
            file_id = data.get("file_id")
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            file_detail = self.pdf_manager.get_file_detail(file_id)
            if file_detail:
                return PDFMessageBuilder.build_pdf_detail_response(request_id, file_detail)
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "FILE_NOT_FOUND",
                    f"找不到ID为{file_id}的PDF文件"
                )
                
        except Exception as e:
            logger.error(f"获取PDF详情失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "DETAIL_ERROR",
                f"获取PDF详情失败: {str(e)}"
            )
    
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
    
    # PDF管理器事件处理
    def on_pdf_file_added(self, file_info: Dict[str, Any]):
        """处理PDF文件添加事件"""
        logger.info(f"PDF文件添加事件: {file_info}")
        # 可以广播给所有客户端
        message = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS,
            data={
                "event": "file_added",
                "file_info": file_info,
                "file_count": self.pdf_manager.get_file_count()
            }
        )
        self.broadcast_message(message)
    
    def on_pdf_file_removed(self, file_id: str):
        """处理PDF文件删除事件"""
        logger.info(f"PDF文件删除事件: {file_id}")
        message = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS,
            data={
                "event": "file_removed",
                "file_id": file_id,
                "file_count": self.pdf_manager.get_file_count()
            }
        )
        self.broadcast_message(message)
    
    def on_pdf_list_changed(self):
        """处理PDF列表变更事件"""
        logger.info("PDF列表变更事件")
        # 可以触发列表更新广播
    
    def send_message(self, client: QWebSocket, message: Dict[str, Any]) -> bool:
        """发送消息给指定客户端"""
        try:
            json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
            
            if client.state() == QAbstractSocket.SocketState.ConnectedState:
                client.sendTextMessage(json_message)
                logger.info(f"向客户端 {client.peerPort()} 发送消息: {message.get('type')}")
                return True
            else:
                logger.warning(f"客户端 {client.peerPort()} 未连接，无法发送消息")
                return False
                
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return False
    
    def broadcast_message(self, message: Dict[str, Any]):
        """广播消息给所有客户端"""
        if not isinstance(message, dict):
            return
        
        json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
        
        valid_clients = []
        sent_count = 0
        
        for client in self.clients:
            if client.state() == QAbstractSocket.SocketState.ConnectedState:
                try:
                    client.sendTextMessage(json_message)
                    valid_clients.append(client)
                    sent_count += 1
                except Exception as e:
                    logger.error(f"广播消息失败: {e}")
            else:
                logger.warning(f"客户端已断开，从列表中移除")
        
        self.clients = valid_clients
        logger.info(f"广播消息完成：成功发送给 {sent_count}/{len(self.clients)} 个客户端")
    
    def get_client_count(self):
        """获取当前连接的客户端数量"""
        return len(self.clients)
    
    def get_client_ids(self):
        """获取所有客户端ID列表"""
        return [f"client_{i}" for i in range(len(self.clients))]