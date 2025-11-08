"""
标准错误处理API - 基于JSON通信标准（入口轻量化）
"""

import logging
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.backend.api.core.error_models import (
    StandardErrorData,
    StandardErrorBatch,
    StandardErrorResponse,
)
from src.backend.api.core.error_logging import StandardLogFileManager
from src.backend.api.core.error_analysis import StandardErrorAnalyzer

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()

# 初始化管理器（默认路径，生产可通过依赖注入替换）
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

