# -*- coding: utf-8 -*-
"""
PDF Outline（原 bookmark）数据校验（纯函数）
与前端对齐：ID 可接受 outlineItem-xxxxxxxx 形式。
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from ...exceptions import DatabaseValidationError

_UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
_OUTLINE_ID_PATTERN = re.compile(r"^outlineItem-[A-Za-z0-9_-]{8}$")


def validate_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if data is None:
        raise DatabaseValidationError('data is required')

    normalized: Dict[str, Any] = {}

    # 严格键名：仅接受 outline_id（不再兼容 bookmark_id/outlineItemId）
    outline_id = data.get('outline_id')
    normalized['outline_id'] = _validate_outline_id(outline_id)

    pdf_uuid = data.get('pdf_uuid')
    normalized['pdf_uuid'] = _validate_pdf_uuid(pdf_uuid)

    normalized['created_at'] = _validate_timestamp(data.get('created_at'), 'created_at')
    normalized['updated_at'] = _validate_timestamp(data.get('updated_at'), 'updated_at')

    version = _validate_positive_int(data.get('version', 1), 'version')
    if version < 1:
        raise DatabaseValidationError('version must be >= 1')
    normalized['version'] = version

    json_data = data.get('json_data', {})
    if isinstance(json_data, str):
        try:
            json_data = json.loads(json_data)
        except json.JSONDecodeError as exc:
            raise DatabaseValidationError('json_data must be valid JSON') from exc
    if not isinstance(json_data, dict):
        raise DatabaseValidationError('json_data must be a dict')

    normalized['json_data'] = _validate_json_data(json_data)
    return normalized


def _validate_outline_id(value: Any) -> str:
    if not value:
        raise DatabaseValidationError('outline_id is required')
    if not isinstance(value, str) or not value.strip():
        raise DatabaseValidationError('outline_id must be a non-empty string')
    if not _OUTLINE_ID_PATTERN.fullmatch(value):
        raise DatabaseValidationError("outline_id must match 'outlineItem-<8>'")
    return value


def _validate_pdf_uuid(value: Any) -> str:
    if not value:
        raise DatabaseValidationError('pdf_uuid is required')
    if not isinstance(value, str):
        raise DatabaseValidationError('pdf_uuid must be a string')
    if not _UUID_PATTERN.fullmatch(value):
        raise DatabaseValidationError('pdf_uuid must be 12 hex characters')
    return value


def _validate_timestamp(value: Any, field: str) -> int:
    try:
        num = int(value)
    except (TypeError, ValueError):
        raise DatabaseValidationError(f'{field} must be an integer')
    if num < 0:
        raise DatabaseValidationError(f'{field} must be >= 0')
    return num


def _validate_positive_int(value: Any, field: str) -> int:
    try:
        num = int(value)
    except (TypeError, ValueError):
        raise DatabaseValidationError(f'{field} must be an integer')
    return num


def _validate_children(children: Any) -> List[Dict[str, Any]]:
    if children is None:
        return []
    if not isinstance(children, list):
        raise DatabaseValidationError('children must be a list')
    return [_validate_outline_object(child) for child in children]


def _validate_outline_object(node: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(node, dict):
        raise DatabaseValidationError('child outline must be an object')

    child_id = node.get('outline_id') or ''
    if child_id:
        _validate_outline_id(child_id)

    name = node.get('name')
    if not isinstance(name, str) or not name.strip():
        raise DatabaseValidationError('child outline name must be a non-empty string')

    # 兼容旧字段：pageNumber → pageAt
    page_at = node.get('pageAt') or node.get('pageNumber')
    try:
        page_at = int(page_at)
    except (TypeError, ValueError):
        raise DatabaseValidationError('child outline pageAt must be an integer')
    if page_at < 1:
        raise DatabaseValidationError('child outline pageAt must be >= 1')

    position_value = node.get('position', None)
    if position_value is not None:
        try:
            position_value = int(position_value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('child position must be an integer between 0 and 100')
        if position_value < 0 or position_value > 100:
            raise DatabaseValidationError('child position must be in range 0~100')
    else:
        position_value = None

    parent_id = node.get('parentId')
    if parent_id is not None and (not isinstance(parent_id, str) or not parent_id.strip()):
        raise DatabaseValidationError('child parentId must be string or null')

    order_value = node.get('order', 0)
    try:
        order_value = int(order_value)
    except (TypeError, ValueError):
        raise DatabaseValidationError('child order must be a non-negative integer')
    if order_value < 0:
        raise DatabaseValidationError('child order must be a non-negative integer')

    children = node.get('children', [])
    validated_children = _validate_children(children)

    return {
        'outline_id': child_id,
        'name': name,
        'pageAt': page_at,
        'position': position_value,
        'children': validated_children,
        'parentId': parent_id,
        'order': order_value,
    }


def _validate_json_data(json_data: Dict[str, Any]) -> Dict[str, Any]:
    name = json_data.get('name')
    if not isinstance(name, str) or not name.strip():
        raise DatabaseValidationError('name must be a non-empty string')

    # 兼容旧字段：pageNumber → pageAt
    page_at = json_data.get('pageAt') or json_data.get('pageNumber')
    try:
        page_at = int(page_at)
    except (TypeError, ValueError):
        raise DatabaseValidationError('pageAt must be an integer')
    if page_at < 1:
        raise DatabaseValidationError('pageAt must be >= 1')

    position_value = json_data.get('position', None)
    if position_value is not None:
        try:
            position_value = int(position_value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('position must be an integer between 0 and 100')
        if position_value < 0 or position_value > 100:
            raise DatabaseValidationError('position must be in range 0~100')
    else:
        position_value = None

    parent_id = json_data.get('parentId')
    if parent_id is not None and (not isinstance(parent_id, str) or not parent_id.strip()):
        raise DatabaseValidationError('parentId must be string or null')

    order_value = json_data.get('order', 0)
    try:
        order_value = int(order_value)
    except (TypeError, ValueError):
        raise DatabaseValidationError('order must be a non-negative integer')
    if order_value < 0:
        raise DatabaseValidationError('order must be a non-negative integer')

    region_obj = json_data.get('region', None)
    if region_obj is not None and not isinstance(region_obj, dict):
        raise DatabaseValidationError('region must be an object or null')

    children = json_data.get('children', [])
    validated_children = _validate_children(children)

    return {
        'name': name,
        'pageAt': page_at,
        'position': position_value,
        'region': region_obj,
        'children': validated_children,
        'parentId': parent_id,
        'order': order_value,
    }

