"""
标准JSON通信协议处理器
基于docs/SPEC/json_communication_standard.md实现
"""
import json
import uuid
import time
import logging
from typing import Dict, Any, Optional, Union, List
from enum import Enum
from src.backend.msgCenter_server.core.message_types import MessageType
from src.backend.msgCenter_server.core.response import (
    build_base_message as _build_base_message,
    build_response as _build_response,
    build_error_response as _build_error_response,
)

logger = logging.getLogger(__name__)

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
        return _build_base_message(message_type, request_id=request_id, data=data)
    
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
        return _build_response(
            message_type,
            request_id,
            data=data,
            status=status,
            code=code,
            message=message,
            error=error,
        )
    
    @staticmethod
    def build_error_response(
        request_id: str,
        error_type: str,
        error_message: str,
        *,
        message_type: Union[str, MessageType] = MessageType.LEGACY_ERROR,
        error_details: Optional[Dict[str, Any]] = None,
        code: int = 500
    ) -> Dict[str, Any]:
        return _build_error_response(
            request_id,
            error_type,
            error_message,
            message_type=message_type,
            error_details=error_details,
            code=code,
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
            MessageType.PDF_LIBRARY_LIST_COMPLETED,
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
            MessageType.PDF_LIBRARY_ADD_COMPLETED,
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
            MessageType.PDF_LIBRARY_REMOVE_COMPLETED,
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
            MessageType.PDF_LIBRARY_INFO_COMPLETED,
            request_id,
            status="success",
            code=200,
            message="PDF详情获取成功",
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
            MessageType.PDF_LIBRARY_REMOVE_COMPLETED,
            request_id,
            status="success",
            code=200,
            message=f"批量删除完成，成功删除 {len(removed_files)} 个文件",
            data=data
        )

    @staticmethod
    def build_pdf_page_response(
        request_id: str,
        file_id: str,
        page_number: int,
        page_data: Dict[str, Any],
        compression: str = "none",
        total_pages: Optional[int] = None,
        page_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """构建PDF页面响应"""
        data = {
            "file_id": file_id,
            "page_number": page_number,
            "page_data": page_data,
            "compression": compression,
            "metadata": {
                "retrieved_at": int(time.time() * 1000)
            }
        }

        if total_pages is not None:
            data["total_pages"] = total_pages
        if page_size is not None:
            data["page_size"] = page_size

        return StandardMessageHandler.build_response(
            MessageType.PDF_PAGE_LOAD_COMPLETED,
            request_id,
            status="success",
            code=200,
            message="PDF页面获取成功",
            data=data
        )

    @staticmethod
    def build_pdf_page_error_response(
        request_id: str,
        file_id: str,
        page_number: int,
        error_type: str,
        error_message: str,
        retryable: bool = False,
        error_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """构建PDF页面错误响应"""
        error_data = {
            "file_id": file_id,
            "page_number": page_number,
            "type": error_type,
            "message": error_message,
            "retryable": retryable,
            "timestamp": int(time.time() * 1000)
        }

        if error_details:
            error_data["details"] = error_details

        return StandardMessageHandler.build_error_response(
            request_id,
            error_type,
            error_message,
            message_type=MessageType.PDF_PAGE_LOAD_FAILED,
            error_details=error_data,
            code=500
        )

    @staticmethod
    def build_pdf_page_preload_request(
        file_id: str,
        start_page: int,
        end_page: int,
        priority: str = "low",
        compression: str = "none"
    ) -> Dict[str, Any]:
        """构建PDF页面预加载请求"""
        data = {
            "file_id": file_id,
            "start_page": start_page,
            "end_page": end_page,
            "priority": priority,
            "compression": compression
        }

        return StandardMessageHandler.build_base_message(
            MessageType.PDF_PAGE_PRELOAD_REQUESTED,
            data=data
        )

    @staticmethod
    def build_pdf_page_cache_clear_request(
        file_id: str,
        keep_pages: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """构建PDF页面缓存清理请求"""
        data = {
            "file_id": file_id
        }

        if keep_pages:
            data["keep_pages"] = keep_pages

        return StandardMessageHandler.build_base_message(
            MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED,
            data=data
        )
