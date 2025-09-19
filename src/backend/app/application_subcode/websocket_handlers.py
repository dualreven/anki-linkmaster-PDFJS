"""
Anki LinkMaster PDFJS - WebSocket消息处理器
包含处理各种WebSocket消息的方法
"""

import os
import json
import logging
from src.backend.qt.compat import QFileDialog, QApplication, QTimer
import sys

# 配置日志
logger = logging.getLogger(__name__)


class WebSocketHandlers:
    """WebSocket消息处理器类"""
    
    def __init__(self, app_instance, response_handlers):
        """初始化消息处理器
        
        Args:
            app_instance: 主应用实例
            response_handlers: 响应处理器实例
        """
        self.app = app_instance
        self.response = response_handlers
        self.pdf_manager = app_instance.pdf_manager
        self.websocket_server = app_instance.websocket_server

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
                self.response.send_error_response(client, f"未知的消息类型: {message_type}", message_type)
        except Exception as e:
            logger.error(f"处理WebSocket消息时出错: {str(e)}")
            self.response.send_error_response(client, f"处理消息时出错: {str(e)}", message.get('type'))

    def handle_request_file_selection(self, client, message):
        """处理文件选择请求 - 在QT端弹出文件选择对话框
        
        Args:
            client: QWebSocket客户端对象
            message: 消息内容
        """
        try:
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
                    
                    self.response.send_success_response(client, "files_selected", response_data, message.get('request_id'))
                    
                    # 如果有文件被成功添加，广播更新
                    if added_files:
                        self.app.broadcast_pdf_list()
                        
                else:
                    logger.info("用户取消文件选择")
                    response_data = {
                        "files": [],
                        "failed": [],
                        "summary": {"selected": 0, "added": 0, "failed": 0}
                    }
                    self.response.send_success_response(client, "files_selected", response_data, message.get('request_id'))
            else:
                logger.info("用户取消文件选择")
                response_data = {
                    "files": [],
                    "failed": [],
                    "summary": {"selected": 0, "added": 0, "failed": 0}
                }
                self.response.send_success_response(client, "files_selected", response_data, message.get('request_id'))
                
        except ImportError as e:
            logger.error(f"PyQt6导入失败: {str(e)}")
            self.response.send_error_response(
                client, 
                f"文件选择功能不可用: {str(e)}", 
                "request_file_selection", 
                "FEATURE_NOT_AVAILABLE", 
                message.get('request_id')
            )
        except Exception as e:
            logger.error(f"文件选择失败: {str(e)}")
            self.response.send_error_response(
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
                self.response.send_error_response(
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
                self.response.send_error_response(
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
                self.response.send_success_response(
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
                self.app.broadcast_pdf_list()
            else:
                logger.info(f"[DEBUG] 文件添加失败，可能已存在: {filepath}")
                # 文件已存在或其他业务逻辑错误
                logger.warning(f"PDF文件已存在或添加失败: {filepath}")
                self.response.send_error_response(
                    client, 
                    f"文件已存在于列表中: {filename}", 
                    "add_pdf", 
                    "FILE_EXISTS", 
                    message_id
                )
                
        except PermissionError as e:
            logger.error(f"文件访问权限不足: {str(e)}")
            self.response.send_error_response(
                client, 
                f"文件访问权限不足: {filename}", 
                "add_pdf", 
                "PERMISSION_DENIED", 
                message_id
            )
        except Exception as e:
            logger.error(f"处理添加PDF文件时出错: {str(e)}")
            self.response.send_error_response(
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
            self.response.send_success_response(
                client, 
                "get_pdf_list", 
                response_data, 
                message.get('request_id')
            )
        except FileNotFoundError as e:
            logger.error(f"PDF文件目录未找到: {str(e)}")
            self.response.send_error_response(client, f"PDF文件目录未找到: {str(e)}", "get_pdf_list", "DIRECTORY_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"PDF文件目录访问权限不足: {str(e)}")
            self.response.send_error_response(client, f"PDF文件目录访问权限不足: {str(e)}", "get_pdf_list", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理获取PDF列表请求时出错: {str(e)}")
            self.response.send_error_response(client, f"处理获取PDF列表请求时出错: {str(e)}", "get_pdf_list", "INTERNAL_ERROR", message.get('request_id'))

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
                self.response.send_error_response(
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
                self.response.send_error_response(client, f"文件不存在: {file_path}", "add_pdf", "FILE_NOT_FOUND", message.get('request_id'))
                return
            
            # 检查文件扩展名
            if not file_path.lower().endswith('.pdf'):
                logger.warning(f"文件格式不支持: {file_path}")
                self.response.send_error_response(client, f"文件格式不支持，仅支持PDF文件: {file_path}", "add_pdf", "INVALID_FILE_FORMAT", message.get('request_id'))
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
                self.response.send_success_response(client, "pdf_added", response_data, message.get('request_id'))
                # 广播PDF列表更新
                self.app.broadcast_pdf_list()
            else:
                logger.error(f"添加PDF文件失败: {file_path}")
                self.response.send_error_response(client, f"添加PDF文件失败: {file_path}", "add_pdf", "ADD_FILE_FAILED", message.get('request_id'))
                
        except ValueError as e:
            logger.error(f"添加PDF文件参数格式错误: {str(e)}")
            self.response.send_error_response(client, f"参数格式错误: {str(e)}", "add_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except FileNotFoundError as e:
            logger.error(f"要添加的文件未找到: {str(e)}")
            self.response.send_error_response(client, f"要添加的文件未找到: {str(e)}", "add_pdf", "FILE_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"文件添加权限不足: {str(e)}")
            self.response.send_error_response(client, f"文件添加权限不足: {str(e)}", "add_pdf", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理添加PDF文件请求时出错: {str(e)}")
            self.response.send_error_response(client, f"处理添加PDF文件请求时出错: {str(e)}", "add_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
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
                self.response.send_error_response(
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
                self.response.send_error_response(client, f"未找到文件: {filename}", "remove_pdf", "FILE_NOT_FOUND", message.get('request_id'))
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
                self.response.send_success_response(client, "pdf_removed", response_data, message.get('request_id'))
                # 广播PDF列表更新
                self.app.broadcast_pdf_list()
            else:
                logger.error(f"删除PDF文件失败: {filename} (ID: {file_id})")
                self.response.send_error_response(client, f"删除PDF文件失败: {filename}", "remove_pdf", "REMOVE_FILE_FAILED", message.get('request_id'))
        except ValueError as e:
            logger.error(f"删除PDF文件参数格式错误: {str(e)}")
            self.response.send_error_response(client, f"参数格式错误: {str(e)}", "remove_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except FileNotFoundError as e:
            logger.error(f"要删除的文件未找到: {str(e)}")
            self.response.send_error_response(client, f"要删除的文件未找到: {str(e)}", "remove_pdf", "FILE_NOT_FOUND", message.get('request_id'))
        except PermissionError as e:
            logger.error(f"文件删除权限不足: {str(e)}")
            self.response.send_error_response(client, f"文件删除权限不足: {str(e)}", "remove_pdf", "PERMISSION_DENIED", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理删除PDF文件请求时出错: {str(e)}")
            self.response.send_error_response(client, f"处理删除PDF文件请求时出错: {str(e)}", "remove_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
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
                self.response.send_error_response(
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
            self.response.send_success_response(client, "batch_pdf_removed", response_data, message.get('request_id'))
            
            # 如果成功删除了文件，广播更新
            if success_count > 0:
                self.app.broadcast_pdf_list()
                
        except ValueError as e:
            logger.error(f"批量删除PDF文件参数格式错误: {str(e)}")
            self.response.send_error_response(client, f"参数格式错误: {str(e)}", "batch_remove_pdf", "INVALID_PARAMETER_FORMAT", message.get('request_id'))
        except Exception as e:
            logger.error(f"处理批量删除PDF文件请求时出错: {str(e)}")
            self.response.send_error_response(client, f"处理批量删除PDF文件请求时出错: {str(e)}", "batch_remove_pdf", "INTERNAL_ERROR", message.get('request_id'))
    
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
                self.response.send_error_response(
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
                self.response.send_error_response(
                    client,
                    f"未找到文件: {file_id}",
                    "pdf_detail_request",
                    "FILE_NOT_FOUND",
                    message.get('request_id')
                )
                return
            
            # 发送成功响应
            self.response.send_success_response(
                client,
                "pdf_detail_request",
                file_detail,
                message.get('request_id')
            )
            logger.info(f"PDF详情响应发送成功，文件ID: {file_id}")
            
        except ValueError as e:
            logger.error(f"PDF详情请求参数格式错误: {str(e)}")
            self.response.send_error_response(
                client,
                f"参数格式错误: {str(e)}",
                "pdf_detail_request",
                "INVALID_PARAMETER_FORMAT",
                message.get('request_id')
            )
        except Exception as e:
            logger.error(f"处理PDF详情请求时出错: {str(e)}")
            self.response.send_error_response(
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
            self.response.send_success_response(client, "pdfjs_init_log_ack", {
                "received": True,
                "timestamp": time.time()
            }, message.get('request_id'))
            
            logger.info("PDF.js init log processed and acknowledged")
            
        except Exception as e:
            logger.error(f"处理PDF.js init log时出错: {str(e)}")
            self.response.send_error_response(client, f"处理PDF.js init log出错: {str(e)}", "pdfjs_init_log", "INTERNAL_ERROR", message.get('request_id'))