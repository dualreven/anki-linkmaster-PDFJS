from typing import Dict, Any, Optional
import os
import logging
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType

logger = logging.getLogger(__name__)


def console_log(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        source = data.get("source", "unknown")
        level = data.get("level", "log")
        timestamp = data.get("timestamp", "")
        log_message = data.get("message", "")

        if timestamp:
            try:
                import datetime
                dt = datetime.datetime.fromtimestamp(timestamp / 1000)
                formatted_time = dt.strftime("%H:%M:%S.%f")[:-3]
            except Exception:
                formatted_time = str(timestamp)
        else:
            formatted_time = ""

        log_entry = f"[{formatted_time}][{level.upper()}][{source}] {log_message}"
        log_file_path = "logs/unified-console.log"
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")
            f.flush()
        logger.debug(f"[Console-{source}] {log_message}")
        return StandardMessageHandler.build_response(
            "response",
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="Console log recorded successfully",
            data={"logged": True, "source": source, "level": level},
        )
    except Exception as e:
        logger.error(f"处理console日志失败: {e}")
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "CONSOLE_LOG_ERROR",
            f"处理console日志失败: {str(e)}",
        )


def heartbeat(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    return StandardMessageHandler.build_response(
        MessageType.HEARTBEAT_COMPLETED,
        request_id or StandardMessageHandler.generate_request_id(),
        status="success",
        code=200,
        message="心跳响应",
        data={"timestamp": __import__("time").time()},
    )

