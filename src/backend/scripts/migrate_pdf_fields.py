#!/usr/bin/env python3
"""
PDF字段迁移脚本
为现有PDF记录添加7个新字段

功能ID: 20251002003053-pdf-record-fields-extension
版本: v001
"""

import json
from pathlib import Path
from datetime import datetime

# 新字段默认值（7个新字段）
DEFAULT_FIELDS = {
    'last_accessed_at': 0,
    'review_count': 0,
    'rating': 0,
    # 'tags': [],  # tags 字段已存在，不需要添加
    'is_visible': True,
    'total_reading_time': 0,
    'due_date': 0
}

def migrate_records():
    """
    迁移PDF记录，添加7个新字段

    Returns:
        bool: 迁移成功返回 True，失败返回 False
    """
    # 定位JSON文件（实际路径）
    json_path = Path(__file__).parent.parent.parent.parent / 'data' / 'pdf_files.json'

    if not json_path.exists():
        print(f'❌ 错误: 文件不存在 {json_path}')
        return False

    print(f'📁 正在读取: {json_path}')

    # 读取JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 备份原文件
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = json_path.with_suffix(f'.json.backup.{timestamp}')
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'✓ 已备份到: {backup_path}')

    # 迁移每条记录
    migrated_count = 0
    files = data.get('files', {})

    print(f'\n开始迁移 {len(files)} 条记录...\n')

    for file_id, record in files.items():
        for field, default_value in DEFAULT_FIELDS.items():
            if field not in record:
                record[field] = default_value
                migrated_count += 1
                print(f'  添加字段 {field} 到记录 {file_id[:8]}...')

    # 写回JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f'\n✓ 迁移完成: {len(files)} 条记录')
    print(f'✓ 新增字段数: {migrated_count}')
    print(f'✓ 每条记录添加: {len(DEFAULT_FIELDS)} 个字段')

    return True

if __name__ == '__main__':
    print('='*60)
    print('PDF字段扩展 - 数据迁移脚本')
    print('功能ID: 20251002003053-pdf-record-fields-extension')
    print('='*60)
    print()

    success = migrate_records()

    if success:
        print('\n✅ 迁移成功!')
    else:
        print('\n❌ 迁移失败!')

    exit(0 if success else 1)
