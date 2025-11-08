# -*- coding: utf-8 -*-
"""
集成测试用 Schema 定义（后端→前端记录的最小字段类型约束）
仅用于测试环境；不参与生产代码。
"""

PDF_RECORD_SCHEMA = {
    "id": str,
    "title": str,
    "author": str,
    "page_count": int,
    "file_size": int,
    "created_at": int,        # Unix 秒
    "updated_at": int,        # Unix 秒
    "last_accessed_at": int,  # Unix 秒
    "rating": int,
    "is_visible": bool,
    "tags": list,
    "file_path": str,
    "review_count": int,
    "total_reading_time": int,
    "due_date": int,          # Unix 秒
    # 可选字段（若存在应为如下类型）
    "subject": str,
    "keywords": str,
    "notes": str,
}

