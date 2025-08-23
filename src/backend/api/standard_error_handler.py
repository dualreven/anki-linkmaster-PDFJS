"""
标准错误处理API - 基于JSON通信标准
"""

import os
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()

# 标准错误数据模型
class StandardErrorData(BaseModel):
    """标准错误数据模型"""
    type: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    timestamp: int = Field(..., description="时间戳（毫秒）")
    session_id: str = Field(..., description="会话ID")
    url: str = Field(..., description="发生错误的URL")
    user_agent: str = Field(..., description="用户代理")
    filename: Optional[str] = Field(None, description="文件名")
    lineno: Optional[int] = Field(None, description="行号")
    colno: Optional[int] = Field(None, description="列号")
    stack: Optional[str] = Field(None, description="错误堆栈")
    element: Optional[str] = Field(None, description="相关元素")
    source: Optional[str] = Field(None, description="错误源")
    arguments: Optional[List[Any]] = Field(None, description="函数参数")
    level: Optional[str] = Field("error", description="错误级别")
    component: Optional[str] = Field(None, description="组件名称")
    version: Optional[str] = Field(None, description="应用版本")

class StandardErrorBatch(BaseModel):
    """标准错误批次模型"""
    errors: List[StandardErrorData] = Field(..., description="错误列表")
    session_id: str = Field(..., description="会话ID")
    timestamp: int = Field(..., description="批次时间戳（毫秒）")
    count: int = Field(..., description="错误数量")

class StandardErrorResponse(BaseModel):
    """标准错误响应模型"""
    success: bool = Field(..., description="是否成功")
    request_id: str = Field(..., description="请求ID")
    timestamp: int = Field(..., description="响应时间戳（毫秒）")
    data: Optional[Dict[str, Any]] = Field(None, description="响应数据")
    error: Optional[Dict[str, Any]] = Field(None, description="错误信息")

class StandardLogFileManager:
    """标准日志文件管理器"""
    
    def __init__(self, log_dir: str = "logs/errors"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建不同类型的日志文件
        self.error_log_file = self.log_dir / "frontend_errors.log"
        self.session_log_file = self.log_dir / "sessions.log"
        self.stats_log_file = self.log_dir / "error_stats.log"
        self.analysis_log_file = self.log_dir / "error_analysis.log"
        
        # 创建按日期分区的日志文件
        current_date = datetime.now().strftime('%Y%m%d')
        self.current_error_log = self.log_dir / f"frontend_errors_{current_date}.log"
        self.current_session_log = self.log_dir / f"sessions_{current_date}.log"
        
    def log_error(self, error: StandardErrorData) -> Dict[str, Any]:
        """记录单个错误（标准格式）"""
        try:
            # 构建标准格式的错误条目
            error_entry = {
                "error_id": str(uuid.uuid4()),
                "timestamp": error.timestamp,
                "session_id": error.session_id,
                "type": error.type,
                "level": error.level,
                "message": error.message,
                "url": error.url,
                "filename": error.filename,
                "lineno": error.lineno,
                "colno": error.colno,
                "stack": error.stack,
                "element": error.element,
                "source": error.source,
                "user_agent": error.user_agent,
                "component": error.component,
                "version": error.version,
                "arguments": error.arguments,
                "received_at": int(time.time() * 1000)
            }
            
            # 写入错误日志
            with open(self.current_error_log, 'a', encoding='utf-8') as f:
                f.write(json.dumps(error_entry, ensure_ascii=False) + '\n')
            
            # 写入会话日志
            with open(self.current_session_log, 'a', encoding='utf-8') as f:
                session_entry = {
                    "timestamp": error.timestamp,
                    "session_id": error.session_id,
                    "event": "error",
                    "error_type": error.type,
                    "level": error.level,
                    "message": error.message[:100]  # 截断消息
                }
                f.write(json.dumps(session_entry, ensure_ascii=False) + '\n')
            
            return {
                "error_id": error_entry["error_id"],
                "status": "logged",
                "timestamp": int(time.time() * 1000)
            }
            
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
            return {
                "error": True,
                "message": str(e),
                "timestamp": int(time.time() * 1000)
            }
    
    def log_error_batch(self, errors: List[StandardErrorData], session_id: str) -> Dict[str, Any]:
        """批量记录错误（标准格式）"""
        results = []
        for error in errors:
            result = self.log_error(error)
            results.append(result)
        
        return {
            "processed_count": len(results),
            "success_count": len([r for r in results if "error_id" in r]),
            "error_count": len([r for r in results if "error" in r]),
            "timestamp": int(time.time() * 1000)
        }
    
    def get_recent_errors(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取最近的错误（标准格式）"""
        errors = []
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        if line.strip():
                            error_data = json.loads(line)
                            errors.append(error_data)
        except Exception as e:
            logger.error(f"Failed to read recent errors: {e}")
        
        return errors
    
    def get_session_errors(self, session_id: str) -> List[Dict[str, Any]]:
        """获取特定会话的错误（标准格式）"""
        errors = []
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            error_data = json.loads(line)
                            if error_data.get('session_id') == session_id:
                                errors.append(error_data)
        except Exception as e:
            logger.error(f"Failed to read session errors: {e}")
        
        return errors
    
    def get_error_stats(self) -> Dict[str, Any]:
        """获取错误统计（标准格式）"""
        stats = {
            "total_errors": 0,
            "error_types": {},
            "error_levels": {},
            "recent_sessions": {},
            "top_errors": [],
            "time_distribution": {},
            "component_distribution": {},
            "timestamp": int(time.time() * 1000)
        }
        
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            error_data = json.loads(line)
                            stats["total_errors"] += 1
                            
                            # 按类型统计
                            error_type = error_data.get('type', 'unknown')
                            stats["error_types"][error_type] = stats["error_types"].get(error_type, 0) + 1
                            
                            # 按级别统计
                            error_level = error_data.get('level', 'error')
                            stats["error_levels"][error_level] = stats["error_levels"].get(error_level, 0) + 1
                            
                            # 会话统计
                            session_id = error_data.get('session_id')
                            if session_id:
                                stats["recent_sessions"][session_id] = stats["recent_sessions"].get(session_id, 0) + 1
                            
                            # 组件统计
                            component = error_data.get('component', 'unknown')
                            stats["component_distribution"][component] = stats["component_distribution"].get(component, 0) + 1
                            
                            # 时间分布（按小时）
                            timestamp = error_data.get('timestamp', 0)
                            if timestamp:
                                import datetime
                                hour = datetime.datetime.fromtimestamp(timestamp / 1000).hour
                                hour_key = f"{hour:02d}:00"
                                stats["time_distribution"][hour_key] = stats["time_distribution"].get(hour_key, 0) + 1
                            
                            # 热门错误
                            error_key = f"{error_type}:{error_data.get('message', '')[:50]}"
                            if error_key not in [e["key"] for e in stats["top_errors"]]:
                                stats["top_errors"].append({
                                    "key": error_key,
                                    "type": error_type,
                                    "message": error_data.get('message', '')[:100],
                                    "count": 1
                                })
                            else:
                                for e in stats["top_errors"]:
                                    if e["key"] == error_key:
                                        e["count"] += 1
                            
                            # 限制热门错误数量
                            if len(stats["top_errors"]) > 10:
                                stats["top_errors"] = sorted(
                                    stats["top_errors"], 
                                    key=lambda x: x["count"], 
                                    reverse=True
                                )[:10]
                                
        except Exception as e:
            logger.error(f"Failed to generate error stats: {e}")
        
        return stats

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
            "timestamp": int(time.time() * 1000)
        }
        
        return analysis
    
    def _calculate_severity(self, error: StandardErrorData) -> str:
        """计算错误严重程度"""
        if error.type in ['javascript_error', 'promise_rejection']:
            if 'TypeError' in error.message or 'ReferenceError' in error.message:
                return 'critical'
            return 'high'
        elif error.type == 'resource_error':
            return 'medium'
        elif error.type == 'warning':
            return 'low'
        else:
            return 'medium'
    
    def _categorize_error(self, error: StandardErrorData) -> str:
        """分类错误"""
        message = error.message.lower()
        
        if 'undefined' in message or 'null' in message:
            return 'null_reference'
        elif 'network' in message or 'fetch' in message:
            return 'network_error'
        elif 'permission' in message or 'access' in message:
            return 'permission_error'
        elif 'timeout' in message:
            return 'timeout_error'
        elif 'validation' in message or 'invalid' in message:
            return 'validation_error'
        else:
            return 'general_error'
    
    def _suggest_fix(self, error: StandardErrorData) -> List[str]:
        """提供修复建议"""
        suggestions = []
        
        category = self._categorize_error(error)
        
        if category == 'null_reference':
            suggestions.extend([
                "检查变量是否已正确初始化",
                "添加空值检查",
                "使用可选链操作符 (?.)"
            ])
        elif category == 'network_error':
            suggestions.extend([
                "检查网络连接",
                "验证API端点URL",
                "添加重试机制"
            ])
        elif category == 'permission_error':
            suggestions.extend([
                "检查文件/目录权限",
                "验证用户权限",
                "确保服务已正确配置"
            ])
        elif category == 'timeout_error':
            suggestions.extend([
                "增加超时时间",
                "优化查询性能",
                "检查网络延迟"
            ])
        else:
            suggestions.extend([
                "检查错误堆栈信息",
                "验证输入数据",
                "查看相关文档"
            ])
        
        return suggestions
    
    def _find_similar_patterns(self, error: StandardErrorData) -> List[Dict[str, Any]]:
        """查找相似的错误模式"""
        # 这里可以实现更复杂的模式匹配逻辑
        return []
    
    def _assess_impact(self, error: StandardErrorData) -> Dict[str, Any]:
        """评估错误影响"""
        return {
            "user_impact": "high" if error.level in ['critical', 'high'] else "low",
            "system_impact": "medium",
            "business_impact": "low",
            "affected_users": 1,
            "recovery_time": "immediate"
        }

# 初始化管理器
log_manager = StandardLogFileManager()
error_analyzer = StandardErrorAnalyzer(log_manager)

# API端点
@router.post("/errors", response_model=StandardErrorResponse)
async def log_frontend_error(error_data: StandardErrorData, request: Request):
    """记录前端错误（标准格式）"""
    try:
        request_id = str(uuid.uuid4())
        
        # 记录错误
        result = log_manager.log_error(error_data)
        
        # 分析错误
        analysis = error_analyzer.analyze_error(error_data)
        
        return StandardErrorResponse(
            success=True,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            data={
                "error_id": result.get("error_id"),
                "analysis": analysis
            }
        )
        
    except Exception as e:
        logger.error(f"记录错误失败: {e}")
        return StandardErrorResponse(
            success=False,
            request_id=str(uuid.uuid4()),
            timestamp=int(time.time() * 1000),
            error={
                "code": "LOG_ERROR_FAILED",
                "message": str(e)
            }
        )

@router.post("/errors/batch", response_model=StandardErrorResponse)
async def log_frontend_errors_batch(error_batch: StandardErrorBatch, request: Request):
    """批量记录前端错误（标准格式）"""
    try:
        request_id = str(uuid.uuid4())
        
        # 批量记录错误
        result = log_manager.log_error_batch(error_batch.errors, error_batch.session_id)
        
        # 分析每个错误
        analyses = []
        for error in error_batch.errors:
            analysis = error_analyzer.analyze_error(error)
            analyses.append(analysis)
        
        return StandardErrorResponse(
            success=True,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            data={
                "batch_result": result,
                "analyses": analyses
            }
        )
        
    except Exception as e:
        logger.error(f"批量记录错误失败: {e}")
        return StandardErrorResponse(
            success=False,
            request_id=str(uuid.uuid4()),
            timestamp=int(time.time() * 1000),
            error={
                "code": "LOG_BATCH_ERROR_FAILED",
                "message": str(e)
            }
        )

@router.get("/errors/recent", response_model=StandardErrorResponse)
async def get_recent_errors(limit: int = 100):
    """获取最近的错误（标准格式）"""
    try:
        request_id = str(uuid.uuid4())
        
        errors = log_manager.get_recent_errors(limit)
        
        return StandardErrorResponse(
            success=True,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            data={
                "errors": errors,
                "count": len(errors)
            }
        )
        
    except Exception as e:
        logger.error(f"获取最近错误失败: {e}")
        return StandardErrorResponse(
            success=False,
            request_id=str(uuid.uuid4()),
            timestamp=int(time.time() * 1000),
            error={
                "code": "GET_RECENT_ERRORS_FAILED",
                "message": str(e)
            }
        )

@router.get("/errors/session/{session_id}", response_model=StandardErrorResponse)
async def get_session_errors(session_id: str):
    """获取特定会话的错误（标准格式）"""
    try:
        request_id = str(uuid.uuid4())
        
        errors = log_manager.get_session_errors(session_id)
        
        return StandardErrorResponse(
            success=True,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            data={
                "session_id": session_id,
                "errors": errors,
                "count": len(errors)
            }
        )
        
    except Exception as e:
        logger.error(f"获取会话错误失败: {e}")
        return StandardErrorResponse(
            success=False,
            request_id=str(uuid.uuid4()),
            timestamp=int(time.time() * 1000),
            error={
                "code": "GET_SESSION_ERRORS_FAILED",
                "message": str(e)
            }
        )

@router.get("/errors/stats", response_model=StandardErrorResponse)
async def get_error_stats():
    """获取错误统计（标准格式）"""
    try:
        request_id = str(uuid.uuid4())
        
        stats = log_manager.get_error_stats()
        
        return StandardErrorResponse(
            success=True,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            data=stats
        )
        
    except Exception as e:
        logger.error(f"获取错误统计失败: {e}")
        return StandardErrorResponse(
            success=False,
            request_id=str(uuid.uuid4()),
            timestamp=int(time.time() * 1000),
            error={
                "code": "GET_ERROR_STATS_FAILED",
                "message": str(e)
            }
        )