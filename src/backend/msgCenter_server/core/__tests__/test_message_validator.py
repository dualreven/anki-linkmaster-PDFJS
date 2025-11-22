"""
MsgCenter 消息验证器单元测试

测试 validate_to_field() 函数的各种场景：
- 后端消息（to: "backend"）
- 窗口消息（to: [...]）
- 注册消息（禁止包含 to）
- 错误情况（无效格式、缺失字段等）

Author: Claude Code
Date: 2025-01-17
"""
import pytest
from src.backend.msgCenter_server.core.message_validator import validate_to_field


class TestBackendMessages:
    """测试后端消息（to: "backend"）"""

    def test_valid_backend_message(self):
        """合法的后端消息"""
        msg = {
            "type": "pdf-library:list:requested",
            "to": "backend"
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "backend"
        assert "error" not in result

    def test_invalid_backend_string(self):
        """非法的后端消息：to 字符串不是 'backend'"""
        msg = {
            "type": "pdf-library:list:requested",
            "to": "invalid"
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "backend" in result["error"]
        assert "invalid" in result["error"]

    def test_missing_to_field(self):
        """非法：缺少 to 字段（非注册消息）"""
        msg = {
            "type": "pdf-library:list:requested"
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "缺少 to 字段" in result["error"]


class TestWindowMessages:
    """测试窗口消息（to: [...]）"""

    def test_valid_single_target_with_client_id(self):
        """合法：单目标窗口消息（使用 client_id）"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {
                    "client_id": "pdf-viewer-sample",
                    "routing_key": "pdf:sample",
                    "target_type": "pdf-viewer"
                }
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "forward"
        assert len(result["routing_targets"]) == 1
        assert result["routing_targets"][0]["client_id"] == "pdf-viewer-sample"
        assert result["routing_targets"][0]["routing_key"] == "pdf:sample"
        assert result["routing_targets"][0]["target_type"] == "pdf-viewer"

    def test_valid_single_target_with_routing_key_only(self):
        """合法：单目标窗口消息（只使用 routing_key）"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {
                    "routing_key": "pdf:test",
                    "target_type": "pdf-viewer"
                }
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "forward"
        assert len(result["routing_targets"]) == 1
        assert result["routing_targets"][0]["client_id"] is None
        assert result["routing_targets"][0]["routing_key"] == "pdf:test"

    def test_valid_multiple_targets(self):
        """合法：多目标窗口消息"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {"client_id": "pdf-viewer-1"},
                {"routing_key": "pdf:sample", "target_type": "pdf-viewer"}
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "forward"
        assert len(result["routing_targets"]) == 2

    def test_invalid_empty_list(self):
        """非法：空列表"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": []
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "不能为空" in result["error"]

    def test_invalid_list_element_not_dict(self):
        """非法：列表元素不是字典"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": ["string", 123]
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "必须是字典类型" in result["error"]

    def test_invalid_dict_missing_identifiers(self):
        """非法：字典缺少 client_id 和 routing_key"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {"foo": "bar", "target_type": "pdf-viewer"}
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "client_id 或 routing_key" in result["error"]


class TestRegisterMessages:
    """测试注册消息（禁止包含 to 字段）"""

    def test_valid_client_register_without_to(self):
        """合法：客户端注册消息不包含 to"""
        msg = {
            "type": "client:register:requested"
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "register"
        assert "routing_targets" not in result

    def test_valid_viewer_register_without_to(self):
        """合法：PDF Viewer 注册消息不包含 to"""
        msg = {
            "type": "pdf-viewer:register:requested"
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["route_action"] == "register"

    def test_invalid_client_register_with_to(self):
        """非法：注册消息包含 to 字段"""
        msg = {
            "type": "client:register:requested",
            "to": "backend"
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "禁止包含 to 字段" in result["error"]

    def test_invalid_viewer_register_with_to(self):
        """非法：PDF Viewer 注册消息包含 to 字段"""
        msg = {
            "type": "pdf-viewer:register:requested",
            "to": [{"client_id": "test"}]
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "禁止包含 to 字段" in result["error"]


class TestInvalidTypes:
    """测试无效的 to 字段类型"""

    def test_to_as_integer(self):
        """非法：to 是整数"""
        msg = {
            "type": "pdf-library:list:requested",
            "to": 123
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "类型错误" in result["error"]

    def test_to_as_dict(self):
        """非法：to 是字典（旧协议格式，不再支持）"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": {"client_id": "test"}
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "类型错误" in result["error"]

    def test_to_as_none_for_non_register(self):
        """非法：to 是 None（对于非注册消息）"""
        msg = {
            "type": "pdf-library:list:requested",
            "to": None
        }
        result = validate_to_field(msg)

        assert result["valid"] is False
        assert "error" in result
        assert "缺少 to 字段" in result["error"]


class TestEdgeCases:
    """测试边界情况"""

    def test_optional_fields_in_routing_target(self):
        """边界：routing_target 中的可选字段"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {
                    "client_id": "pdf-viewer-1",
                    # routing_key 和 target_type 是可选的
                }
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert result["routing_targets"][0]["client_id"] == "pdf-viewer-1"
        assert result["routing_targets"][0]["routing_key"] is None
        assert result["routing_targets"][0]["target_type"] is None

    def test_list_with_mixed_identifiers(self):
        """边界：列表中混合使用不同的标识符"""
        msg = {
            "type": "pdf-viewer:navigate:requested",
            "to": [
                {"client_id": "viewer-1"},
                {"routing_key": "pdf:sample"},
                {"client_id": "viewer-2", "routing_key": "pdf:test", "target_type": "pdf-viewer"}
            ]
        }
        result = validate_to_field(msg)

        assert result["valid"] is True
        assert len(result["routing_targets"]) == 3
