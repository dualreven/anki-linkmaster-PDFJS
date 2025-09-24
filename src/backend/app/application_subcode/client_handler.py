"""
Anki LinkMaster PDFJS - 客户端连接处理器
包含处理客户端连接相关的方法
"""

import os
import logging
from src.qt.compat import QTimer

# 配置日志
logger = logging.getLogger(__name__)


class ClientHandler:
    """客户端连接处理器类"""
    
    def __init__(self, app_instance):
        """初始化客户端处理器
        
        Args:
            app_instance: 主应用实例
        """
        self.app = app_instance
        self.pdf_manager = app_instance.pdf_manager
        self.websocket_server = app_instance.websocket_server

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

                # 如果有文件路径参数，发送给前端 (解耦设计)
                if hasattr(self.app, 'file_path') and self.app.file_path:
                    logger.info(f"[DEBUG] 发送文件路径给前端: {self.app.file_path}")
                    filename = os.path.basename(self.app.file_path)

                    # pdf-viewer 模块负责处理文件，消息队列确保初始化完成前处理
                    self.websocket_server.send_message(client, {
                        'type': 'load_pdf_file',
                        'data': {
                            'file_path': self.app.file_path,  # 原完整路径
                            'filename': filename,         # 仅作为参考
                            'url': f"/pdfs/{filename}"    # Vite代理路径
                        }
                    })
            except Exception as e:
                logger.error(f"发送初始数据失败: {str(e)}")
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