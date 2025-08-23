"""
Error Handler API - 处理前端错误收集
"""

import os
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from fastapi.responses import JSONResponse

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()

# 错误数据模型
class ErrorData(BaseModel):
    type: str
    message: str
    timestamp: str
    session_id: str
    url: str
    user_agent: str
    filename: Optional[str] = None
    lineno: Optional[int] = None
    colno: Optional[int] = None
    stack: Optional[str] = None
    element: Optional[str] = None
    source: Optional[str] = None
    arguments: Optional[List[Any]] = None

class ErrorBatch(BaseModel):
    errors: List[ErrorData]
    session_id: str
    timestamp: str

class LogFileManager:
    """日志文件管理器"""
    
    def __init__(self, log_dir: str = "logs/errors"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建不同类型的日志文件
        self.error_log_file = self.log_dir / "frontend_errors.log"
        self.session_log_file = self.log_dir / "sessions.log"
        self.stats_log_file = self.log_dir / "error_stats.log"
        self.analysis_log_file = self.log_dir / "error_analysis.log"
        
        # 创建日志轮转文件
        self.current_error_log = self.log_dir / f"frontend_errors_{datetime.now().strftime('%Y%m%d')}.log"
        self.current_session_log = self.log_dir / f"sessions_{datetime.now().strftime('%Y%m%d')}.log"
        
    def log_error(self, error: ErrorData) -> None:
        """记录单个错误"""
        try:
            error_entry = {
                "timestamp": datetime.now().isoformat(),
                "session_id": error.session_id,
                "type": error.type,
                "message": error.message,
                "url": error.url,
                "filename": error.filename,
                "lineno": error.lineno,
                "colno": error.colno,
                "stack": error.stack,
                "user_agent": error.user_agent
            }
            
            # 写入错误日志
            with open(self.current_error_log, 'a', encoding='utf-8') as f:
                f.write(json.dumps(error_entry, ensure_ascii=False) + '\n')
                
            # 写入会话日志
            with open(self.current_session_log, 'a', encoding='utf-8') as f:
                session_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "session_id": error.session_id,
                    "event": "error",
                    "error_type": error.type,
                    "message": error.message
                }
                f.write(json.dumps(session_entry, ensure_ascii=False) + '\n')
                
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
    
    def log_error_batch(self, errors: List[ErrorData], session_id: str) -> None:
        """批量记录错误"""
        for error in errors:
            self.log_error(error)
    
    def get_recent_errors(self, limit: int = 100) -> List[Dict]:
        """获取最近的错误"""
        errors = []
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        if line.strip():
                            errors.append(json.loads(line))
        except Exception as e:
            logger.error(f"Failed to read recent errors: {e}")
        
        return errors
    
    def get_session_errors(self, session_id: str) -> List[Dict]:
        """获取特定会话的错误"""
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
    
    def get_error_stats(self) -> Dict:
        """获取错误统计"""
        stats = {
            "total_errors": 0,
            "error_types": {},
            "recent_sessions": {},
            "top_errors": []
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
                            
                            # 最近会话
                            session_id = error_data.get('session_id')
                            if session_id:
                                stats["recent_sessions"][session_id] = stats["recent_sessions"].get(session_id, 0) + 1
                            
                            # 热门错误
                            error_key = f"{error_type}:{error_data.get('message', '')[:50]}"
                            if error_key not in stats["top_errors"]:
                                stats["top_errors"].append(error_key)
                            
                            if len(stats["top_errors"]) > 10:
                                stats["top_errors"] = stats["top_errors"][:10]
        except Exception as e:
            logger.error(f"Failed to generate error stats: {e}")
        
        return stats

class ErrorAnalyzer:
    """错误分析器"""
    
    def __init__(self, log_manager: LogFileManager):
        self.log_manager = log_manager
        
    def analyze_error(self, error: ErrorData) -> Dict:
        """分析单个错误"""
        analysis = {
            "error_id": f"{error.session_id}_{error.timestamp}",
            "severity": self._calculate_severity(error),
            "category": self._categorize_error(error),
            "suggested_fix": self._suggest_fix(error),
            "similar_errors": [],
            "patterns": []
        }
        
        return analysis
    
    def _calculate_severity(self, error: ErrorData) -> str:
        """计算错误严重程度"""
        if error.type in ['javascript_error', 'promise_rejection']:
            if 'TypeError' in error.message or 'ReferenceError' in error.message:
                return 'high'
            return 'medium'
        elif error.type == 'resource_error':
            return 'medium'
        else:
            return 'low'
    
    def _categorize_error(self, error: ErrorData) -> str:
        """分类错误"""
        message = error.message.lower()
        
        if 'cannot read properties' in message or 'undefined' in message:
            return 'null_reference'
        elif 'module' in message and 'export' in message:
            return 'module_import'
        elif 'network' in message or 'fetch' in message:
            return 'network'
        elif 'syntax' in message:
            return 'syntax'
        else:
            return 'other'
    
    def _suggest_fix(self, error: ErrorData) -> str:
        """建议修复方案"""
        category = self._categorize_error(error)
        
        suggestions = {
            'null_reference': '检查对象是否为undefined或null，添加适当的空值检查',
            'module_import': '检查ES6模块导出语句，确保使用正确的export default语法',
            'network': '检查网络连接和API端点配置',
            'syntax': '检查JavaScript语法错误，确保代码格式正确',
            'other': '请检查相关代码逻辑和错误处理'
        }
        
        return suggestions.get(category, '请仔细检查错误信息和相关代码')
    
    def analyze_batch(self, errors: List[ErrorData]) -> Dict:
        """批量分析错误"""
        analysis = {
            "total_errors": len(errors),
            "severity_distribution": {"high": 0, "medium": 0, "low": 0},
            "category_distribution": {},
            "common_patterns": [],
            "urgent_issues": []
        }
        
        for error in errors:
            error_analysis = self.analyze_error(error)
            
            # 统计严重程度
            analysis["severity_distribution"][error_analysis["severity"]] += 1
            
            # 统计分类
            category = error_analysis["category"]
            analysis["category_distribution"][category] = analysis["category_distribution"].get(category, 0) + 1
            
            # 识别紧急问题
            if error_analysis["severity"] == 'high':
                analysis["urgent_issues"].append({
                    "error_id": error_analysis["error_id"],
                    "message": error.message,
                    "suggested_fix": error_analysis["suggested_fix"]
                })
        
        return analysis

# 全局实例
log_manager = LogFileManager()
error_analyzer = ErrorAnalyzer(log_manager)

@router.post("/errors")
async def receive_errors(error_batch: ErrorBatch):
    """接收前端错误"""
    try:
        logger.info(f"Received {len(error_batch.errors)} errors from session {error_batch.session_id}")
        
        # 记录错误到日志文件
        log_manager.log_error_batch(error_batch.errors, error_batch.session_id)
        
        # 分析错误
        analysis = error_analyzer.analyze_batch(error_batch.errors)
        
        # 如果有高优先级错误，记录到分析日志
        if analysis["urgent_issues"]:
            analysis_log = {
                "timestamp": datetime.now().isoformat(),
                "session_id": error_batch.session_id,
                "urgent_issues": analysis["urgent_issues"],
                "analysis": analysis
            }
            
            with open(log_manager.analysis_log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(analysis_log, ensure_ascii=False) + '\n')
        
        return {
            "success": True,
            "message": f"Received {len(error_batch.errors)} errors",
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f"Failed to process errors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process errors: {str(e)}")

@router.get("/errors/recent")
async def get_recent_errors(limit: int = 100):
    """获取最近的错误"""
    try:
        errors = log_manager.get_recent_errors(limit)
        return {"success": True, "errors": errors}
    except Exception as e:
        logger.error(f"Failed to get recent errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/errors/session/{session_id}")
async def get_session_errors(session_id: str):
    """获取特定会话的错误"""
    try:
        errors = log_manager.get_session_errors(session_id)
        return {"success": True, "errors": errors}
    except Exception as e:
        logger.error(f"Failed to get session errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/errors/stats")
async def get_error_stats():
    """获取错误统计"""
    try:
        stats = log_manager.get_error_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Failed to get error stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/errors/analysis")
async def get_error_analysis():
    """获取错误分析"""
    try:
        recent_errors = log_manager.get_recent_errors(50)
        if recent_errors:
            error_objects = [ErrorData(**error) for error in recent_errors]
            analysis = error_analyzer.analyze_batch(error_objects)
            return {"success": True, "analysis": analysis}
        else:
            return {"success": True, "analysis": {"total_errors": 0}}
    except Exception as e:
        logger.error(f"Failed to get error analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/errors/clear")
async def clear_errors():
    """清空错误日志"""
    try:
        if log_manager.current_error_log.exists():
            log_manager.current_error_log.unlink()
        return {"success": True, "message": "Error logs cleared"}
    except Exception as e:
        logger.error(f"Failed to clear error logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))