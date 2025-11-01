# -*- coding: utf-8 -*-
"""
PDF Annotation 数据校验与规范化（纯函数）
从原 PDFAnnotationTablePlugin 中抽出，便于单测与复用。
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from ...exceptions import DatabaseValidationError

_UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
_ANN_ID_PATTERN = re.compile(r'^ann_[0-9]{6,}_[0-9a-zA-Z]{6}$')
_ANN_ID_NEW_PATTERN = re.compile(r'^pdfannotation-[A-Za-z0-9_-]{16}$')
_MD5_PATTERN = re.compile(r"^[a-f0-9]{32}$")
_HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
_ALLOWED_TYPES = {"screenshot", "text-highlight", "comment"}


def validate_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if data is None:
        raise DatabaseValidationError("data is required")

    normalized: Dict[str, Any] = {}

    ann_id = data.get('ann_id')
    normalized['ann_id'] = _validate_ann_id(ann_id)

    pdf_uuid = data.get('pdf_uuid')
    normalized['pdf_uuid'] = _validate_pdf_uuid(pdf_uuid)

    page_number = data.get('page_number')
    normalized['page_number'] = _validate_positive_int(page_number, 'page_number')

    ann_type = data.get('type')
    if ann_type not in _ALLOWED_TYPES:
        raise DatabaseValidationError(
            f"type must be one of {sorted(_ALLOWED_TYPES)}"
        )
    normalized['type'] = ann_type

    normalized['created_at'] = _validate_timestamp(data.get('created_at'), 'created_at')
    normalized['updated_at'] = _validate_timestamp(data.get('updated_at'), 'updated_at')

    version = data.get('version', 1)
    version_int = _validate_positive_int(version, 'version')
    if version_int < 1:
        raise DatabaseValidationError('version must be >= 1')
    normalized['version'] = version_int

    json_data = data.get('json_data', {})
    if isinstance(json_data, str):
        try:
            json_data = json.loads(json_data)
        except json.JSONDecodeError as exc:
            raise DatabaseValidationError('json_data must be valid JSON') from exc
    if not isinstance(json_data, dict):
        raise DatabaseValidationError('json_data must be a dict')

    payload = json_data.get('data')
    if not isinstance(payload, dict):
        raise DatabaseValidationError('json_data.data must be an object')

    comments = json_data.get('comments', [])
    validated_comments = _validate_comments(comments)

    if ann_type == 'screenshot':
        validated_payload = _validate_screenshot_payload(payload)
    elif ann_type == 'text-highlight':
        validated_payload = _validate_text_highlight_payload(payload)
    else:
        validated_payload = _validate_comment_payload(payload)

    normalized['json_data'] = {
        'data': validated_payload,
        'comments': validated_comments
    }

    return normalized


def _validate_ann_id(value: Any) -> str:
    if not value:
        raise DatabaseValidationError('ann_id is required')
    if not isinstance(value, str):
        raise DatabaseValidationError('ann_id must be a string')
    if not (_ANN_ID_PATTERN.fullmatch(value) or _ANN_ID_NEW_PATTERN.fullmatch(value)):
        raise DatabaseValidationError('ann_id must match pattern ann_<timestamp>_<random> or pdfannotation-<base64url16>')
    return value


def _validate_pdf_uuid(value: Any) -> str:
    if not value:
        raise DatabaseValidationError('pdf_uuid is required')
    if not isinstance(value, str):
        raise DatabaseValidationError('pdf_uuid must be a string')
    if not _UUID_PATTERN.fullmatch(value):
        raise DatabaseValidationError('pdf_uuid must be 12 hex characters')
    return value


def _validate_positive_int(value: Any, field: str) -> int:
    try:
        num = int(value)
    except (TypeError, ValueError):
        raise DatabaseValidationError(f'{field} must be a positive integer')
    if num <= 0:
        raise DatabaseValidationError(f'{field} must be greater than 0')
    return num


def _validate_timestamp(value: Any, field: str) -> int:
    if value is None:
        raise DatabaseValidationError(f'{field} is required')
    try:
        num = int(value)
    except (TypeError, ValueError):
        raise DatabaseValidationError(f'{field} must be a non-negative integer')
    if num < 0:
        raise DatabaseValidationError(f'{field} must be a non-negative integer')
    return num


def _validate_non_negative_number(value: Any, field: str) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise DatabaseValidationError(f'{field} must be a non-negative number')
    if num < 0:
        raise DatabaseValidationError(f'{field} must be a non-negative number')
    return num


def _validate_positive_number(value: Any, field: str) -> float:
    num = _validate_non_negative_number(value, field)
    if num <= 0:
        raise DatabaseValidationError(f'{field} must be greater than 0')
    return num


def _validate_screenshot_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    # 严格模式：要求 rectPercent
    rect_percent = payload.get('rectPercent')
    if not isinstance(rect_percent, dict):
        raise DatabaseValidationError('rectPercent is required')

    def clamp01pct(v: Any, field: str) -> float:
        num = _validate_non_negative_number(v, field)
        if num > 100:
            num = 100.0
        return num

    validated_rect_percent = {
        'xPercent': clamp01pct(rect_percent.get('xPercent'), 'rectPercent.xPercent'),
        'yPercent': clamp01pct(rect_percent.get('yPercent'), 'rectPercent.yPercent'),
        'widthPercent': clamp01pct(rect_percent.get('widthPercent'), 'rectPercent.widthPercent'),
        'heightPercent': clamp01pct(rect_percent.get('heightPercent'), 'rectPercent.heightPercent'),
    }

    image_path = payload.get('imagePath')
    if not isinstance(image_path, str) or not image_path.strip():
        raise DatabaseValidationError('imagePath must be a non-empty string')

    image_hash = payload.get('imageHash')
    if not isinstance(image_hash, str) or not _MD5_PATTERN.fullmatch(image_hash):
        raise DatabaseValidationError('imageHash must be 32 hex characters')

    image_data = payload.get('imageData')
    if image_data is not None:
        if not isinstance(image_data, str) or not image_data.startswith('data:image/'):
            raise DatabaseValidationError('imageData must be base64 data URI')

    description = payload.get('description')
    if description is not None and not isinstance(description, str):
        raise DatabaseValidationError('description must be a string')

    canvas_pixel_size = payload.get('canvasPixelSize')
    validated_canvas_pixel_size = None
    if canvas_pixel_size is not None:
        if not isinstance(canvas_pixel_size, dict):
            raise DatabaseValidationError('canvasPixelSize must be an object')
        w = _validate_positive_number(canvas_pixel_size.get('width'), 'canvasPixelSize.width')
        h = _validate_positive_number(canvas_pixel_size.get('height'), 'canvasPixelSize.height')
        validated_canvas_pixel_size = {'width': w, 'height': h}

    marker_color = payload.get('markerColor')
    if marker_color is not None:
        if not isinstance(marker_color, str) or not _HEX_COLOR_PATTERN.fullmatch(marker_color):
            raise DatabaseValidationError('markerColor must be a HEX color (#rrggbb)')

    result = {
        'rectPercent': validated_rect_percent,
        'imagePath': image_path,
        'imageHash': image_hash,
    }
    if image_data is not None:
        result['imageData'] = image_data
    if description is not None:
        result['description'] = description
    if validated_canvas_pixel_size is not None:
        result['canvasPixelSize'] = validated_canvas_pixel_size
    if marker_color is not None:
        result['markerColor'] = marker_color
    return result


def _validate_text_highlight_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    selected = payload.get('selectedText')
    if not isinstance(selected, str) or not selected.strip():
        raise DatabaseValidationError('selectedText must be a non-empty string')

    ranges = payload.get('textRanges')
    if not isinstance(ranges, list) or not ranges:
        raise DatabaseValidationError('textRanges must be a non-empty array')
    for idx, item in enumerate(ranges):
        if not isinstance(item, dict):
            raise DatabaseValidationError(f'textRanges[{idx}] must be an object')

    color = payload.get('highlightColor')
    if not isinstance(color, str) or not _HEX_COLOR_PATTERN.fullmatch(color):
        raise DatabaseValidationError('highlightColor must be a HEX color (#rrggbb)')

    note = payload.get('note')
    if note is not None and not isinstance(note, str):
        raise DatabaseValidationError('note must be a string')

    result = {
        'selectedText': selected,
        'textRanges': ranges,
        'highlightColor': color,
    }
    if note is not None:
        result['note'] = note
    return result


def _validate_comment_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    position = payload.get('position')
    if not isinstance(position, dict):
        raise DatabaseValidationError('position is required')
    validated_position = {
        'x': _validate_non_negative_number(position.get('x'), 'position.x'),
        'y': _validate_non_negative_number(position.get('y'), 'position.y'),
    }

    content = payload.get('content')
    if not isinstance(content, str) or not content.strip():
        raise DatabaseValidationError('content must be a non-empty string')

    result = {
        'position': validated_position,
        'content': content,
    }
    return result


def _validate_comments(comments: Any) -> List[Dict[str, Any]]:
    if comments is None:
        return []
    if not isinstance(comments, list):
        raise DatabaseValidationError('comments must be an array')

    normalized: List[Dict[str, Any]] = []
    for item in comments:
        if not isinstance(item, dict):
            raise DatabaseValidationError('each comment must be an object')
        if not all(key in item for key in ('id', 'content', 'createdAt')):
            raise DatabaseValidationError('each comment must contain id/content/createdAt')
        if not isinstance(item['id'], str) or not item['id'].strip():
            raise DatabaseValidationError('comment.id must be a non-empty string')
        if not isinstance(item['content'], str) or not item['content'].strip():
            raise DatabaseValidationError('comment.content must be a non-empty string')
        if not isinstance(item['createdAt'], str) or not item['createdAt'].strip():
            raise DatabaseValidationError('comment.createdAt must be a non-empty string')
        normalized.append({
            'id': item['id'],
            'content': item['content'],
            'createdAt': item['createdAt'],
        })
    return normalized
