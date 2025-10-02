"""
前后端消息格式定义（Schema）
用于验证消息格式的一致性
"""

# PDF 记录字段定义（后端格式 - snake_case）
PDF_RECORD_SCHEMA = {
    'id': str,
    'filename': str,
    'file_path': str,
    'file_size': int,
    'page_count': int,
    'created_at': int,
    'last_accessed_at': int,
    'review_count': int,
    'rating': int,
    'tags': list,
    'is_visible': bool,
    'total_reading_time': int,
    'due_date': int
}

# WebSocket 消息格式定义
WEBSOCKET_MESSAGE_SCHEMA = {
    'type': str,          # 消息类型
    'data': dict,         # 消息数据
    'request_id': str,    # 可选：请求ID
    'timestamp': int      # 可选：时间戳
}

# 前端到后端的消息类型
FRONTEND_TO_BACKEND_MESSAGES = {
    'pdf/list': {
        'data': {}  # 空对象
    },
    'pdf/add': {
        'data': {
            'file_paths': list  # 文件路径列表
        }
    },
    'pdf/remove': {
        'data': {
            'id': str,          # PDF ID（优先）
            'filename': str     # 文件名（备用）
        }
    },
    'pdf/open': {
        'data': {
            'id': str,          # PDF ID（优先）
            'filename': str     # 文件名（备用）
        }
    }
}

# 后端到前端的消息类型
BACKEND_TO_FRONTEND_MESSAGES = {
    'pdf/list': {
        'data': {
            'records': list  # PDF 记录列表
        }
    },
    'pdf/added': {
        'data': {
            'success': list,    # 成功添加的文件列表
            'failed': list,     # 失败的文件列表
            'summary': str      # 摘要信息
        }
    },
    'pdf/removed': {
        'data': {
            'success': bool,
            'message': str,
            'removed_id': str
        }
    },
    'success': {
        'data': {
            'message': str
        }
    },
    'error': {
        'data': {
            'message': str,
            'details': str  # 可选
        }
    }
}

# 字段命名规则验证
NAMING_RULES = {
    'backend': 'snake_case',  # 后端使用 snake_case
    'frontend_internal': 'camelCase',  # 前端内部可以用 camelCase
    'protocol': 'snake_case'  # 协议层统一使用 snake_case
}

# 时间戳格式
TIMESTAMP_FORMAT = {
    'unit': 'seconds',  # Unix 秒（不是毫秒）
    'example': 1696262400,  # 2023-10-02 12:00:00
    'range': (1000000000, 9999999999)  # 合理范围
}
