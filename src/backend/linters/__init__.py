"""
自定义 Pylint 检查器包

包含的检查器：
- TableEventStringLiteralChecker: 禁止在 EventBus 中使用字符串字面量

创建日期: 2025-11-10
"""

from .table_event_lint_checker import PYLINT_AVAILABLE

if PYLINT_AVAILABLE:
    from .table_event_lint_checker import TableEventStringLiteralChecker
    __all__ = ['TableEventStringLiteralChecker']
else:
    __all__ = []
