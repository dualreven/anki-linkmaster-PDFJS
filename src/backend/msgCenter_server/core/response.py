import time
import uuid
from typing import Dict, Any, Optional, Union
from src.backend.msgCenter_server.core.message_types import MessageType


def _as_type_value(message_type: Union[str, MessageType]) -> str:
    return message_type.value if isinstance(message_type, MessageType) else str(message_type)


def generate_request_id() -> str:
    return str(uuid.uuid4())


def build_base_message(
    message_type: Union[str, MessageType],
    request_id: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    构建基础消息（毫秒级 timestamp）
    """
    msg_type = _as_type_value(message_type)
    message: Dict[str, Any] = {
        "type": msg_type,
        "timestamp": int(time.time() * 1000),
        "request_id": request_id or generate_request_id(),
    }
    if data is not None:
        message["data"] = data
    return message


def build_response(
    message_type: Union[str, MessageType],
    request_id: str,
    *,
    data: Optional[Dict[str, Any]] = None,
    status: str = "success",
    code: int = 200,
    message: str = "",
    error: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    构建标准响应（秒级 timestamp，与现有实现保持一致）
    """
    msg_type = _as_type_value(message_type)
    response: Dict[str, Any] = {
        "type": msg_type,
        "timestamp": time.time(),
        "request_id": request_id,
        "status": status,
        "code": code,
        "message": message,
    }
    if data is not None:
        response["data"] = data
    if error is not None:
        response["error"] = error
    return response


def build_error_response(
    request_id: str,
    error_type: str,
    error_message: str,
    *,
    message_type: Union[str, MessageType] = MessageType.LEGACY_ERROR,
    error_details: Optional[Dict[str, Any]] = None,
    code: int = 500,
) -> Dict[str, Any]:
    """
    构建标准错误响应（保持现有字段与行为）
    """
    error_payload: Dict[str, Any] = {
        "type": error_type,
        # 兼容字段：历史测试/部分客户端使用 error_code（等价于 type）
        "error_code": error_type,
        "message": error_message,
        # 兼容字段：部分测试使用 error_message（等价于 message）
        "error_message": error_message,
    }
    if error_details is not None:
        error_payload["details"] = error_details
    return build_response(
        message_type,
        request_id,
        status="error",
        code=code,
        message=error_message,
        data=None,
        error=error_payload,
    )
