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
      - 可选 self._describe_client(socket) -> str：返回 `<client-name>:<client-id>` 描述
    """
    def send_message(self, client: object, message: Dict[str, Any]) -> bool:
        """发送消息给指定客户端

        NOTE:
        - 生产环境：通过 WebSocketServerCore 向真实 QWebSocket 发送。
        - 测试环境：当 self._test_mode=True 且传入的是 MockSocket（仅需实现 sendTextMessage），直接调用以便单测覆盖。
        """
        try:
            json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))

            # 单元测试/无 Qt 环境：允许 MockSocket 直接接收消息（不依赖 _core 连接状态）
            if getattr(self, "_test_mode", False) and hasattr(client, "sendTextMessage"):
                try:
                    getattr(client, "sendTextMessage")(json_message)
                    return True
                except Exception as e:
                    logger.error(f"[test_mode] 发送消息失败: {e}")
                    return False

            ok = self._core.send_text(client, json_message)  # type: ignore[attr-defined]
            if ok:
                try:
                    # 优先使用组合类提供的客户端描述方法，便于在日志中直接看到“真实名称”
                    label: Optional[str] = None
                    try:
                        describe = getattr(self, "_describe_client", None)
                        if callable(describe):
                            label = describe(client)
                    except Exception:
                        label = None
                    if not label:
                        try:
                            label = str(client.peerPort())
                        except Exception:
                            label = "unknown"
                    logger.info("向客户端 %s 发送消息: %s", label, message.get("type"))
                except Exception:
                    logger.info("已发送消息: %s", message.get("type"))
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
