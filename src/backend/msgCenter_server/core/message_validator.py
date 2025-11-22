"""
MsgCenter 消息验证器

负责校验 to 字段格式和路由决策

Author: Claude Code
Date: 2025-01-16
"""
from typing import Dict, Any, List, Optional


def validate_to_field(message: dict) -> dict:
    """
    校验 to 字段格式

    规则：
    1. to 必须存在（注册消息除外）
    2. to 只能是字符串 "backend" 或列表
    3. 列表中每个元素必须是字典，且包含 client_id 或 routing_key

    Args:
        message: 完整的消息字典

    Returns:
        {
            "valid": True/False,
            "route_action": "backend" | "forward" | "register" | None,
            "routing_targets": [{"client_id": "...", "routing_key": "...", "target_type": "..."}],
            "error": str  # valid=False 时返回
        }

    Examples:
        >>> # 后端消息
        >>> msg = {"type": "pdf-library:list:requested", "to": "backend"}
        >>> result = validate_to_field(msg)
        >>> result["valid"]
        True
        >>> result["route_action"]
        'backend'

        >>> # 窗口消息（单目标）
        >>> msg = {
        ...     "type": "pdf-viewer:navigate:requested",
        ...     "to": [{"client_id": "pdf-viewer-sample"}]
        ... }
        >>> result = validate_to_field(msg)
        >>> result["valid"]
        True
        >>> result["route_action"]
        'forward'
        >>> len(result["routing_targets"])
        1

        >>> # 窗口消息（多目标）
        >>> msg = {
        ...     "type": "pdf-viewer:navigate:requested",
        ...     "to": [
        ...         {"client_id": "pdf-viewer-sample"},
        ...         {"routing_key": "pdf:test", "target_type": "pdf-viewer"}
        ...     ]
        ... }
        >>> result = validate_to_field(msg)
        >>> len(result["routing_targets"])
        2
    """
    msg_type = message.get("type")
    to = message.get("to")

    # ========== 白名单：注册/取消注册消息禁止包含 to ==========
    # 注意：pdf-viewer:register:requested 已在 standard_server.py 中自动转换为 client:register:requested
    REGISTER_MESSAGES = [
        "client:register:requested",
        "client:unregister:requested",  # 客户端取消注册（窗口关闭时）
    ]

    if msg_type in REGISTER_MESSAGES:
        if to is not None:
            return {
                "valid": False,
                "error": f"注册/取消注册消息禁止包含 to 字段（type={msg_type}）"
            }
        # 根据消息类型返回不同的路由动作
        route_action = "unregister" if msg_type == "client:unregister:requested" else "register"
        return {
            "valid": True,
            "route_action": route_action
        }

    # ========== 必填检查 ==========
    if to is None:
        return {
            "valid": False,
            "error": f"缺少 to 字段（type={msg_type}）"
        }

    # ========== 类型1：后端消息（字符串） ==========
    if isinstance(to, str):
        if to == "backend":
            return {
                "valid": True,
                "route_action": "backend"
            }
        else:
            return {
                "valid": False,
                "error": f"to 字符串只能是 'backend'，当前值: '{to}'"
            }

    # ========== 类型2：窗口消息（列表） ==========
    if isinstance(to, list):
        if len(to) == 0:
            return {
                "valid": False,
                "error": "to 列表不能为空"
            }

        # 验证列表中每个元素
        routing_targets = []
        for i, target_dict in enumerate(to):
            # 检查类型
            if not isinstance(target_dict, dict):
                return {
                    "valid": False,
                    "error": f"to[{i}] 必须是字典类型，当前类型: {type(target_dict).__name__}"
                }

            # 提取路由字段
            client_id = target_dict.get("client_id")
            routing_key = target_dict.get("routing_key")
            target_type = target_dict.get("target_type")

            # 至少需要 client_id 或 routing_key
            if not (client_id or routing_key):
                return {
                    "valid": False,
                    "error": f"to[{i}] 必须包含 client_id 或 routing_key（当前: {target_dict}）"
                }

            routing_targets.append({
                "client_id": client_id,
                "routing_key": routing_key,
                "target_type": target_type
            })

        return {
            "valid": True,
            "route_action": "forward",
            "routing_targets": routing_targets
        }

    # ========== 其他类型：拒绝 ==========
    return {
        "valid": False,
        "error": f"to 字段类型错误：必须是字符串 'backend' 或列表，当前类型: {type(to).__name__}"
    }


if __name__ == "__main__":
    # 简单的测试用例
    import json

    print("=== 测试消息验证器 ===\n")

    # 测试1：后端消息
    msg1 = {"type": "pdf-library:list:requested", "to": "backend"}
    result1 = validate_to_field(msg1)
    print(f"测试1（后端消息）: {json.dumps(result1, indent=2, ensure_ascii=False)}\n")

    # 测试2：窗口消息（单目标）
    msg2 = {
        "type": "pdf-viewer:navigate:requested",
        "to": [{"client_id": "pdf-viewer-sample"}]
    }
    result2 = validate_to_field(msg2)
    print(f"测试2（窗口消息-单目标）: {json.dumps(result2, indent=2, ensure_ascii=False)}\n")

    # 测试3：窗口消息（多目标）
    msg3 = {
        "type": "pdf-viewer:navigate:requested",
        "to": [
            {"client_id": "pdf-viewer-sample"},
            {"routing_key": "pdf:test", "target_type": "pdf-viewer"}
        ]
    }
    result3 = validate_to_field(msg3)
    print(f"测试3（窗口消息-多目标）: {json.dumps(result3, indent=2, ensure_ascii=False)}\n")

    # 测试4：缺少 to 字段
    msg4 = {"type": "pdf-library:list:requested"}
    result4 = validate_to_field(msg4)
    print(f"测试4（缺少to）: {json.dumps(result4, indent=2, ensure_ascii=False)}\n")

    # 测试5：注册消息
    msg5 = {"type": "client:register:requested"}
    result5 = validate_to_field(msg5)
    print(f"测试5（注册消息）: {json.dumps(result5, indent=2, ensure_ascii=False)}\n")
