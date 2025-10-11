#!/usr/bin/env python3
"""
验证1: 数据库层独立验证
验证 JSON 文件包含7个新字段，且默认值正确

功能ID: 20251002003053-pdf-record-fields-extension
"""

import json
from pathlib import Path

# 验证的7个新字段（tags 已存在，实际新增6个）
REQUIRED_FIELDS = {
    'last_accessed_at': 0,
    'review_count': 0,
    'rating': 0,
    'tags': [],
    'is_visible': True,
    'total_reading_time': 0,
    'due_date': 0
}

def verify_database():
    """
    验证数据库层（JSON文件）

    Returns:
        bool: 验证通过返回 True，失败返回 False
    """
    json_path = Path(__file__).parent.parent.parent.parent / 'data' / 'pdf_files.json'

    if not json_path.exists():
        print(f'❌ 错误: 文件不存在 {json_path}')
        return False

    print(f'📁 正在验证: {json_path}\n')

    # 读取JSON
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print('✓ JSON 文件格式正确（可被 json.load 解析）')
    except Exception as e:
        print(f'❌ JSON 解析失败: {e}')
        return False

    files = data.get('files', {})
    if not files:
        print('❌ 没有PDF记录')
        return False

    print(f'✓ 记录总数: {len(files)}\n')

    # 验证每条记录
    all_passed = True
    for file_id, record in files.items():
        # 验证所有字段存在
        missing_fields = []
        for field in REQUIRED_FIELDS.keys():
            if field not in record:
                missing_fields.append(field)
                all_passed = False

        if missing_fields:
            print(f'❌ 记录 {file_id[:8]}: 缺失字段 {missing_fields}')
            continue

        # 验证默认值
        for field, expected_value in REQUIRED_FIELDS.items():
            actual_value = record[field]
            # tags 可能非空，跳过
            if field == 'tags':
                continue
            if actual_value != expected_value:
                print(f'❌ 记录 {file_id[:8]}: {field} 默认值错误（应为 {expected_value}，实为 {actual_value}）')
                all_passed = False

    if all_passed:
        print('='*60)
        print('✅ 验证1通过: 数据库层验证成功')
        print('='*60)
        print(f'✓ 所有记录都包含 7 个新字段')
        print(f'✓ 默认值符合规格（0, [], True）')
        print(f'✓ JSON 文件格式正确')
    else:
        print('\n❌ 验证失败')

    return all_passed

if __name__ == '__main__':
    print('='*60)
    print('验证1: 数据库层独立验证')
    print('='*60)
    print()

    success = verify_database()
    exit(0 if success else 1)
