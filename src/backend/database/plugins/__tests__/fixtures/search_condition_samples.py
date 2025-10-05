"""SearchConditionTablePlugin 测试样例数据"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List
import time


_BASE_FUZZY: Dict[str, Any] = {
    'uuid': 'sc-1728123456789-abc123',
    'name': '模糊搜索',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'description': '搜索含有Python的条目',
        'condition': {
            'type': 'fuzzy',
            'keywords': ['Python', 'AI'],
            'searchFields': ['title', 'tags'],
            'matchMode': 'any'
        },
        'use_count': 3,
        'last_used_at': 0,
        'sort_config': {
            'mode': 0
        }
    }
}

_BASE_FIELD: Dict[str, Any] = {
    'uuid': 'sc-1728123456790-def456',
    'name': '按作者筛选',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'description': '作者为张三的文档',
        'condition': {
            'type': 'field',
            'field': 'author',
            'operator': 'eq',
            'value': '张三'
        },
        'use_count': 1,
        'last_used_at': 0,
        'sort_config': {
            'mode': 1,
            'manual_order': ['uuid-1', 'uuid-2']
        }
    }
}

_BASE_COMPOSITE: Dict[str, Any] = {
    'uuid': 'sc-1728123456791-ghi789',
    'name': '组合筛选',
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'version': 1,
    'json_data': {
        'description': '标签+评分组合',
        'condition': {
            'type': 'composite',
            'operator': 'AND',
            'conditions': [
                {
                    'type': 'field',
                    'field': 'rating',
                    'operator': 'gte',
                    'value': 4
                },
                {
                    'type': 'field',
                    'field': 'tags',
                    'operator': 'has_tag',
                    'value': '机器学习'
                }
            ]
        },
        'use_count': 0,
        'last_used_at': 0,
        'sort_config': {
            'mode': 2,
            'multi_sort': [
                {'field': 'rating', 'direction': 'desc'},
                {'field': 'updated_at', 'direction': 'desc'}
            ]
        }
    }
}


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


_DEF_TYPES = {
    'fuzzy': _BASE_FUZZY,
    'field': _BASE_FIELD,
    'composite': _BASE_COMPOSITE,
}


def make_search_condition_sample(kind: str = 'fuzzy', **overrides: Any) -> Dict[str, Any]:
    if kind not in _DEF_TYPES:
        raise ValueError(f'Unsupported search condition kind: {kind}')
    sample = _materialize(_DEF_TYPES[kind])

    json_overrides = overrides.pop('json_data', {})
    if json_overrides:
        for key, value in json_overrides.items():
            if isinstance(value, dict) and key in sample['json_data'] and isinstance(sample['json_data'][key], dict):
                sample['json_data'][key].update(value)
            else:
                sample['json_data'][key] = deepcopy(value)

    for key, value in overrides.items():
        sample[key] = deepcopy(value)

    return sample


def make_sequence(count: int, base_timestamp: int = 1728123470000) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for idx in range(count):
        uuid = f'sc-{base_timestamp + idx}-seq{idx:02d}'
        sample = make_search_condition_sample(
            kind='fuzzy',
            uuid=uuid,
            name=f'搜索集合{idx}',
            json_data={
                'description': f'批量样例{idx}',
                'condition': {
                    'type': 'field',
                    'field': 'rating',
                    'operator': 'gte',
                    'value': idx
                },
                'use_count': idx
            }
        )
        items.append(sample)
    return items
