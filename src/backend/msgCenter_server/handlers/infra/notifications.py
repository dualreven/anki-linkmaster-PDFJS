from typing import Dict, Any, Optional
import logging
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, PDFMessageBuilder, MessageType

logger = logging.getLogger(__name__)


def send_welcome(server, socket) -> None:
    try:
        msg = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS_UPDATED.value,
            data={
                "status": "connected",
                "server_version": "1.0.0",
                "client_count": server.get_client_count(),
            },
        )
        server.send_message(socket, msg)
    except Exception as exc:
        logger.debug("发送欢迎消息失败: %s", exc)


def broadcast_pdf_list(server) -> None:
    try:
        if hasattr(server, "pdf_library_api") and server.pdf_library_api:
            files = server.pdf_library_api.list_records()
        else:
            files = server.pdf_manager.get_files()
        message = PDFMessageBuilder.build_pdf_list_response(request_id=None, files=files)
        server.broadcast_message(message)
        logger.info("已广播PDF列表更新消息，共 %s 个文件", len(files))
    except Exception as e:
        logger.error("广播列表更新失败: %s", e)


def notify_file_added(server, file_info: Dict[str, Any]) -> None:
    try:
        if hasattr(server, "pdf_library_api") and server.pdf_library_api:
            server.pdf_library_api.register_file_info(file_info)
    except Exception as exc:
        logger.error("同步文件信息到数据库失败: %s", exc)
    message = StandardMessageHandler.build_base_message(
        MessageType.SYSTEM_STATUS_UPDATED,
        data={
            "event": "file_added",
            "file_info": file_info,
            "file_count": server.pdf_manager.get_file_count(),
        },
    )
    server.broadcast_message(message)


def notify_file_removed(server, file_id: str) -> None:
    try:
        if hasattr(server, "pdf_library_api") and server.pdf_library_api:
            server.pdf_library_api.delete_record(file_id)
    except Exception as exc:
        logger.error("删除PDF数据库记录失败: %s", exc)
    message = StandardMessageHandler.build_base_message(
        MessageType.SYSTEM_STATUS_UPDATED,
        data={"event": "file_removed", "file_id": file_id, "file_count": server.pdf_manager.get_file_count()},
    )
    server.broadcast_message(message)

