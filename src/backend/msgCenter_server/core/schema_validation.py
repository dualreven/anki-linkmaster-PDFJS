import os
import json as _json
from typing import Dict, Any, Optional, Tuple, List

def validate_message_by_schema(message: Dict[str, Any], schema_root: Optional[str]) -> Tuple[bool, str, Optional[str]]:
    """
    使用本地 JSON Schema 对整条消息进行校验。
    返回 (ok, error_message, schema_path)。
    注意：仅对 *:requested 的三段式消息进行校验；找不到 schema 文件则放行。
    """
    try:
        if not schema_root or not os.path.isdir(schema_root):
            return True, "", None  # 无 schema 根目录则跳过
        msg_type = str(message.get("type", ""))
        parts = msg_type.split(":")
        if len(parts) != 3:
            return True, "", None  # 非三段式命名，交由上层处理
        domain, action, status = parts
        if status != "requested":
            return True, "", None  # 仅对请求做入站校验

        # 约定的模式：<domain>/v1/messages/<action>.request.schema.json
        schema_rel = os.path.join(domain, "v1", "messages", f"{action}.request.schema.json")
        schema_path = os.path.join(schema_root, schema_rel)
        if not os.path.isfile(schema_path):
            return True, "", schema_path  # 无 schema 文件则放行

        with open(schema_path, "r", encoding="utf-8") as f:
            schema_obj = _json.loads(f.read() or "{}")

        errors = _jsonschema_validate(message, schema_obj, path="$")
        if errors:
            return False, "; ".join(errors), schema_path
        return True, "", schema_path
    except Exception as e:
        return False, f"schema_exception: {e}", None


def _jsonschema_validate(instance, schema, *, path: str = "$") -> List[str]:
    """
    轻量 JSON Schema 校验器（支持本项目用到的子集）：
    - type（object/array/string/number/integer/boolean）
    - required
    - properties（递归）
    - const / enum
    - pattern（正则）
    - minimum / maximum（数值）
    - items（数组，递归）
    """
    errors: List[str] = []
    stype = schema.get("type")
    if stype:
        if stype == "object":
            if not isinstance(instance, dict):
                return [f"{path}: type should be object"]
            # required
            for req in schema.get("required", []):
                if req not in instance:
                    errors.append(f"{path}: missing required property '{req}'")
            # properties
            props = schema.get("properties", {}) or {}
            for key, prop_schema in props.items():
                if key in instance:
                    errors += _jsonschema_validate(instance[key], prop_schema, path=f"{path}.{key}")
        elif stype == "array":
            if not isinstance(instance, list):
                return [f"{path}: type should be array"]
            item_schema = schema.get("items")
            if item_schema:
                for idx, item in enumerate(instance):
                    errors += _jsonschema_validate(item, item_schema, path=f"{path}[{idx}]")
        elif stype == "string":
            if not isinstance(instance, str):
                return [f"{path}: type should be string"]
            if "pattern" in schema:
                import re as _re
                pat = schema["pattern"]
                if not _re.fullmatch(pat, instance):
                    errors.append(f"{path}: string does not match pattern {pat}")
            if "enum" in schema and instance not in schema["enum"]:
                errors.append(f"{path}: value not in enum {schema['enum']}")
            if "const" in schema and instance != schema["const"]:
                errors.append(f"{path}: value must equal const {schema['const']}")
        elif stype == "number":
            if not isinstance(instance, (int, float)):
                return [f"{path}: type should be number"]
            if "minimum" in schema and instance < schema["minimum"]:
                errors.append(f"{path}: number must be >= {schema['minimum']}")
            if "maximum" in schema and instance > schema["maximum"]:
                errors.append(f"{path}: number must be <= {schema['maximum']}")
        elif stype == "integer":
            if not isinstance(instance, int):
                return [f"{path}: type should be integer"]
            if "minimum" in schema and instance < schema["minimum"]:
                errors.append(f"{path}: integer must be >= {schema['minimum']}")
            if "maximum" in schema and instance > schema["maximum"]:
                errors.append(f"{path}: integer must be <= {schema['maximum']}")
        elif stype == "boolean":
            if not isinstance(instance, bool):
                return [f"{path}: type should be boolean"]
        else:
            # 其他类型暂不使用，直接跳过
            pass

    # const/enum 顶层（非字符串时）
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: value must equal const {schema['const']}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: value not in enum {schema['enum']}")
    return errors

