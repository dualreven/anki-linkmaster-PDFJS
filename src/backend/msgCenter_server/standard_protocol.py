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

logger = logging.getLogger(__name__)

class MessageType(Enum):
    """标准消息类型枚举 - 三段式命名及兼容旧协议"""

    # === PDF Library 基础操作 ===
    PDF_LIBRARY_LIST_REQUESTED = "pdf-library:list:requested"
    PDF_LIBRARY_LIST_COMPLETED = "pdf-library:list:completed"
    PDF_LIBRARY_LIST_FAILED = "pdf-library:list:failed"

    PDF_LIBRARY_ADD_REQUESTED = "pdf-library:add:requested"
    PDF_LIBRARY_ADD_COMPLETED = "pdf-library:add:completed"
    PDF_LIBRARY_ADD_FAILED = "pdf-library:add:failed"

    PDF_LIBRARY_REMOVE_REQUESTED = "pdf-library:remove:requested"
    PDF_LIBRARY_REMOVE_COMPLETED = "pdf-library:remove:completed"
    PDF_LIBRARY_REMOVE_FAILED = "pdf-library:remove:failed"

    PDF_LIBRARY_VIEWER_REQUESTED = "pdf-library:viewer:requested"
    PDF_LIBRARY_VIEWER_COMPLETED = "pdf-library:viewer:completed"
    PDF_LIBRARY_VIEWER_FAILED = "pdf-library:viewer:failed"

    PDF_LIBRARY_INFO_REQUESTED = "pdf-library:info:requested"
    PDF_LIBRARY_INFO_COMPLETED = "pdf-library:info:completed"
    PDF_LIBRARY_INFO_FAILED = "pdf-library:info:failed"

    PDF_LIBRARY_SEARCH_REQUESTED = "pdf-library:search:requested"
    PDF_LIBRARY_SEARCH_COMPLETED = "pdf-library:search:completed"
    PDF_LIBRARY_SEARCH_FAILED = "pdf-library:search:failed"
    PDF_LIBRARY_RECORD_UPDATE_REQUESTED = "pdf-library:record-update:requested"
    PDF_LIBRARY_RECORD_UPDATE_COMPLETED = "pdf-library:record-update:completed"
    PDF_LIBRARY_RECORD_UPDATE_FAILED = "pdf-library:record-update:failed"

    PDF_LIBRARY_CONFIG_READ_REQUESTED = "pdf-library:config-read:requested"
    PDF_LIBRARY_CONFIG_READ_COMPLETED = "pdf-library:config-read:completed"
    PDF_LIBRARY_CONFIG_READ_FAILED = "pdf-library:config-read:failed"

    PDF_LIBRARY_CONFIG_WRITE_REQUESTED = "pdf-library:config-write:requested"
    PDF_LIBRARY_CONFIG_WRITE_COMPLETED = "pdf-library:config-write:completed"
    PDF_LIBRARY_CONFIG_WRITE_FAILED = "pdf-library:config-write:failed"

    # === Bookmark 操作 ===
    BOOKMARK_LIST_REQUESTED = "bookmark:list:requested"
    BOOKMARK_LIST_COMPLETED = "bookmark:list:completed"
    BOOKMARK_LIST_FAILED = "bookmark:list:failed"

    BOOKMARK_SAVE_REQUESTED = "bookmark:save:requested"
    BOOKMARK_SAVE_COMPLETED = "bookmark:save:completed"
    BOOKMARK_SAVE_FAILED = "bookmark:save:failed"

    # === PDF 页面传输 ===
    PDF_PAGE_LOAD_REQUESTED = "pdf-page:load:requested"
    PDF_PAGE_LOAD_COMPLETED = "pdf-page:load:completed"
    PDF_PAGE_LOAD_FAILED = "pdf-page:load:failed"

    PDF_PAGE_PRELOAD_REQUESTED = "pdf-page:preload:requested"
    PDF_PAGE_CACHE_CLEAR_REQUESTED = "pdf-page:cache-clear:requested"

    # === 系统与心跳 ===
    SYSTEM_STATUS_UPDATED = "system:status:updated"
    SYSTEM_CONFIG_UPDATED = "system:config:updated"
    SYSTEM_ERROR_OCCURRED = "system:error:occurred"

    HEARTBEAT_REQUESTED = "system:heartbeat:requested"
    HEARTBEAT_COMPLETED = "system:heartbeat:completed"

    # === 能力注册中心（Capability Registry） ===
    CAPABILITY_DISCOVER_REQUESTED = "capability:discover:requested"
    CAPABILITY_DISCOVER_COMPLETED = "capability:discover:completed"
    CAPABILITY_DISCOVER_FAILED = "capability:discover:failed"

    CAPABILITY_DESCRIBE_REQUESTED = "capability:describe:requested"
    CAPABILITY_DESCRIBE_COMPLETED = "capability:describe:completed"
    CAPABILITY_DESCRIBE_FAILED = "capability:describe:failed"

    # === 存储服务（KV 最小实现） ===
    STORAGE_KV_GET_REQUESTED = "storage-kv:get:requested"
    STORAGE_KV_GET_COMPLETED = "storage-kv:get:completed"
    STORAGE_KV_GET_FAILED = "storage-kv:get:failed"
    STORAGE_KV_SET_REQUESTED = "storage-kv:set:requested"
    STORAGE_KV_SET_COMPLETED = "storage-kv:set:completed"
    STORAGE_KV_SET_FAILED = "storage-kv:set:failed"
    STORAGE_KV_DELETE_REQUESTED = "storage-kv:delete:requested"
    STORAGE_KV_DELETE_COMPLETED = "storage-kv:delete:completed"
    STORAGE_KV_DELETE_FAILED = "storage-kv:delete:failed"

    # === 存储服务（FS 最小实现） ===
    STORAGE_FS_READ_REQUESTED = "storage-fs:read:requested"
    STORAGE_FS_READ_COMPLETED = "storage-fs:read:completed"
    STORAGE_FS_READ_FAILED = "storage-fs:read:failed"
    STORAGE_FS_WRITE_REQUESTED = "storage-fs:write:requested"
    STORAGE_FS_WRITE_COMPLETED = "storage-fs:write:completed"
    STORAGE_FS_WRITE_FAILED = "storage-fs:write:failed"

    # === Annotation（标注） ===
    ANNOTATION_LIST_REQUESTED = "annotation:list:requested"
    ANNOTATION_LIST_COMPLETED = "annotation:list:completed"
    ANNOTATION_LIST_FAILED = "annotation:list:failed"

    ANNOTATION_SAVE_REQUESTED = "annotation:save:requested"
    ANNOTATION_SAVE_COMPLETED = "annotation:save:completed"
    ANNOTATION_SAVE_FAILED = "annotation:save:failed"

    ANNOTATION_DELETE_REQUESTED = "annotation:delete:requested"
    ANNOTATION_DELETE_COMPLETED = "annotation:delete:completed"
    ANNOTATION_DELETE_FAILED = "annotation:delete:failed"

    # === Anchor（锚点） ===
    ANCHOR_GET_REQUESTED = "anchor:get:requested"
    ANCHOR_GET_COMPLETED = "anchor:get:completed"
    ANCHOR_GET_FAILED = "anchor:get:failed"

    ANCHOR_LIST_REQUESTED = "anchor:list:requested"
    ANCHOR_LIST_COMPLETED = "anchor:list:completed"
    ANCHOR_LIST_FAILED = "anchor:list:failed"

    ANCHOR_CREATE_REQUESTED = "anchor:create:requested"
    ANCHOR_CREATE_COMPLETED = "anchor:create:completed"
    ANCHOR_CREATE_FAILED = "anchor:create:failed"

    ANCHOR_UPDATE_REQUESTED = "anchor:update:requested"
    ANCHOR_UPDATE_COMPLETED = "anchor:update:completed"
    ANCHOR_UPDATE_FAILED = "anchor:update:failed"

    ANCHOR_DELETE_REQUESTED = "anchor:delete:requested"
    ANCHOR_DELETE_COMPLETED = "anchor:delete:completed"
    ANCHOR_DELETE_FAILED = "anchor:delete:failed"

    ANCHOR_ACTIVATE_REQUESTED = "anchor:activate:requested"
    ANCHOR_ACTIVATE_COMPLETED = "anchor:activate:completed"
    ANCHOR_ACTIVATE_FAILED = "anchor:activate:failed"

    # === PDF-Viewer 实例注册与导航 ===
    PDF_VIEWER_REGISTER_REQUESTED = "pdf-viewer:register:requested"
    PDF_VIEWER_REGISTER_COMPLETED = "pdf-viewer:register:completed"
    PDF_VIEWER_REGISTER_FAILED = "pdf-viewer:register:failed"

    PDF_VIEWER_NAVIGATE_REQUESTED = "pdf-viewer:navigate:requested"
    PDF_VIEWER_NAVIGATE_COMPLETED = "pdf-viewer:navigate:completed"
    PDF_VIEWER_NAVIGATE_FAILED = "pdf-viewer:navigate:failed"

    # === 兼容旧版消息（保留常量以便查询与降级） ===
    LEGACY_PDF_HOME_GET_PDF_LIST = "pdf-home:get:pdf-list"
    LEGACY_PDF_HOME_ADD_PDF_FILES = "pdf-home:add:pdf-files"
    LEGACY_PDF_HOME_REMOVE_PDF_FILES = "pdf-home:remove:pdf-files"
    LEGACY_PDF_HOME_OPEN_PDF_FILE = "pdf-home:open:pdf-file"
    LEGACY_PDF_HOME_GET_PDF_INFO = "pdf-home:get:pdf-info"
    LEGACY_PDF_HOME_UPDATE_PDF = "pdf-home:update:pdf"

    LEGACY_PDF_LIBRARY_LIST = "pdf-library:list:records"
    LEGACY_PDF_LIBRARY_ADD = "pdf-library:add:records"
    LEGACY_PDF_LIBRARY_REMOVE = "pdf-library:remove:records"
    LEGACY_PDF_LIBRARY_OPEN = "pdf-library:open:viewer"
    LEGACY_PDF_LIBRARY_INFO = "pdf-library:get:info"
    LEGACY_PDF_LIBRARY_SEARCH = "pdf-library:search:records"
    LEGACY_PDF_LIBRARY_GET_CONFIG = "pdf-library:get:config"
    LEGACY_PDF_LIBRARY_UPDATE_CONFIG = "pdf-library:update:config"

    LEGACY_BOOKMARK_LIST = "bookmark:list:records"
    LEGACY_BOOKMARK_SAVE = "bookmark:save:record"

    LEGACY_PDF_PAGE_REQUEST = "pdf_page_request"
    LEGACY_PDF_PAGE_RESPONSE = "pdf_page_response"
    LEGACY_PDF_PAGE_PRELOAD = "pdf_page_preload"
    LEGACY_PDF_PAGE_CACHE_CLEAR = "pdf_page_cache_clear"
    LEGACY_PDF_PAGE_ERROR = "pdf_page_error"

    LEGACY_SYSTEM_STATUS = "system_status"
    LEGACY_SYSTEM_CONFIG = "system_config"
    LEGACY_ERROR = "error"
    LEGACY_HEARTBEAT = "heartbeat"
    LEGACY_HEARTBEAT_RESPONSE = "heartbeat_response"
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
            "type": message_type,
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
        *,
        message_type: Union[str, MessageType] = MessageType.LEGACY_ERROR,
        error_details: Optional[Dict[str, Any]] = None,
        code: int = 500
    ) -> Dict[str, Any]:
        """构建标准错误响应消息"""
        if isinstance(message_type, MessageType):
            message_type = message_type.value

        error_payload = {
            "type": error_type,
            "message": error_message
        }
        if error_details:
            error_payload["details"] = error_details

        return StandardMessageHandler.build_response(
            message_type,
            request_id,
            status="error",
            code=code,
            message=error_message,
            error=error_payload
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
