"""PDFAnnotationTablePlugin 测试样例数据"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List
import time


_BASE_SCREENSHOT: Dict[str, Any] = {
    'ann_id': 'ann_1728123456789_123456',
    'pdf_uuid': '0c251de0e2ac',
    'page_number': 1,
    'type': 'screenshot',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'data': {
            'rect': {'x': 10.5, 'y': 12.0, 'width': 120.0, 'height': 80.0},
            'imagePath': '/data/screenshots/ann_001.png',
            'imageHash': '0123456789abcdef0123456789abcdef',
            'description': '截图描述'
        },
        'comments': [
            {
                'id': 'comment_1728123456789_123456',
                'content': '第一条评论',
                'createdAt': '2025-10-05T08:30:00Z'
            }
        ]
    }
}

_BASE_TEXT_HIGHLIGHT: Dict[str, Any] = {
    'ann_id': 'ann_1728123456790_654321',
    'pdf_uuid': '0c251de0e2ac',
    'page_number': 2,
    'type': 'text-highlight',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'data': {
            'selectedText': '深度学习',
            'textRanges': [
                {
                    'startOffset': 10,
                    'endOffset': 15,
                    'startContainerPath': '1/0/0',
                    'endContainerPath': '1/0/0'
                }
            ],
            'highlightColor': '#ffcc00',
            'note': '重要概念'
        },
        'comments': []
    }
}

_BASE_COMMENT: Dict[str, Any] = {
    'ann_id': 'ann_1728123456791_999999',
    'pdf_uuid': '0c251de0e2ac',
    'page_number': 3,
    'type': 'comment',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'data': {
            'position': {'x': 50.0, 'y': 60.0},
            'content': '需要复习这一段'
        },
        'comments': []
    }
}


def _materialize(record: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in record.items():
        if callable(value):
            result[key] = value()
        else:
            result[key] = deepcopy(value)
    return result


def make_annotation_sample(ann_type: str = 'screenshot', **overrides: Any) -> Dict[str, Any]:
    """根据类型生成标注样例。"""
    base_map = {
        'screenshot': _BASE_SCREENSHOT,
        'text-highlight': _BASE_TEXT_HIGHLIGHT,
        'comment': _BASE_COMMENT,
    }
    if ann_type not in base_map:
        raise ValueError(f'Unsupported annotation type: {ann_type}')

    sample = _materialize(base_map[ann_type])

    json_overrides = overrides.pop('json_data', None)
    if json_overrides:
        if 'data' in json_overrides:
            sample['json_data']['data'].update(json_overrides['data'])
        if 'comments' in json_overrides:
            sample['json_data']['comments'] = deepcopy(json_overrides['comments'])

    for key, value in overrides.items():
        sample[key] = deepcopy(value)

    return sample


def make_multiple_annotations(count: int, ann_type: str = 'screenshot') -> List[Dict[str, Any]]:
    """批量生成标注数据，ann_id/page_number 递增。"""
    items: List[Dict[str, Any]] = []
    for idx in range(count):
        base = make_annotation_sample(
            ann_type=ann_type,
            ann_id=f'ann_1728000000{idx:02d}_{idx:06d}',
            page_number=idx + 1,
            json_data={'data': {'description': f'截图 {idx}'}}
        )
        items.append(base)
    return items
