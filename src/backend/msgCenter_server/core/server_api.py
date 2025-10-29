import json
import logging
from typing import Dict, Any, Optional, List

from src.qt.compat import QWebSocket  # type: ignore

logger = logging.getLogger(__name__)


class ServerAPIMixin:
    """
    提供 WebSocket 服务器常用 API（发送/广播/连接统计/错误处理）。
    作为 Mixin 供 StandardWebSocketServer 复用，减少入口文件体积。
    依赖属性：
      - self._core: WebSocketServerCore
    """
    def send_message(self, client: QWebSocket, message: Dict[str, Any]) -> bool:
        """发送消息给指定客户端"""
        try:
            json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
            ok = self._core.send_text(client, json_message)  # type: ignore[attr-defined]
            if ok:
                try:
                    logger.info(f"向客户端 {client.peerPort()} 发送消息: {message.get('type')}")
                except Exception:
                    logger.info(f"已发送消息: {message.get('type')}")
                return True
            logger.warning("客户端未连接，无法发送消息")
            return False
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return False

    def broadcast_message(self, message: Dict[str, Any]):
        """广播消息给所有客户端"""
        if not isinstance(message, dict):
            return
        json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
        self._core.broadcast_text(json_message)  # type: ignore[attr-defined]
        logger.info("广播消息完成")

    def get_client_count(self) -> int:
        """获取当前连接的客户端数量"""
        return self._core.get_client_count()  # type: ignore[attr-defined]

    def get_client_ids(self) -> List[str]:
        """获取所有客户端ID列表"""
        return [f"client_{i}" for i in range(self._core.get_client_count())]  # type: ignore[attr-defined]

    def on_client_disconnected(self):
        """处理客户端断开连接"""
        client_socket = self.sender()
        try:
            logger.info(f"客户端断开连接: {client_socket.peerPort()}")
        except Exception:
            logger.info("客户端断开连接")
        # 由 core 负责移除与发信号；此处不再维护列表

    def on_socket_error(self, error):
        """处理WebSocket错误"""
        try:
            client_socket = self.sender()
            logger.error(f"WebSocket错误 from {client_socket.peerPort()}: {error}")
        except Exception:
            logger.error(f"WebSocket错误: {error}")

