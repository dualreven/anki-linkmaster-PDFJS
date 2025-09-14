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


def get_vite_port():
    r"""
    Docstring for gdef get_vite_port():
    从 logs\npm-dev.log 获取 port
    返回port值
    """     
    # 下面这个地址获取不正确
    app_path = os.path.dirname(__file__)
    backend_path = os.path.dirname(app_path)
    src_path = os.path.dirname(backend_path)
    src_path = os.path.dirname(src_path)
    log_file_path = os.path.join(src_path, 'logs', 'npm-dev.log')
    
    try:
        with open(log_file_path, 'r', encoding='utf-8') as f:
            content = f.read()  
        
        # 查找包含"Local:"的行
        lines = content.split('\n')
        for line in lines:
            if 'Local:' in line and 'localhost:' in line:
                # 提取端口号
                import re
                match = re.search(r'localhost:(\d+)', line)
                if match:
                    return int(match.group(1))
        
        # 如果没有找到，返回默认端口3000
        return 3000
    except FileNotFoundError:
        logger.warning(f"npm-dev.log文件未找到: {log_file_path}")
        return 3000
    except Exception as e:
        logger.error(f"读取npm-dev.log文件时出错: {str(e)}")
        return 3000


class AnkiLinkMasterApp:
    """主应用类"""
    
    def __init__(self):
        """初始化应用"""
        self.main_window = None
        self.websocket_server = None
        self.pdf_manager = None
    
    def run(self, module="pdf-viewer", vite_port=3000):
        """运行应用
        
        Args:
            module: 要加载的前端模块 (pdf-home 或 pdf-viewer)
            vite_port: Vite开发服务器端口
        """
        # 初始化PDF管理器
        self.pdf_manager = PDFManager()
        logger.info("PDF管理器初始化成功")
        
        # 初始化并启动WebSocket服务器
        self.websocket_server = WebSocketServer(host="127.0.0.1", port=8765)
        if self.websocket_server.start():
            logger.info("WebSocket服务器启动成功")
            # 设置WebSocket消息处理程序
            self.setup_websocket_handlers()
            
            # QtWebEngine优化：改为客户端连接时主动推送数据
            logger.info("WebSocket服务器启动成功，等待客户端连接...")
            # NEW: notify frontend to open pdf-viewer after backend ready
            try:
                from datetime import datetime, timezone
                ws = getattr(self, 'websocket_server', None) or getattr(self, 'ws_server', None)
                if ws:
                    payload = {"action": "open_pdf_viewer", "timestamp": datetime.now(timezone.utc).isoformat()}
                    try:
                        # 首选使用 broadcast_event（若实现存在）
                        if hasattr(ws, "broadcast_event"):
                            ws.broadcast_event("open_pdf_viewer", payload)
                        else:
                            # 回退到通用的 broadcast_message
                            ws.broadcast_message({"event": "open_pdf_viewer", "payload": payload})
                        from src.backend.logging.pdfjs_logger import get_pdfjs_logger
                        get_pdfjs_logger().info("Sent open_pdf_viewer event to frontend")
                    except Exception:
                        # 如果 broadcast_event 失败，尝试备用发送方式并记录
                        try:
                            ws.broadcast_message({"event": "open_pdf_viewer", "payload": payload})
                            from src.backend.logging.pdfjs_logger import get_pdfjs_logger
                            get_pdfjs_logger().info("Sent open_pdf_viewer (fallback) event to frontend via broadcast_message")
                        except Exception as inner_e:
                            import logging as _logging
                            _logging.getLogger("pdfjs_init").exception("Failed to send open_pdf_viewer via ws methods: %s", inner_e)
            except Exception as e:
                import logging as _logging
                _logging.getLogger("pdfjs_init").exception("Failed to notify frontend: %s", e)
            
        else:
            logger.error("WebSocket服务器启动失败")
        
        # 初始化主窗口
        self.main_window = MainWindow(self)
        self.main_window.send_debug_message_requested.connect(self.handle_send_debug_message)
        
        # 使用传入的端口或自动检测
        actual_vite_port = get_vite_port() if vite_port == 3000 else vite_port
        logger.info(f"Vite端口: {actual_vite_port}")
        logger.info(f"加载模块: {module}")
        
        # 加载前端页面，使用Vite配置的端口和正确的入口路径
        self.main_window.load_frontend(f"http://localhost:{actual_vite_port}/{module}/index.html")
        self.main_window.show()
    def handle_send_debug_message(self):
        """处理来自UI的发送调试消息的请求"""
        logger.info("[DEBUG] 收到来自菜单的广播请求。")
        self.websocket_server.broadcast_message({
            "type": "debug",
            "content": "你好，这是一个来自菜单的调试消息！"
        })
    def setup_websocket_handlers(self):
        """设置WebSocket消息处理程序"""
        if self.websocket_server:
            self.websocket_server.message_received.connect(self.handle_websocket_message)
            # QtWebEngine优化：监听客户端连接事件
            self.websocket_server.client_connected.connect(self.on_client_connected)
            logger.info("WebSocket消息处理程序设置成功")

    def handle_websocket_message(self, client, message):
        """处理WebSocket消息
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容（已解析为字典）
        """
        try:
            # 根据消息类型调用相应的处理函数
            message_type = message.get('type')
            if message_type == 'request_file_selection':
                self.handle_request_file_selection(client, message)
            elif message_type == 'add_pdf':
                # 保持向后兼容，但主要使用request_file_selection
                self.handle_add_pdf(client, message)
            elif message_type == 'get_pdf_list':
                self.handle_get_pdf_list(client, message)
            elif message_type == 'remove_pdf':
                self.handle_remove_pdf(client, message)
            elif message_type == 'batch_remove_pdf':
                self.handle_batch_remove_pdf(client, message)
            elif message_type == 'pdf_detail_request':
                self.handle_pdf_detail_request(client, message)
            elif message_type == 'pdfjs_init_log':
                self.handle_pdfjs_init_log(client, message)
            elif message_type == 'heartbeat':
                # 心跳消息，不需要处理，只是保持连接
                logger.debug(f"[DEBUG] 收到心跳消息 from {client.peerPort()}")
            else:
                logger.warning(f"未知的消息类型: {message_type}")
                self.send_error_response(client, f"未知的消息类型: {message_type}", message_type)
        except Exception as e:
            logger.error(f"处理WebSocket消息时出错: {str(e)}")
            self.send_error_response(client, f"处理消息时出错: {str(e)}", message.get('type'))
        
    def shutdown(self):
        """关闭应用"""
        # 停止WebSocket服务器
        if self.websocket_server:
            self.websocket_server.stop()
            logger.info("WebSocket服务器已停止")
            
        # 关闭主窗口
        if self.main_window:
            self.main_window.close()

    def send_response(self, client, data, original_message_id=None):
        """发送响应消息
        
        Args:
            client: QWebSocket客户端对象
            data: 响应数据
            original_message_id: 原始消息ID
        """
        response = {
            **data,
            'id': original_message_id
        }
        self.websocket_server.send_message(client, response)

    def send_success_response(self, client, original_type, result=None, original_message_id=None):
        """发送成功响应
        
        Args:
            client: QWebSocket客户端对象
            original_type: 原始消息类型
            result: 操作结果
            original_message_id: 原始消息ID
        """
        import time
        response_data = {
            'type': 'response',
            'timestamp': time.time(),
            'request_id': original_message_id,
            'status': 'success',
            'code': 200,
            'message': '操作成功',
            'data': result or {}
        }
        self.send_response(client, response_data, original_message_id)

    def send_error_response(self, client, error_message, original_type=None, error_code="SERVER_ERROR", original_message_id=None):
        """发送错误响应
        
        Args:
            client: QWebSocket客户端对象
            error_message: 错误消息
            original_type: 原始消息类型
            error_code: 错误码
            original_message_id: 原始消息ID
        """
        import time
        error_mapping = {
            "MISSING_PARAMETERS": 400,
            "INVALID_PARAMETER_FORMAT": 400,
            "FILE_NOT_FOUND": 404,
            "DIRECTORY_NOT_FOUND": 404,
            "PERMISSION_DENIED": 403,
            "REMOVE_FILE_FAILED": 422,
            "PARTIAL_SUCCESS": 207,
            "SERVER_ERROR": 500
        }
        
        response_data = {
            'type': 'response',
            'timestamp': time.time(),
            'request_id': original_message_id,
            'status': 'error',
            'code': error_mapping.get(error_code, 500),
            'message': error_message,
            'error': {
                'type': error_code.lower(),
                'message': error_message,
                'details': {}
            }
        }
        self.send_response(client, response_data, original_message_id)

    def on_client_connected(self, client):
        """QtWebEngine优化：处理新客户端连接
        
        Args:
            client: QWebSocket客户端对象
        """
        logger.info(f"[DEBUG] 新客户端连接: {client.peerAddress().toString()}:{client.peerPort()}")
        
        # QtWebEngine关键修复：延迟发送数据，确保客户端完全准备好
        def send_initial_data():
            try:
                logger.info(f"[DEBUG] 向客户端 {client.peerPort()} 发送初始数据")
                pdfs = self.pdf_manager.get_files()
                
                # 发送PDF列表给新连接的客户端
                self.websocket_server.send_message(client, {
                    'type': 'pdf_list_updated',
                    'data': {
                        'files': pdfs
                    }
                })
                logger.info(f"[DEBUG] 初始数据发送完成，包含 {len(pdfs)} 个文件")
            except Exception as e:
                logger.error(f"发送初始数据失败: {str(e)}")
        from PyQt6.QtCore import QTimer
        QTimer.singleShot(100, send_initial_data)


        
    def broadcast_pdf_list(self):
        """广播PDF文件列表更新"""
        try:
            import time
            pdfs = self.pdf_manager.get_files()
            logger.info(f"[DEBUG] 广播pdf_list消息，包含 {len(pdfs)} 个文件")
            if len(pdfs) > 0:
                logger.info(f"[DEBUG] 文件详情: {[p['filename'] for p in pdfs]}")
            
            # 检查客户端连接状态
            client_count = self.websocket_server.get_client_count()
            logger.info(f"[DEBUG] 当前连接的客户端数量: {client_count}")
            
            if client_count == 0:
                logger.warning("[DEBUG] 没有连接的客户端，跳过广播")
                return
            
            # 广播消息 - 符合JSON标准格式
            message = {
                'type': 'pdf_list',
                'timestamp': time.time(),
                'request_id': None,  # 广播消息没有request_id
                'status': 'success',
                'code': 200,
                'message': 'PDF列表更新',
                'data': {
                    'files': pdfs,
                    'pagination': {'total': len(pdfs)}
                }
            }
            
            self.websocket_server.broadcast_message(message)
            logger.info("[DEBUG] pdf_list消息广播完成")
        except Exception as e:
            logger.error(f"广播PDF列表时出错: {str(e)}")

    def handle_request_file_selection(self, client, message):
        """处理文件选择请求 - 在QT端弹出文件选择对话框

        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            from PyQt6.QtWidgets import QFileDialog, QApplication
            import sys
            
            # 确保有QApplication实例
            app = QApplication.instance()
            if app is None:
                app = QApplication(sys.argv)
            
            # 弹出文件选择对话框（允许多选）
            file_dialog = QFileDialog()
            file_dialog.setFileMode(QFileDialog.FileMode.ExistingFiles)
            file_dialog.setNameFilter("PDF Files (*.pdf)")
            file_dialog.setWindowTitle("选择PDF文件")
            
            # 设置默认目录
            default_dir = os.path.expanduser("~")
            if os.path.exists(default_dir):
                file_dialog.setDirectory(default_dir)
            
            if file_dialog.exec():
                selected_files = file_dialog.selectedFiles()
                
                if selected_files:
                    logger.info(f"用户选择了 {len(selected_files)} 个文件: {selected_files}")
                    
                    # 处理每个选中的文件
                    added_files = []
                    failed_files = []
                    
                    for file_path in selected_files:
                        try:
                            if os.path.exists(file_path) and file_path.lower().endswith('.pdf'):
                                file_info = self.pdf_manager.add_file(file_path)
                                if file_info:
                                    added_files.append(file_info)
                                    logger.info(f"成功添加文件: {file_path}")
                                else:
                                    failed_files.append({"path": file_path, "error": "添加失败"})
                                    logger.error(f"添加文件失败: {file_path}")
                            else:
                                failed_files.append({"path": file_path, "error": "文件不存在或格式不支持"})
                                logger.warning(f"文件不存在或格式不支持: {file_path}")
                        except Exception as e:
                            failed_files.append({"path": file_path, "error": str(e)})
                            logger.error(f"处理文件时出错: {file_path} - {str(e)}")
                    
                    # 发送符合标准的响应
                    response_data = {
                        "files": added_files,
                        "failed": failed_files,
                        "summary": {
                            "selected": len(selected_files),
                            "added": len(added_files),
                            "failed": len(failed_files)
                        }
                    }
                    
                    self.send_success_response(client, "files_selected", response_data, message.get('request_id'))
                    
                    # 如果有文件被成功添加，广播更新
                    if added_files:
                        self.broadcast_pdf_list()
                        
                else:
                    logger.info("用户取消文件选择")
                    response_data = {
                        "files": [],
                        "failed": [],
                        "summary": {"selected": 0, "added": 0, "failed": 0}
                    }
                    self.send_success_response(client, "files_selected", response_data, message.get('request_id'))
            else:
                logger.info("用户取消文件选择")
                response_data = {
                    "files": [],
                    "failed": [],
                    "summary": {"selected": 0, "added": 0, "failed": 0}
                }
                self.send_success_response(client, "files_selected", response_data, message.get('request_id'))
                
        except ImportError as e:
            logger.error(f"PyQt6导入失败: {str(e)}")
            self.send_error_response(
                client, 
                f"文件选择功能不可用: {str(e)}", 
                "request_file_selection", 
                "FEATURE_NOT_AVAILABLE", 
                message.get('request_id')
            )
        except Exception as e:
            logger.error(f"文件选择失败: {str(e)}")
            self.send_error_response(
                client, 
                f"文件选择失败: {str(e)}", 
                "request_file_selection", 
                "FILE_SELECTION_ERROR", 
                message.get('request_id')
            )

    def handle_add_pdf_with_path(self, client, file_info, message_id):
        """使用真实文件路径添加PDF文件

        Args:
            client: QWebSocket客户端对象
            file_info: 包含真实路径的文件信息
            message_id: 原始消息ID
        """
        try:
            filepath = file_info.get('path')
            filename = file_info.get('name')
            
            if not filepath or not filename:
                logger.warning("添加PDF文件请求缺少文件名或文件路径参数")
                expected_format = {
                    "type": "add_pdf",
                    "filename": "example.pdf",
                    "filepath": "/path/to/example.pdf",
                    "id": "可选的消息ID"
                }
                error_message = f"添加PDF文件请求缺少文件名或文件路径参数。正确格式: {json.dumps(expected_format, ensure_ascii=False)}"
                self.send_error_response(
                    client, 
                    error_message, 
                    "add_pdf", 
                    "MISSING_PARAMETERS", 
                    message_id
                )
                return
                
            logger.info(f"[DEBUG] 开始添加文件: {filepath}")
            
            # 验证文件ID生成一致性
            from pdf_manager.models import PDFFile
            file_id = PDFFile.generate_file_id(filepath)
            logger.info(f"[DEBUG] 生成的文件ID: {file_id}")
            
            # 检查是否已存在
            existing_files = self.pdf_manager.get_files()
            logger.info(f"[DEBUG] 当前文件数量: {len(existing_files)}")
            
            # 检查文件是否存在
            if not os.path.exists(filepath):
                self.send_error_response(
                    client, 
                    f"文件不存在: {filename}", 
                    "add_pdf", 
                    "FILE_NOT_FOUND", 
                    message_id
                )
                return
                
            # 调用PDF管理器添加真实文件
            result = self.pdf_manager.add_file(filepath)
            
            if result:
                logger.info(f"[DEBUG] 文件添加成功: {filepath}")
                logger.info(f"成功添加PDF文件: {filepath}")
                
                # 发送成功响应
                self.send_success_response(
                    client, 
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
                logger.info(f"[DEBUG] 文件添加失败，可能已存在: {filepath}")
                # 文件已存在或其他业务逻辑错误
                logger.warning(f"PDF文件已存在或添加失败: {filepath}")
                self.send_error_response(
                    client, 
                    f"文件已存在于列表中: {filename}", 
                    "add_pdf", 
                    "FILE_EXISTS", 
                    message_id
                )
                
        except PermissionError as e:
            logger.error(f"文件访问权限不足: {str(e)}")
            self.send_error_response(
                client, 
                f"文件访问权限不足: {filename}", 
                "add_pdf", 
                "PERMISSION_DENIED", 
                message_id
            )
        except Exception as e:
            logger.error(f"处理添加PDF文件时出错: {str(e)}")
            self.send_error_response(
                client, 
                f"处理添加PDF文件时出错: {filename}", 
                "add_pdf", 
                "INTERNAL_ERROR", 
                message_id
            )
    
    def handle_get_pdf_list(self, client, message):
        """处理获取PDF列表请求
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            pdfs = self.pdf_manager.get_files()
            response_data = {
                "files": pdfs,
                "pagination": {"total": len(pdfs)}
            }
            self.send_success_response(
                client, 
                "get_pdf_list", 
                response_data, 
                message.get('request_id')
            )
        except FileNotFoundError as e:
            logger.error(f"PDF文件目录未找到: {str(e)}")
            self.send_error_response(client, f"PDF文件目录未找到: {str(e)}", "get_pdf_list", "DIRECTORY_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"PDF文件目录访问权限不足: {str(e)}")
            self.send_error_response(client, f"PDF文件目录访问权限不足: {str(e)}", "get_pdf_list", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理获取PDF列表请求时出错: {str(e)}")
            self.send_error_response(client, f"处理获取PDF列表请求时出错: {str(e)}", "get_pdf_list", "INTERNAL_ERROR", message.get('request_id'))

    def handle_add_pdf(self, client, message):
        """处理添加PDF文件请求（向后兼容）
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            # 支持新的数据格式
            file_path = None
            if 'data' in message and isinstance(message['data'], dict):
                file_path = message['data'].get('file_path')
            else:
                file_path = message.get('file_path')
            
            if not file_path:
                logger.warning("添加PDF文件请求缺少文件路径参数")
                expected_format = {
                    "type": "add_pdf",
                    "request_id": "uuid",
                    "data": {"file_path": "/path/to/file.pdf"}
                }
                error_message = f"添加PDF文件请求缺少文件路径参数。正确格式: {json.dumps(expected_format, ensure_ascii=False)}"
                self.send_error_response(
                    client, 
                    error_message, 
                    "add_pdf", 
                    "MISSING_PARAMETERS", 
                    message.get('request_id')
                )
                return
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                logger.warning(f"要添加的文件不存在: {file_path}")
                self.send_error_response(client, f"文件不存在: {file_path}", "add_pdf", "FILE_NOT_FOUND", message.get('request_id'))
                return
            
            # 检查文件扩展名
            if not file_path.lower().endswith('.pdf'):
                logger.warning(f"文件格式不支持: {file_path}")
                self.send_error_response(client, f"文件格式不支持，仅支持PDF文件: {file_path}", "add_pdf", "INVALID_FILE_FORMAT", message.get('request_id'))
                return
            
            logger.info(f"开始添加PDF文件: {file_path}")
            
            # 调用PDF管理器添加文件
            file_info = self.pdf_manager.add_file(file_path)
            
            if file_info:
                logger.info(f"成功添加PDF文件: {file_path} -> ID: {file_info.get('id')}")
                # 发送成功响应 - 符合标准格式
                response_data = {
                    "file": file_info
                }
                self.send_success_response(client, "pdf_added", response_data, message.get('request_id'))
                # 广播PDF列表更新
                self.broadcast_pdf_list()
            else:
                logger.error(f"添加PDF文件失败: {file_path}")
                self.send_error_response(client, f"添加PDF文件失败: {file_path}", "add_pdf", "ADD_FILE_FAILED", message.get('request_id'))
                
        except ValueError as e:
            logger.error(f"添加PDF文件参数格式错误: {str(e)}")
            self.send_error_response(client, f"参数格式错误: {str(e)}", "add_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except FileNotFoundError as e:
            logger.error(f"要添加的文件未找到: {str(e)}")
            self.send_error_response(client, f"要添加的文件未找到: {str(e)}", "add_pdf", "FILE_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"文件添加权限不足: {str(e)}")
            self.send_error_response(client, f"文件添加权限不足: {str(e)}", "add_pdf", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理添加PDF文件请求时出错: {str(e)}")
            self.send_error_response(client, f"处理添加PDF文件请求时出错: {str(e)}", "add_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
    def handle_remove_pdf(self, client, message):
        """处理删除PDF文件请求
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            filename = message.get('data', {}).get('filename') or message.get('filename')
            
            if not filename:
                logger.warning("删除PDF文件请求缺少文件名参数")
                expected_format = {
                    "type": "remove_pdf",
                    "request_id": "uuid",
                    "data": {"filename": "example.pdf"}
                }
                error_message = f"删除PDF文件请求缺少文件名参数。正确格式: {json.dumps(expected_format, ensure_ascii=False)}"
                self.send_error_response(
                    client, 
                    error_message, 
                    "remove_pdf", 
                    "MISSING_PARAMETERS", 
                    message.get('request_id')
                )
                return
            
            # 根据filename查找对应的file_id
            files = self.pdf_manager.get_files()
            file_id = None
            
            for file_info in files:
                if file_info.get('filename') == filename:
                    file_id = file_info.get('id')
                    break
            
            if not file_id:
                logger.warning(f"未找到文件: {filename}")
                self.send_error_response(client, f"未找到文件: {filename}", "remove_pdf", "FILE_NOT_FOUND", message.get('request_id'))
                return
            
            logger.info(f"[DEBUG] 找到文件 {filename} 对应的ID: {file_id}")
            
            # 调用PDF管理器删除文件（使用file_id）
            result = self.pdf_manager.remove_file(file_id)
            
            if result:
                logger.info(f"成功删除PDF文件: {filename} (ID: {file_id})")
                # 发送成功响应 - 符合标准格式
                response_data = {
                    "file": {"id": file_id, "filename": filename},
                    "removed": True
                }
                self.send_success_response(client, "pdf_removed", response_data, message.get('request_id'))
                # 广播PDF列表更新
                self.broadcast_pdf_list()
            else:
                logger.error(f"删除PDF文件失败: {filename} (ID: {file_id})")
                self.send_error_response(client, f"删除PDF文件失败: {filename}", "remove_pdf", "REMOVE_FILE_FAILED", message.get('request_id'))
        except ValueError as e:
            logger.error(f"删除PDF文件参数格式错误: {str(e)}")
            self.send_error_response(client, f"参数格式错误: {str(e)}", "remove_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except FileNotFoundError as e:
            logger.error(f"要删除的文件未找到: {str(e)}")
            self.send_error_response(client, f"要删除的文件未找到: {str(e)}", "remove_pdf", "FILE_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"文件删除权限不足: {str(e)}")
            self.send_error_response(client, f"文件删除权限不足: {str(e)}", "remove_pdf", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理删除PDF文件请求时出错: {str(e)}")
            self.send_error_response(client, f"处理删除PDF文件请求时出错: {str(e)}", "remove_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
    def handle_batch_remove_pdf(self, client, message):
        """处理批量删除PDF文件请求
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            # 支持新的数据格式
            filenames = []
            if 'data' in message and isinstance(message['data'], dict):
                filenames = message['data'].get('filenames', [])
            else:
                filenames = message.get('filenames', [])
            
            if not filenames or not isinstance(filenames, list):
                logger.warning("批量删除PDF文件请求缺少文件名列表参数")
                expected_format = {
                    "type": "batch_remove_pdf",
                    "request_id": "uuid",
                    "data": {"filenames": ["file1.pdf", "file2.pdf"]}
                }
                error_message = f"批量删除PDF文件请求缺少文件名列表参数。正确格式: {json.dumps(expected_format, ensure_ascii=False)}"
                self.send_error_response(
                    client, 
                    error_message, 
                    "batch_remove_pdf", 
                    "MISSING_PARAMETERS", 
                    message.get('request_id')
                )
                return
            
            logger.info(f"开始批量删除 {len(filenames)} 个PDF文件: {filenames}")
            
            # 获取当前文件列表
            current_files = self.pdf_manager.get_files()
            current_filenames = {f.get('filename'): f.get('id') for f in current_files}
            
            success_count = 0
            failed_files = []
            removed_files = []
            
            for filename in filenames:
                if filename in current_filenames:
                    file_id = current_filenames[filename]
                    result = self.pdf_manager.remove_file(file_id)
                    if result:
                        success_count += 1
                        removed_files.append({"id": file_id, "filename": filename})
                        logger.info(f"成功删除文件: {filename} (ID: {file_id})")
                    else:
                        failed_files.append(filename)
                        logger.warning(f"删除文件失败: {filename} (ID: {file_id})")
                else:
                    failed_files.append(filename)
                    logger.warning(f"未找到文件: {filename}")
            
            # 构建符合标准的响应数据
            response_data = {
                "removed": removed_files,
                "failed": failed_files,
                "summary": {
                    "total": len(filenames),
                    "success": success_count,
                    "failed": len(failed_files)
                }
            }
            
            logger.info(f"批量删除完成: 成功 {success_count}/{len(filenames)}, 失败 {len(failed_files)}")
            
            # 发送响应
            self.send_success_response(client, "batch_pdf_removed", response_data, message.get('request_id'))
            
            # 如果成功删除了文件，广播更新
            if success_count > 0:
                self.broadcast_pdf_list()
                
        except ValueError as e:
            logger.error(f"批量删除PDF文件参数格式错误: {str(e)}")
            self.send_error_response(client, f"参数格式错误: {str(e)}", "batch_remove_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理批量删除PDF文件请求时出错: {str(e)}")
            self.send_error_response(client, f"处理批量删除PDF文件请求时出错: {str(e)}", "batch_remove_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
    def handle_pdf_detail_request(self, client, message):
        """处理PDF详情请求
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            # 获取文件标识符
            file_id = message.get('data', {}).get('file_id') or message.get('file_id')
            
            if not file_id:
                logger.warning("PDF详情请求缺少文件ID参数")
                expected_format = {
                    "type": "pdf_detail_request",
                    "request_id": "uuid",
                    "data": {"file_id": "file_unique_id"}
                }
                error_message = f"PDF详情请求缺少文件ID参数。正确格式: {json.dumps(expected_format, ensure_ascii=False)}"
                self.send_error_response(
                    client,
                    error_message,
                    "pdf_detail_request",
                    "MISSING_PARAMETERS",
                    message.get('request_id')
                )
                return
            
            logger.info(f"处理PDF详情请求，文件ID: {file_id}")
            
            # 获取文件详情
            file_detail = self.pdf_manager.get_file_detail(file_id)
            
            if not file_detail:
                logger.warning(f"未找到文件: {file_id}")
                self.send_error_response(
                    client,
                    f"未找到文件: {file_id}",
                    "pdf_detail_request",
                    "FILE_NOT_FOUND",
                    message.get('request_id')
                )
                return
            
            # 发送成功响应
            self.send_success_response(
                client,
                "pdf_detail_request",
                file_detail,
                message.get('request_id')
            )
            logger.info(f"PDF详情响应发送成功，文件ID: {file_id}")
            
        except ValueError as e:
            logger.error(f"PDF详情请求参数格式错误: {str(e)}")
            self.send_error_response(
                client,
                f"参数格式错误: {str(e)}",
                "pdf_detail_request",
                "INVALID_PARAMETER_FORMAT",
                message.get('request_id')
            )
        except Exception as e:
            logger.error(f"处理PDF详情请求时出错: {str(e)}")
            self.send_error_response(
                client,
                f"处理PDF详情请求时出错: {str(e)}",
                "pdf_detail_request",
                "INTERNAL_ERROR",
                message.get('request_id')
            )

    def handle_pdfjs_init_log(self, client, message):
        """处理PDF.js初始化日志消息
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
            from src.backend.logging.pdfjs_logger import get_pdfjs_logger
            logger = get_pdfjs_logger()
            
            data = message.get('data', {})
            log_message = f"JS PDF.js Init: {data.get('message', 'Init log received')}"
            logger.info(log_message)
            
            # Log detailed data
            if data.get('version'):
                logger.info(f"PDF.js Version: {data['version']}")
            if data.get('build'):
                logger.info(f"PDF.js Build: {data['build']}")
            if data.get('webglState'):
                logger.info(f"WebGL State: {data['webglState']}")
            if data.get('timestamp'):
                logger.info(f"Timestamp: {data['timestamp']}")
            
            logger.info(f"Loaded: {data.get('loaded', False)}")
            
            # Send acknowledgment back to JS
            self.send_success_response(client, "pdfjs_init_log_ack", {
                "received": True,
                "timestamp": time.time()
            }, message.get('request_id'))
            
            logger.info("PDF.js init log processed and acknowledged")
            
        except Exception as e:
            logger.error(f"处理PDF.js init log时出错: {str(e)}")
            self.send_error_response(client, f"处理PDF.js init log出错: {str(e)}", "pdfjs_init_log", "INTERNAL_ERROR", message.get('request_id'))