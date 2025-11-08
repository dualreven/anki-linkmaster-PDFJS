# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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

