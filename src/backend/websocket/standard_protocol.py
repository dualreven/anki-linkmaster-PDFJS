"""
标准JSON通信协议处理器
基于docs/SPEC/json_communication_standard.md实现
"""
import json
import uuid
import time
import logging
from typing import Dict, Any, Optional, Union
from enum import Enum

logger = logging.getLogger(__name__)

class MessageType(Enum):
    """标准消息类型枚举 - 符合JSON通信标准"""
    # PDF管理消息
    GET_PDF_LIST = "get_pdf_list"
    PDF_LIST = "pdf_list"
    ADD_PDF = "add_pdf"
    PDF_ADDED = "pdf_added"
    REMOVE_PDF = "remove_pdf"
    PDF_REMOVED = "pdf_removed"
    BATCH_REMOVE_PDF = "batch_remove_pdf"
    BATCH_PDF_REMOVED = "batch_pdf_removed"
    PDF_DETAIL_REQUEST = "pdf_detail_request"
    PDF_DETAIL_RESPONSE = "pdf_detail_response"
    
    # 系统消息
    SYSTEM_STATUS = "system_status"
    SYSTEM_CONFIG = "system_config"
    
    # 错误消息
    ERROR = "error"
    
    # 心跳消息
    HEARTBEAT = "heartbeat"
    HEARTBEAT_RESPONSE = "heartbeat_response"

class StandardMessageHandler:
    """标准消息处理器 - 符合JSON通信标准"""
    
    @staticmethod
    def generate_request_id() -> str:
        """生成唯一的请求ID"""
        return str(uuid.uuid4())
    
    @staticmethod
    def validate_message_structure(message: Dict[str, Any]) -> tuple[bool, str]:
        """
        验证消息结构是否符合标准
        
        Args:
            message: 待验证的消息字典
            
        Returns:
            tuple: (是否有效, 错误信息)
        """
        if not isinstance(message, dict):
            return False, "消息必须是字典类型"
        
        # 检查必需字段
        required_fields = ["type", "timestamp"]
        for field in required_fields:
            if field not in message:
                return False, f"缺少必需字段: {field}"
        
        # 验证type字段
        if not isinstance(message["type"], str):
            return False, "type字段必须是字符串"
        
        # 验证timestamp字段
        if not isinstance(message["timestamp"], (int, float)):
            return False, "timestamp字段必须是数字"
        
        # 验证request_id（如果存在）
        if "request_id" in message and not isinstance(message["request_id"], str):
            return False, "request_id字段必须是字符串"
        
        # 验证data字段（如果存在）
        if "data" in message and not isinstance(message["data"], dict):
            return False, "data字段必须是字典"
        
        # 验证error字段（如果存在）
        if "error" in message and not isinstance(message["error"], dict):
            return False, "error字段必须是字典"
        
        return True, ""
    
    @staticmethod
    def build_base_message(
        message_type: Union[str, MessageType],
        request_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        构建基础消息格式
        
        Args:
            message_type: 消息类型
            request_id: 请求ID（可选，会自动生成）
            data: 消息数据（可选）
            
        Returns:
            Dict: 标准格式的消息
        """
        if isinstance(message_type, MessageType):
            message_type = message_type.value
        
        message = {
            "type": message_type,
            "timestamp": int(time.time() * 1000),  # 毫秒级时间戳
        }
        
        if request_id is None:
            request_id = StandardMessageHandler.generate_request_id()
        message["request_id"] = request_id
        
        if data is not None:
            message["data"] = data
        
        return message
    
    @staticmethod
    def build_response(
        message_type: Union[str, MessageType],
        request_id: str,
        data: Optional[Dict[str, Any]] = None,
        status: str = "success",
        code: int = 200,
        message: str = "",
        error: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        构建标准响应消息格式

        Args:
            message_type: 消息类型
            request_id: 对应的请求ID
            data: 响应数据（可选）
            status: 状态(success|error|pending)
            code: 状态码
            message: 描述信息
            error: 错误信息（可选，当status="error"时使用）

        Returns:
            Dict: 标准格式的响应消息
        """
        if isinstance(message_type, MessageType):
            message_type = message_type.value

        response = {
            "type": "response",
            "timestamp": time.time(),  # Unix时间戳(秒)
            "request_id": request_id,
            "status": status,
            "code": code,
            "message": message
        }

        if data is not None:
            response["data"] = data
        if error is not None:
            response["error"] = error

        return response
    
    @staticmethod
    def build_error_response(
        request_id: str,
        error_type: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None,
        code: int = 500
    ) -> Dict[str, Any]:
        """
        构建标准错误响应消息

        Args:
            request_id: 对应的请求ID
            error_type: 错误类型
            error_message: 错误消息
            error_details: 详细错误信息（可选）
            code: HTTP状态码

        Returns:
            Dict: 标准格式的错误响应消息
        """
        error_data = {
            "type": error_type,
            "message": error_message
        }

        if error_details:
            error_data["details"] = error_details

        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="error",
            code=code,
            message=error_message,
            error=error_data
        )
    
    @staticmethod
    def parse_message(raw_message: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        解析JSON消息
        
        Args:
            raw_message: 原始JSON消息字符串
            
        Returns:
            tuple: (解析后的消息字典, 错误信息)
        """
        try:
            message = json.loads(raw_message)
            is_valid, error_msg = StandardMessageHandler.validate_message_structure(message)
            if not is_valid:
                return None, error_msg
            return message, None
        except json.JSONDecodeError as e:
            return None, f"JSON解析错误: {str(e)}"
        except Exception as e:
            return None, f"消息解析错误: {str(e)}"
    
    @staticmethod
    def serialize_message(message: Dict[str, Any]) -> str:
        """
        序列化消息为JSON字符串
        
        Args:
            message: 消息字典
            
        Returns:
            str: JSON格式的消息字符串
        """
        return json.dumps(message, ensure_ascii=False, separators=(',', ':'))

class PDFMessageBuilder:
    """PDF相关消息构建器"""
    
    @staticmethod
    def build_pdf_list_response(
        request_id: str,
        files: list,
        total_count: int = None,
        pagination: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """构建PDF列表响应"""
        if total_count is None:
            total_count = len(files)

        data = {
            "files": files,
            "pagination": {
                "total": total_count,
                **(pagination or {})
            }
        }

        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="success",
            code=200,
            message="PDF列表获取成功",
            data=data
        )
    
    @staticmethod
    def build_pdf_upload_response(
        request_id: str,
        file_id: str,
        filename: str,
        file_size: int
    ) -> Dict[str, Any]:
        """构建PDF上传响应"""
        data = {
            "file": {
                "id": file_id,
                "filename": filename,
                "file_size": file_size
            }
        }

        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="success",
            code=201,
            message="PDF文件上传成功",
            data=data
        )
    
    @staticmethod
    def build_pdf_remove_response(
        request_id: str,
        file_id: str
    ) -> Dict[str, Any]:
        """构建PDF删除响应"""
        data = {
            "file_id": file_id
        }

        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="success",
            code=200,
            message="PDF文件删除成功",
            data=data
        )
    
    @staticmethod
    def build_pdf_detail_response(
        request_id: str,
        file_detail: Dict[str, Any]
    ) -> Dict[str, Any]:
        """构建PDF详情响应"""
        return StandardMessageHandler.build_response(
            MessageType.PDF_DETAIL_RESPONSE,
            request_id,
            data=file_detail
        )

    @staticmethod
    def build_batch_pdf_remove_response(
        request_id: str,
        removed_files: List[str],
        failed_files: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """构建批量PDF删除响应"""
        data = {
            "removed_files": removed_files,
            "failed_files": failed_files or {},
            "total_removed": len(removed_files),
            "total_failed": len(failed_files) if failed_files else 0
        }

        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="success",
            code=200,
            message=f"批量删除完成，成功删除 {len(removed_files)} 个文件",
            data=data
        )