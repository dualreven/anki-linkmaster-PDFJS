"""
Anki LinkMaster PDFJS 主应用类
负责管理整个应用程序的生命周期
"""

from PyQt6.QtWidgets import QApplication
from ui.main_window import MainWindow
from websocket.server import WebSocketServer
from pdf_manager.manager import PDFManager
import logging
import json
import os

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnkiLinkMasterApp:
    """主应用类"""
    
    def __init__(self):
        """初始化应用"""
        self.main_window = None
        self.websocket_server = None
        self.pdf_manager = None
    
    def run(self):
        """运行应用"""
        # 初始化PDF管理器
        self.pdf_manager = PDFManager()
        logger.info("PDF管理器初始化成功")
        
        # 初始化并启动WebSocket服务器
        self.websocket_server = WebSocketServer(host="127.0.0.1", port=8765)
        if self.websocket_server.start():
            logger.info("WebSocket服务器启动成功")
            # 设置WebSocket消息处理程序
            self.setup_websocket_handlers()
        else:
            logger.error("WebSocket服务器启动失败")
        
        # 初始化主窗口
        self.main_window = MainWindow()
        # 加载前端页面，使用Vite配置的端口和正确的入口路径
        self.main_window.load_frontend("http://localhost:3001/pdf-home/index.html")
        self.main_window.show()

    def setup_websocket_handlers(self):
        """设置WebSocket消息处理程序"""
        if self.websocket_server:
            self.websocket_server.message_received.connect(self.handle_websocket_message)
            logger.info("WebSocket消息处理程序设置成功")

    def handle_websocket_message(self, client_id, message):
        """处理WebSocket消息
        
        Args:
            client_id: 客户端ID
            message: 消息内容（已解析为字典）
        """
        try:
            # 根据消息类型调用相应的处理函数
            message_type = message.get('type')
            if message_type == 'request_file_selection':
                self.handle_request_file_selection(client_id, message)
            elif message_type == 'add_pdf':
                # 保持向后兼容，但主要使用request_file_selection
                self.handle_add_pdf(client_id, message)
            elif message_type == 'get_pdf_list':
                self.handle_get_pdf_list(client_id, message)
            elif message_type == 'remove_pdf':
                self.handle_remove_pdf(client_id, message)
            else:
                logger.warning(f"未知的消息类型: {message_type}")
                self.send_error_response(client_id, f"未知的消息类型: {message_type}", message_type)
        except Exception as e:
            logger.error(f"处理WebSocket消息时出错: {str(e)}")
            self.send_error_response(client_id, f"处理消息时出错: {str(e)}", message.get('type'))
        
    def shutdown(self):
        """关闭应用"""
        # 停止WebSocket服务器
        if self.websocket_server:
            self.websocket_server.stop()
            logger.info("WebSocket服务器已停止")
            
        # 关闭主窗口
        if self.main_window:
            self.main_window.close()

    def send_response(self, client_id, data, original_message_id=None):
        """发送响应消息
        
        Args:
            client_id: 客户端ID
            data: 响应数据
            original_message_id: 原始消息ID
        """
        response = {
            **data,
            'id': original_message_id
        }
        self.websocket_server.send_message(client_id, response)

    def send_success_response(self, client_id, original_type, result=None, original_message_id=None):
        """发送成功响应
        
        Args:
            client_id: 客户端ID
            original_type: 原始消息类型
            result: 操作结果
            original_message_id: 原始消息ID
        """
        response_data = {
            'type': 'success',
            'data': {
                'original_type': original_type,
                'result': result or {}
            }
        }
        self.send_response(client_id, response_data, original_message_id)

    def send_error_response(self, client_id, error_message, original_type=None, error_code="SERVER_ERROR", original_message_id=None):
        """发送错误响应
        
        Args:
            client_id: 客户端ID
            error_message: 错误消息
            original_type: 原始消息类型
            error_code: 错误码
            original_message_id: 原始消息ID
        """
        response_data = {
            'type': 'error',
            'data': {
                'original_type': original_type,
                'code': error_code,
                'message': error_message
            }
        }
        self.send_response(client_id, response_data, original_message_id)

    def broadcast_pdf_list(self):
        """广播PDF文件列表更新"""
        try:
            pdfs = self.pdf_manager.get_files()
            self.websocket_server.broadcast_message({
                'type': 'pdf_list_updated',
                'data': {
                    'files': pdfs
                }
            })
        except Exception as e:
            logger.error(f"广播PDF列表时出错: {str(e)}")

    def handle_request_file_selection(self, client_id, message):
        """处理文件选择请求 - 在QT端弹出文件选择对话框

        Args:
            client_id: 客户端ID
            message: 消息内容
        """
        try:
            from PyQt6.QtWidgets import QFileDialog, QApplication
            import sys
            
            # 确保有QApplication实例
            app = QApplication.instance()
            if app is None:
                app = QApplication(sys.argv)
            
            # 弹出文件选择对话框
            filepath, _ = QFileDialog.getOpenFileName(
                None,
                "选择PDF文件",
                "",
                "PDF Files (*.pdf);;All Files (*)"
            )
            
            if filepath:
                # 获取文件信息
                import os
                file_info = {
                    'name': os.path.basename(filepath),
                    'size': os.path.getsize(filepath),
                    'path': filepath  # 传递真实路径
                }
                
                # 直接处理文件添加
                self.handle_add_pdf_with_path(client_id, file_info, message.get('id'))
            else:
                # 用户取消选择
                self.send_error_response(
                    client_id, 
                    "用户取消了文件选择", 
                    "request_file_selection", 
                    "USER_CANCELLED", 
                    message.get('id')
                )
                
        except ImportError as e:
            logger.error(f"PyQt6导入失败: {str(e)}")
            self.send_error_response(
                client_id, 
                "文件选择功能不可用: " + str(e), 
                "request_file_selection", 
                "QT_NOT_AVAILABLE", 
                message.get('id')
            )
        except Exception as e:
            logger.error(f"文件选择失败: {str(e)}")
            self.send_error_response(
                client_id, 
                f"文件选择失败: {str(e)}", 
                "request_file_selection", 
                "FILE_SELECTION_ERROR", 
                message.get('id')
            )

    def handle_add_pdf_with_path(self, client_id, file_info, message_id):
        """使用真实文件路径添加PDF文件

        Args:
            client_id: 客户端ID
            file_info: 包含真实路径的文件信息
            message_id: 原始消息ID
        """
        try:
            filepath = file_info.get('path')
            filename = file_info.get('name')
            
            if not filepath:
                self.send_error_response(
                    client_id, 
                    "文件路径无效", 
                    "add_pdf", 
                    "INVALID_FILE_PATH", 
                    message_id
                )
                return
                
            # 检查文件是否存在
            if not os.path.exists(filepath):
                self.send_error_response(
                    client_id, 
                    f"文件不存在: {filename}", 
                    "add_pdf", 
                    "FILE_NOT_FOUND", 
                    message_id
                )
                return
                
            # 调用PDF管理器添加真实文件
            result = self.pdf_manager.add_file(filepath)
            
            if result:
                logger.info(f"成功添加PDF文件: {filepath}")
                
                # 发送成功响应
                self.send_success_response(
                    client_id, 
                    "add_pdf", 
                    {
                        "success": True,
                        "filename": filename,
                        "filepath": filepath
                    }, 
                    message_id
                )
                
                # 广播PDF列表更新
                self.broadcast_pdf_list()
            else:
                # 文件已存在或其他业务逻辑错误
                logger.warning(f"PDF文件已存在或添加失败: {filepath}")
                self.send_error_response(
                    client_id, 
                    f"文件已存在于列表中: {filename}", 
                    "add_pdf", 
                    "FILE_EXISTS", 
                    message_id
                )
                
        except PermissionError as e:
            logger.error(f"文件访问权限不足: {str(e)}")
            self.send_error_response(
                client_id, 
                f"文件访问权限不足: {filename}", 
                "add_pdf", 
                "PERMISSION_DENIED", 
                message_id
            )
        except Exception as e:
            logger.error(f"处理添加PDF文件时出错: {str(e)}")
            self.send_error_response(
                client_id, 
                f"处理添加PDF文件时出错: {filename}", 
                "add_pdf", 
                "INTERNAL_ERROR", 
                message_id
            )
    
    def handle_get_pdf_list(self, client_id, message):
        """处理获取PDF列表请求
        
        Args:
            client_id: 客户端ID
            message: 消息内容
        """
        try:
            pdfs = self.pdf_manager.get_files()
            self.send_success_response(
                client_id, 
                "get_pdf_list", 
                {"files": pdfs}, 
                message.get('id')
            )
        except FileNotFoundError as e:
            logger.error(f"PDF文件目录未找到: {str(e)}")
            self.send_error_response(client_id, f"PDF文件目录未找到: {str(e)}", "get_pdf_list", "DIRECTORY_NOT_FOUND", message.get('id'))
        except PermissionError as e:
            logger.error(f"PDF文件目录访问权限不足: {str(e)}")
            self.send_error_response(client_id, f"PDF文件目录访问权限不足: {str(e)}", "get_pdf_list", "PERMISSION_DENIED", message.get('id'))
        except Exception as e:
            logger.error(f"处理获取PDF列表请求时出错: {str(e)}")
            self.send_error_response(client_id, f"处理获取PDF列表请求时出错: {str(e)}", "get_pdf_list", "INTERNAL_ERROR", message.get('id'))

    def handle_remove_pdf(self, client_id, message):
        """处理删除PDF文件请求
        
        Args:
            client_id: 客户端ID
            message: 消息内容
        """
        try:
            filename = message.get('filename')
            
            if not filename:
                logger.warning("删除PDF文件请求缺少文件名参数")
                self.send_error_response(client_id, "删除PDF文件请求缺少文件名参数", "remove_pdf", "MISSING_PARAMETERS", message.get('id'))
                return
            
            # 调用PDF管理器删除文件
            result = self.pdf_manager.remove_file(filename)
            
            if result:
                logger.info(f"成功删除PDF文件: {filename}")
                # 发送成功响应
                self.send_success_response(client_id, "remove_pdf", {"success": True, "filename": filename}, message.get('id'))
                # 广播PDF列表更新
                self.broadcast_pdf_list()
            else:
                logger.error(f"删除PDF文件失败: {filename}")
                self.send_error_response(client_id, f"删除PDF文件失败: {filename}", "remove_pdf", "REMOVE_FILE_FAILED", message.get('id'))
        except ValueError as e:
            logger.error(f"删除PDF文件参数格式错误: {str(e)}")
            self.send_error_response(client_id, f"参数格式错误: {str(e)}", "remove_pdf", "INVALID_PARAMETER_FORMAT", message.get('id'))
        except FileNotFoundError as e:
            logger.error(f"要删除的文件未找到: {str(e)}")
            self.send_error_response(client_id, f"要删除的文件未找到: {str(e)}", "remove_pdf", "FILE_NOT_FOUND", message.get('id'))
        except PermissionError as e:
            logger.error(f"文件删除权限不足: {str(e)}")
            self.send_error_response(client_id, f"文件删除权限不足: {str(e)}", "remove_pdf", "PERMISSION_DENIED", message.get('id'))
        except Exception as e:
            logger.error(f"处理删除PDF文件请求时出错: {str(e)}")
            self.send_error_response(client_id, f"处理删除PDF文件请求时出错: {str(e)}", "remove_pdf", "INTERNAL_ERROR", message.get('id'))