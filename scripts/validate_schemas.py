# -*- coding: utf-8 -*-
"""
轻量契约校验脚本
- 检查所有 JSON Schema 文件是否为有效 JSON 且包含关键字段
- 不依赖外部包，适用于本地与 CI 快速检查
使用：
  python scripts/validate_schemas.py
"""
from __future__ import annotations
import os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMAS_DIR = os.path.join(ROOT, 'todo-and-doing', '1 doing', '20251006182000-bus-contract-capability-registry', 'schemas')

REQUIRED_KEYS = ['title', 'type', 'properties']

errors = []
checked = 0

for base, _, files in os.walk(SCHEMAS_DIR):
    for fn in files:
        if not fn.endswith('.json'):
            continue
        path = os.path.join(base, fn)
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            for key in REQUIRED_KEYS:
                if key not in data:
                    errors.append(f"缺少关键字段 {key}: {rel}")
            if 'type' in data and data['type'] != 'object':
                errors.append(f"顶层type必须是object: {rel}")
            checked += 1
        except Exception as exc:
            errors.append(f"JSON解析失败: {rel}: {exc}")

if errors:
    print('Schema校验失败:')
    for e in errors:
        print(' -', e)
    sys.exit(1)
else:
    print(f'所有Schema通过（{checked} 个文件）')
    sys.exit(0)

