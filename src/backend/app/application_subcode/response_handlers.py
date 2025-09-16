"""
Anki LinkMaster PDFJS - WebSocket响应处理工具
包含发送响应的各种工具函数
"""

import time
import logging

# 配置日志
logger = logging.getLogger(__name__)


class ResponseHandlers:
    """响应处理工具类"""
    
    def __init__(self, websocket_server):
        """初始化响应处理器
        
        Args:
            websocket_server: WebSocket服务器实例
        """
        self.websocket_server = websocket_server
        
        # 错误码映射
        self.error_mapping = {
            "MISSING_PARAMETERS": 400,
            "INVALID_PARAMETER_FORMAT": 400,
            "FILE_NOT_FOUND": 404,
            "DIRECTORY_NOT_FOUND": 404,
            "PERMISSION_DENIED": 403,
            "REMOVE_FILE_FAILED": 422,
            "PARTIAL_SUCCESS": 207,
            "SERVER_ERROR": 500,
            "FILE_EXISTS": 409,
            "FEATURE_NOT_AVAILABLE": 501,
            "FILE_SELECTION_ERROR": 500,
            "INTERNAL_ERROR": 500,
            "INVALID_FILE_FORMAT": 415
        }

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
        response_data = {
            'type': 'response',
            'timestamp': time.time(),
            'request_id': original_message_id,
            'status': 'error',
            'code': self.error_mapping.get(error_code, 500),
            'message': error_message,
            'error': {
                'type': error_code.lower(),
                'message': error_message,
                'details': {}
            }
        }
        self.send_response(client, response_data, original_message_id)