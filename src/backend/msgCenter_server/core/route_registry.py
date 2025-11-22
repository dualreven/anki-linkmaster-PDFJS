"""
通用客户端路由注册表

职责：
- 管理客户端路由映射（client_id → socket）
- 支持精确路由（client_id）和资源路由（routing_key）
- 支持类型过滤（client_type）

不负责：
- 窗口单例检测（由调用方处理）
- 消息发送（由调用方处理）
"""

from typing import Dict, Set, Optional, List
from src.qt.compat import QWebSocket
import logging

logger = logging.getLogger(__name__)


class RouteRegistry:
    """通用客户端路由注册表（Fail-Fast 严格模式）"""

    def __init__(self):
        """初始化路由表"""
        # 精确路由：client_id → socket
        self._by_client_id: Dict[str, QWebSocket] = {}

        # 类型路由：client_type → set(sockets)
        self._by_type: Dict[str, Set[QWebSocket]] = {}

        # 资源路由：routing_key → set(sockets)
        self._by_resource: Dict[str, Set[QWebSocket]] = {}

        # 反向映射：socket → 客户端路由信息
        self._socket_info: Dict[QWebSocket, dict] = {}

    def register(
        self,
        socket: QWebSocket,
        client_id: str,
        client_type: Optional[List[str]] = None,
        routing_keys: Optional[List[str]] = None
    ) -> None:
        """
        注册客户端到路由表

        Args:
            socket: WebSocket 连接对象
            client_id: 客户端唯一标识（必填，非空字符串）
            client_type: 客户端类型标签数组（可选，用于类型过滤和逻辑匹配）
                        示例: ["window:pdf-viewer:sample", "user_focus", "editable"]
            routing_keys: 资源路由键列表（可选，用于资源组播）

        Raises:
            ValueError: client_id 为空或格式错误，或 client_type 不是列表
            RuntimeError: client_id 已存在（重复注册）

        Examples:
            # PDF Viewer 注册（新协议）
            registry.register(
                socket=ws_socket,
                client_id="pdf-viewer-sample",
                client_type=["window:pdf-viewer:sample", "user_focus", "editable"],
                routing_keys=["pdf:sample"]
            )

            # PDF Home 注册（新协议）
            registry.register(
                socket=ws_socket,
                client_id="pdf-home",
                client_type=["window:pdf-home"]
            )

            # 向后兼容：旧代码传入单个字符串会被自动转换为数组
            registry.register(
                socket=ws_socket,
                client_id="gui-launcher-ui",
                client_type=["gui-launcher"]  # 推荐使用数组格式
            )
        """
        # ⚠️ Fail-Fast 严格验证
        if not socket:
            raise ValueError("socket 不能为 None")

        if not client_id or not isinstance(client_id, str) or not client_id.strip():
            raise ValueError(f"client_id 必须是非空字符串，当前值: {client_id!r}")

        # 向后兼容：如果传入字符串，自动转换为数组
        if isinstance(client_type, str):
            logger.warning(
                f"[RouteRegistry] 检测到旧协议：client_type 为字符串 '{client_type}'，"
                f"已自动转换为数组 ['{client_type}']。建议更新调用方代码。"
            )
            client_type = [client_type]

        # 验证 client_type 格式
        if client_type is not None:
            if not isinstance(client_type, list):
                raise ValueError(
                    f"client_type 必须是字符串列表或 None，当前类型: {type(client_type)}"
                )
            if not all(isinstance(tag, str) and tag.strip() for tag in client_type):
                raise ValueError(
                    f"client_type 列表中存在无效标签（非字符串或空字符串）: {client_type}"
                )

        # 禁止重复注册同一 client_id（由调用方处理窗口激活逻辑）
        if client_id in self._by_client_id:
            raise RuntimeError(
                f"client_id '{client_id}' 已存在，禁止重复注册。"
                f"如需激活已有窗口，请由调用方处理。"
            )

        # 1. 精确路由：client_id → socket
        self._by_client_id[client_id] = socket
        logger.info(f"[RouteRegistry] 注册精确路由: {client_id} → {socket.peerAddress().toString()}:{socket.peerPort()}")

        # 2. 类型路由：client_type → set(sockets)（支持多标签）
        if client_type:
            for tag in client_type:
                tag = tag.strip()
                if tag not in self._by_type:
                    self._by_type[tag] = set()
                self._by_type[tag].add(socket)
                logger.debug(f"[RouteRegistry] 添加类型标签: {tag} ← {client_id}")
            logger.debug(f"[RouteRegistry] 客户端类型标签: {client_type}")

        # 3. 资源路由：routing_key → set(sockets)
        if routing_keys:
            for key in routing_keys:
                if not key or not isinstance(key, str):
                    logger.warning(f"[RouteRegistry] 忽略无效 routing_key: {key!r}")
                    continue
                if key not in self._by_resource:
                    self._by_resource[key] = set()
                self._by_resource[key].add(socket)
                logger.debug(f"[RouteRegistry] 添加资源路由: {key} ← {client_id}")

        # 4. 反向映射：socket → 客户端路由信息
        self._socket_info[socket] = {
            "client_id": client_id,
            "client_type": client_type,
            "routing_keys": routing_keys or [],
        }

        logger.info(
            f"[RouteRegistry] 客户端注册成功: client_id={client_id}, "
            f"client_type={client_type}, routing_keys={routing_keys}"
        )

    def find_targets(
        self,
        client_id: Optional[str] = None,
        target_type: Optional[str] = None,
        routing_key: Optional[str] = None
    ) -> List[QWebSocket]:
        """
        查找目标客户端 socket 列表

        路由策略（按优先级）：
        1. 精确路由：client_id 存在时，返回单个匹配的 socket
        2. 类型过滤：target_type + routing_key 组合，返回交集
        3. 资源路由：仅 routing_key，返回所有订阅该资源的 sockets

        Args:
            client_id: 客户端唯一标识（精确路由）
            target_type: 目标客户端类型（类型过滤）
            routing_key: 资源路由键（资源组播）

        Returns:
            匹配的 socket 列表（可能为空）

        Raises:
            ValueError: 所有路由字段都为空（违反 Fail-Fast 原则）

        Examples:
            # 精确路由（优先级最高）
            sockets = registry.find_targets(client_id="pdf-viewer-sample")
            # 返回: [<socket>] 或 []

            # 资源路由（组播到所有订阅者）
            sockets = registry.find_targets(routing_key="pdf:sample")
            # 返回: [<socket1>, <socket2>, ...]

            # 类型过滤（交集）
            sockets = registry.find_targets(
                target_type="pdf-viewer",
                routing_key="pdf:sample"
            )
            # 返回: 类型为 pdf-viewer 且订阅了 pdf:sample 的 sockets
        """
        # ⚠️ Fail-Fast 严格验证：至少提供一个路由字段
        if not client_id and not routing_key:
            raise ValueError(
                "至少需要提供 client_id 或 routing_key 之一进行路由查找。"
                "当前所有路由字段都为空，无法定位目标。"
            )

        # 策略 1：精确路由（优先级最高）
        if client_id:
            socket = self._by_client_id.get(client_id)
            if socket:
                logger.debug(f"[RouteRegistry] 精确路由命中: {client_id}")
                return [socket]
            else:
                logger.warning(f"[RouteRegistry] 精确路由未命中: {client_id} 不存在")
                return []

        # 策略 2 & 3：资源路由 + 可选类型过滤
        candidates = set()

        # 先按 routing_key 获取候选集合
        if routing_key:
            candidates = self._by_resource.get(routing_key, set()).copy()
            logger.debug(
                f"[RouteRegistry] 资源路由: {routing_key} → {len(candidates)} 个候选"
            )

        # 如果指定了 target_type，取交集
        if target_type and candidates:
            type_sockets = self._by_type.get(target_type, set())
            candidates = candidates & type_sockets
            logger.debug(
                f"[RouteRegistry] 类型过滤: {target_type} → 剩余 {len(candidates)} 个目标"
            )
        elif target_type and not candidates:
            # 如果没有 routing_key，仅按类型过滤
            candidates = self._by_type.get(target_type, set()).copy()
            logger.debug(
                f"[RouteRegistry] 仅类型过滤: {target_type} → {len(candidates)} 个目标"
            )

        result = list(candidates)
        logger.info(
            f"[RouteRegistry] 路由查找完成: client_id={client_id}, "
            f"target_type={target_type}, routing_key={routing_key} → {len(result)} 个目标"
        )
        return result

    def find_by_client_type(
        self,
        client_type_intersect: Optional[List[str]] = None,
        client_type_subset: Optional[List[str]] = None,
        client_type_exclude: Optional[List[str]] = None
    ) -> List[QWebSocket]:
        """
        基于 client_type 标签的逻辑匹配路由

        支持三种匹配模式（可组合使用）：
        1. intersect（交集匹配）：包含其中一项标签即可（OR逻辑）
        2. subset（子集匹配）：客户端的所有标签必须是指定集合的子集
        3. exclude（排除匹配）：不能包含任何排除标签

        Args:
            client_type_intersect: 交集匹配标签列表（包含其中一项即可）
            client_type_subset: 子集匹配标签列表（客户端标签必须是其子集）
            client_type_exclude: 排除匹配标签列表（不能包含任何一项）

        Returns:
            匹配的 socket 列表（可能为空）

        Raises:
            ValueError: 所有匹配条件都为空

        Examples:
            # 示例 1：查找包含 "user_focus" 或 "admin" 标签的客户端
            sockets = registry.find_by_client_type(
                client_type_intersect=["user_focus", "admin"]
            )

            # 示例 2：查找类型标签在 ["user_focus", "editable"] 范围内的客户端
            sockets = registry.find_by_client_type(
                client_type_subset=["user_focus", "editable", "read_only"]
            )

            # 示例 3：组合查询 - 包含 "user_focus" 但排除 "read_only" 的客户端
            sockets = registry.find_by_client_type(
                client_type_intersect=["user_focus"],
                client_type_exclude=["read_only", "admin"]
            )

            # 示例 4：复杂查询 - 必须包含 "user_focus"，类型在指定范围内，但不能是只读
            sockets = registry.find_by_client_type(
                client_type_intersect=["user_focus"],
                client_type_subset=["user_focus", "editable"],
                client_type_exclude=["read_only"]
            )
        """
        # ⚠️ Fail-Fast 严格验证：至少提供一个匹配条件
        if not client_type_intersect and not client_type_subset and not client_type_exclude:
            raise ValueError(
                "至少需要提供一个匹配条件（client_type_intersect/subset/exclude）"
            )

        # 候选集合：初始为所有已注册的客户端
        candidates = set(self._socket_info.keys())
        logger.debug(f"[RouteRegistry] 开始逻辑匹配：初始候选数 {len(candidates)}")

        # 1. 交集匹配（intersect）：包含其中一项标签即可（OR逻辑）
        if client_type_intersect:
            intersect_set = set(client_type_intersect)
            matched = set()
            for socket in candidates:
                client_types = set(self._socket_info[socket]["client_type"] or [])
                # 检查是否有交集（至少包含一个标签）
                if client_types.intersection(intersect_set):
                    matched.add(socket)
            candidates = matched
            logger.debug(
                f"[RouteRegistry] 交集匹配 {client_type_intersect} → 剩余 {len(candidates)} 个候选"
            )

        # 2. 子集匹配（subset）：客户端的所有标签必须是指定集合的子集
        if client_type_subset and candidates:
            subset_set = set(client_type_subset)
            matched = set()
            for socket in candidates:
                client_types = set(self._socket_info[socket]["client_type"] or [])
                # 检查是否是子集
                if client_types.issubset(subset_set):
                    matched.add(socket)
            candidates = matched
            logger.debug(
                f"[RouteRegistry] 子集匹配 {client_type_subset} → 剩余 {len(candidates)} 个候选"
            )

        # 3. 排除匹配（exclude）：不能包含任何排除标签
        if client_type_exclude and candidates:
            exclude_set = set(client_type_exclude)
            matched = set()
            for socket in candidates:
                client_types = set(self._socket_info[socket]["client_type"] or [])
                # 检查是否有交集（如果有，则排除）
                if not client_types.intersection(exclude_set):
                    matched.add(socket)
            candidates = matched
            logger.debug(
                f"[RouteRegistry] 排除匹配 {client_type_exclude} → 剩余 {len(candidates)} 个候选"
            )

        result = list(candidates)
        logger.info(
            f"[RouteRegistry] 逻辑匹配完成: "
            f"intersect={client_type_intersect}, subset={client_type_subset}, "
            f"exclude={client_type_exclude} → {len(result)} 个目标"
        )
        return result

    def unregister(self, socket: QWebSocket) -> bool:
        """
        注销客户端，清理所有路由映射

        Args:
            socket: 要注销的 WebSocket 连接对象

        Returns:
            True 如果成功注销，False 如果 socket 未注册

        Note:
            此方法会清理：
            - _by_client_id 中的精确路由
            - _by_type 中的类型路由
            - _by_resource 中的资源路由
            - _socket_info 中的反向映射
        """
        if socket not in self._socket_info:
            logger.warning(f"[RouteRegistry] 尝试注销未注册的 socket: {socket}")
            return False

        # 获取客户端信息
        info = self._socket_info[socket]
        client_id = info["client_id"]
        client_type = info["client_type"]
        routing_keys = info["routing_keys"]

        # 1. 清理精确路由
        if client_id in self._by_client_id:
            del self._by_client_id[client_id]
            logger.debug(f"[RouteRegistry] 清理精确路由: {client_id}")

        # 2. 清理类型路由（支持多标签）
        if client_type:
            for tag in client_type:
                if tag in self._by_type:
                    self._by_type[tag].discard(socket)
                    # 如果集合为空，删除该类型标签
                    if not self._by_type[tag]:
                        del self._by_type[tag]
                        logger.debug(f"[RouteRegistry] 清理类型标签（空集合）: {tag}")
                    else:
                        logger.debug(f"[RouteRegistry] 从类型标签移除 socket: {tag}")

        # 3. 清理资源路由
        for key in routing_keys:
            if key in self._by_resource:
                self._by_resource[key].discard(socket)
                # 如果集合为空，删除该资源键
                if not self._by_resource[key]:
                    del self._by_resource[key]
                    logger.debug(f"[RouteRegistry] 清理资源路由（空集合）: {key}")
                else:
                    logger.debug(f"[RouteRegistry] 从资源路由移除 socket: {key}")

        # 4. 清理反向映射
        del self._socket_info[socket]

        logger.info(
            f"[RouteRegistry] 客户端注销成功: client_id={client_id}, "
            f"client_type={client_type}, routing_keys={routing_keys}"
        )
        return True

    def unregister_by_client_id(self, client_id: str) -> bool:
        """
        按 client_id 注销客户端，作为 unregister(socket) 的补充路径。

        典型场景：
        - 浏览器端在重新连接前仅能提供 client_id，而无法持有原来的 QWebSocket 对象；
        - 为避免 RouteRegistry 中残留“僵尸”条目，允许通过 client_id 做一次补偿性清理。

        Args:
            client_id: 要注销的客户端 ID。

        Returns:
            True 如果找到该 client_id 并成功注销，False 如果未找到对应条目。
        """
        cid = (client_id or "").strip()
        if not cid:
            raise ValueError("RouteRegistry.unregister_by_client_id: client_id 不能为空")

        socket = self._by_client_id.get(cid)
        if socket is None:
            logger.warning("[RouteRegistry] 按 client_id 注销时未找到条目: client_id=%s", cid)
            return False

        return self.unregister(socket)

    def get_client_info(self, socket: QWebSocket) -> Optional[dict]:
        """
        获取客户端路由信息

        Args:
            socket: WebSocket 连接对象

        Returns:
            客户端信息字典，如果未注册则返回 None
            字典包含: client_id, client_type, routing_keys
        """
        return self._socket_info.get(socket)

    def has_client(self, client_id: str) -> bool:
        """
        检查 client_id 是否已注册

        Args:
            client_id: 客户端唯一标识

        Returns:
            True 如果已注册，False 如果未注册
        """
        return client_id in self._by_client_id

    def get_all_clients(self) -> List[dict]:
        """
        获取所有已注册客户端的信息列表

        Returns:
            客户端信息列表，每个元素包含: client_id, client_type, routing_keys
        """
        return [
            {
                "client_id": info["client_id"],
                "client_type": info["client_type"],
                "routing_keys": info["routing_keys"],
            }
            for info in self._socket_info.values()
        ]

    def get_stats(self) -> dict:
        """
        获取路由表统计信息（用于调试和监控）

        Returns:
            统计信息字典，包含：
            - total_clients: 总客户端数
            - by_type: 各类型客户端数量
            - by_resource: 各资源订阅者数量
        """
        return {
            "total_clients": len(self._socket_info),
            "by_type": {
                client_type: len(sockets)
                for client_type, sockets in self._by_type.items()
            },
            "by_resource": {
                key: len(sockets)
                for key, sockets in self._by_resource.items()
            },
        }
