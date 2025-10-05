"""PDFInfoTablePlugin 测试样例数据"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Iterable, List
import time


_BASE_SAMPLE: Dict[str, Any] = {
    'uuid': '0c251de0e2ac',
    'title': 'Sample PDF',
    'author': 'Test Author',
    'page_count': 10,
    'file_size': 1024000,
    'created_at': lambda: int(time.time() * 1000),
    'updated_at': lambda: int(time.time() * 1000),
    'visited_at': 0,
    'version': 1,
    'json_data': {
        'filename': '0c251de0e2ac.pdf',
        'filepath': '/data/pdfs/0c251de0e2ac.pdf',
        'subject': 'Test Subject',
        'keywords': 'test, pdf',
        'thumbnail_path': None,
        'tags': ['test', 'python'],
        'notes': 'Initial note',
        'last_accessed_at': 0,
        'review_count': 0,
        'rating': 3,
        'is_visible': True,
        'total_reading_time': 0,
        'due_date': 0
    }
}


def make_pdf_info_sample(**overrides: Any) -> Dict[str, Any]:
    """生成单条 PDF 信息样例。"""
    sample = {}
    for key, value in _BASE_SAMPLE.items():
        if callable(value):
            sample[key] = value()
        elif isinstance(value, dict):
            sample[key] = deepcopy(value)
        else:
            sample[key] = deepcopy(value)

    # 深度覆盖 json_data
    json_overrides = overrides.pop('json_data', {})
    if json_overrides:
        sample['json_data'].update(json_overrides)

    sample.update(overrides)
    return sample


def make_bulk_samples(count: int = 3) -> List[Dict[str, Any]]:
    """生成多条样例数据，uuid 与标题递增。"""
    items: List[Dict[str, Any]] = []
    for idx in range(count):
        uuid_suffix = f"{idx:02d}"
        base_uuid = _BASE_SAMPLE['uuid'][:-2] + uuid_suffix
        sample = make_pdf_info_sample(
            uuid=base_uuid,
            title=f"Sample PDF {idx}",
            json_data={
                'filename': f"{base_uuid}.pdf",
                'filepath': f"/data/pdfs/{base_uuid}.pdf",
                'tags': ['python', f'tag{idx}'],
                'rating': idx % 5,
                'is_visible': idx % 2 == 0,
                'total_reading_time': idx * 120,
                'review_count': idx,
            }
        )
        items.append(sample)
    return items


def apply_overrides(items: Iterable[Dict[str, Any]], **overrides: Any) -> List[Dict[str, Any]]:
    """批量覆盖字段，便于测试。"""
    result: List[Dict[str, Any]] = []
    for item in items:
        new_item = deepcopy(item)
        json_overrides = overrides.get('json_data')
        if json_overrides:
            new_item['json_data'].update(json_overrides)
        for key, value in overrides.items():
            if key != 'json_data':
                new_item[key] = deepcopy(value)
        result.append(new_item)
    return result
