# -*- coding: utf-8 -*-
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List

from .error_models import StandardErrorData
from .error_logging import StandardLogFileManager


class StandardErrorAnalyzer:
    """标准错误分析器"""

    def __init__(self, log_manager: StandardLogFileManager):
        self.log_manager = log_manager

    def analyze_error(self, error: StandardErrorData) -> Dict[str, Any]:
        """分析单个错误（标准格式）"""
        analysis = {
            "error_id": str(uuid.uuid4()),
            "original_error": error.dict(),
            "severity": self._calculate_severity(error),
            "category": self._categorize_error(error),
            "suggested_fix": self._suggest_fix(error),
            "similar_patterns": self._find_similar_patterns(error),
            "impact_assessment": self._assess_impact(error),
            "timestamp": int(time.time() * 1000),
        }
        return analysis

    def _calculate_severity(self, error: StandardErrorData) -> str:
        """计算错误严重程度"""
        if error.type in ["javascript_error", "promise_rejection"]:
            if "TypeError" in (error.message or "") or "ReferenceError" in (error.message or ""):
                return "critical"
            return "high"
        elif error.type == "resource_error":
            return "medium"
        elif error.type == "warning":
            return "low"
        else:
            return "medium"

    def _categorize_error(self, error: StandardErrorData) -> str:
        """分类错误"""
        message = (error.message or "").lower()
        if "undefined" in message or "null" in message:
            return "null_reference"
        elif "network" in message or "fetch" in message:
            return "network_error"
        elif "permission" in message or "access" in message:
            return "permission_error"
        elif "timeout" in message:
            return "timeout_error"
        elif "validation" in message or "invalid" in message:
            return "validation_error"
        else:
            return "general_error"

    def _suggest_fix(self, error: StandardErrorData) -> List[str]:
        """提供修复建议"""
        suggestions: List[str] = []
        category = self._categorize_error(error)
        if category == "null_reference":
            suggestions.extend(["检查变量是否已正确初始化", "添加空值检查", "使用可选链操作符 (?.)"])
        elif category == "network_error":
            suggestions.extend(["检查网络连接", "验证API端点URL", "添加重试机制"])
        elif category == "permission_error":
            suggestions.extend(["检查文件/目录权限", "验证用户权限", "确保服务已正确配置"])
        elif category == "timeout_error":
            suggestions.extend(["增加超时时间", "优化查询性能", "检查网络延迟"])
        else:
            suggestions.extend(["检查错误堆栈信息", "验证输入数据", "查看相关文档"])
        return suggestions

    def _find_similar_patterns(self, _error: StandardErrorData) -> List[Dict[str, Any]]:
        """查找相似的错误模式（占位）"""
        return []

    def _assess_impact(self, error: StandardErrorData) -> Dict[str, Any]:
        """评估错误影响"""
        return {
            "user_impact": "high" if (error.level or "") in ["critical", "high"] else "low",
            "system_impact": "medium",
            "business_impact": "low",
            "affected_users": 1,
            "recovery_time": "immediate",
        }

