"""PDFBookmarkTablePlugin 测试样例数据"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List
import time


def _materialize(record: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in record.items():
        if callable(value):
            result[key] = value()
        elif isinstance(value, dict):
            result[key] = deepcopy(value)
        else:
            result[key] = deepcopy(value)
    return result


_BASE_PAGE: Dict[str, Any] = {
    'bookmark_id': 'bookmark-1728123456789-abc123',
    'pdf_uuid': '0c251de0e2ac',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'name': '章节一',
        'type': 'page',
        'pageNumber': 3,
        'region': None,
        'children': [],
        'parentId': None,
        'order': 0,
    },
}

_BASE_REGION: Dict[str, Any] = {
    'bookmark_id': 'bookmark-1728123456790-def456',
    'pdf_uuid': '0c251de0e2ac',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'name': '重点段落',
        'type': 'region',
        'pageNumber': 5,
        'region': {
            'scrollX': 120.5,
            'scrollY': 340.0,
            'zoom': 1.25,
        },
        'children': [],
        'parentId': None,
        'order': 1,
    },
}


def make_bookmark_sample(kind: str = 'page', **overrides: Any) -> Dict[str, Any]:
    base = _BASE_REGION if kind == 'region' else _BASE_PAGE
    sample = _materialize(base)

    json_overrides = overrides.pop('json_data', {})
    if json_overrides:
        for key, value in json_overrides.items():
            if key == 'region' and value is None:
                sample['json_data']['region'] = None
            elif isinstance(value, dict) and key in ('region',):
                if sample['json_data'].get(key) is None:
                    sample['json_data'][key] = {}
                sample['json_data'][key].update(value)
            else:
                sample['json_data'][key] = deepcopy(value)

    for key, value in overrides.items():
        sample[key] = deepcopy(value)

    return sample


def make_tree_samples() -> Dict[str, Dict[str, Any]]:
    """构造一级父子结构样例。"""
    parent = make_bookmark_sample(
        kind='page',
        bookmark_id='bookmark-1728123457000-parent',
        json_data={'name': '父书签', 'order': 0}
    )
    child1 = make_bookmark_sample(
        kind='page',
        bookmark_id='bookmark-1728123457001-child1',
        json_data={'name': '子书签一', 'parentId': parent['bookmark_id'], 'order': 0}
    )
    child2 = make_bookmark_sample(
        kind='region',
        bookmark_id='bookmark-1728123457002-child2',
        json_data={
            'name': '子书签二',
            'parentId': parent['bookmark_id'],
            'order': 1,
            'region': {'scrollX': 10.0, 'scrollY': 20.0, 'zoom': 1.0},
        }
    )
    parent['json_data']['children'] = [
        {
            'bookmark_id': child1['bookmark_id'],
            'name': child1['json_data']['name'],
            'type': child1['json_data']['type'],
            'pageNumber': child1['json_data']['pageNumber'],
            'region': None,
            'children': [],
            'order': 0,
            'parentId': parent['bookmark_id'],
        },
        {
            'bookmark_id': child2['bookmark_id'],
            'name': child2['json_data']['name'],
            'type': child2['json_data']['type'],
            'pageNumber': child2['json_data']['pageNumber'],
            'region': child2['json_data']['region'],
            'children': [],
            'order': 1,
            'parentId': parent['bookmark_id'],
        },
    ]
    return {
        'parent': parent,
        'child1': child1,
        'child2': child2,
    }


def make_sequence(count: int, base_timestamp: int = 1728123460000) -> List[Dict[str, Any]]:
    """批量生成同级书签，order 递增。"""
    items: List[Dict[str, Any]] = []
    for idx in range(count):
        bookmark_id = f'bookmark-{base_timestamp + idx}-seq{idx:02d}'
        sample = make_bookmark_sample(
            kind='page',
            bookmark_id=bookmark_id,
            json_data={'name': f'节点{idx}', 'order': idx}
        )
        items.append(sample)
    return items
