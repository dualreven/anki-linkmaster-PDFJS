# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
import logging

from .error_models import StandardErrorData

logger = logging.getLogger(__name__)


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
        current_date = datetime.now().strftime("%Y%m%d")
        self.current_error_log = self.log_dir / f"frontend_errors_{current_date}.log"
        self.current_session_log = self.log_dir / f"sessions_{current_date}.log"

    def log_error(self, error: StandardErrorData) -> Dict[str, Any]:
        """记录单个错误（标准格式）"""
        import uuid

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
                "received_at": int(time.time() * 1000),
            }

            # 写入错误日志（确保 UTF-8 与换行）
            with open(self.current_error_log, "a", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(error_entry, ensure_ascii=False) + "\n")

            # 写入会话日志
            with open(self.current_session_log, "a", encoding="utf-8", newline="\n") as f:
                session_entry = {
                    "timestamp": error.timestamp,
                    "session_id": error.session_id,
                    "event": "error",
                    "error_type": error.type,
                    "level": error.level,
                    "message": (error.message or "")[:100],
                }
                f.write(json.dumps(session_entry, ensure_ascii=False) + "\n")

            return {
                "error_id": error_entry["error_id"],
                "status": "logged",
                "timestamp": int(time.time() * 1000),
            }

        except Exception as e:
            logger.error("Failed to log error: %s", e)
            return {"error": True, "message": str(e), "timestamp": int(time.time() * 1000)}

    def log_error_batch(self, errors: List[StandardErrorData], session_id: str) -> Dict[str, Any]:
        """批量记录错误（标准格式）"""
        results = []
        for error in errors:
            results.append(self.log_error(error))
        return {
            "processed_count": len(results),
            "success_count": len([r for r in results if "error_id" in r]),
            "error_count": len([r for r in results if "error" in r]),
            "timestamp": int(time.time() * 1000),
        }

    def get_recent_errors(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取最近的错误（标准格式）"""
        errors: List[Dict[str, Any]] = []
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                for line in lines[-limit:]:
                    line = line.strip()
                    if line:
                        errors.append(json.loads(line))
        except Exception as e:
            logger.error("Failed to read recent errors: %s", e)
        return errors

    def get_session_errors(self, session_id: str) -> List[Dict[str, Any]]:
        """获取特定会话的错误（标准格式）"""
        errors: List[Dict[str, Any]] = []
        try:
            if self.current_error_log.exists():
                with open(self.current_error_log, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        error_data = json.loads(line)
                        if error_data.get("session_id") == session_id:
                            errors.append(error_data)
        except Exception as e:
            logger.error("Failed to read session errors: %s", e)
        return errors

    def get_error_stats(self) -> Dict[str, Any]:
        """获取错误统计（标准格式）"""
        stats: Dict[str, Any] = {
            "total_errors": 0,
            "error_types": {},
            "error_levels": {},
            "recent_sessions": {},
            "top_errors": [],
            "time_distribution": {},
            "component_distribution": {},
            "timestamp": int(time.time() * 1000),
        }

        try:
            if self.current_error_log.exists():
                import datetime

                with open(self.current_error_log, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        error_data = json.loads(line)
                        stats["total_errors"] += 1

                        et = error_data.get("type", "unknown")
                        stats["error_types"][et] = stats["error_types"].get(et, 0) + 1

                        lvl = error_data.get("level", "error")
                        stats["error_levels"][lvl] = stats["error_levels"].get(lvl, 0) + 1

                        sid = error_data.get("session_id")
                        if sid:
                            stats["recent_sessions"][sid] = stats["recent_sessions"].get(sid, 0) + 1

                        comp = error_data.get("component", "unknown")
                        stats["component_distribution"][comp] = stats["component_distribution"].get(comp, 0) + 1

                        ts = error_data.get("timestamp", 0)
                        if ts:
                            hour = datetime.datetime.fromtimestamp(ts / 1000).hour
                            hour_key = f"{hour:02d}:00"
                            stats["time_distribution"][hour_key] = stats["time_distribution"].get(hour_key, 0) + 1

                        error_key = f"{et}:{(error_data.get('message', '') or '')[:50]}"
                        existing = None
                        for e in stats["top_errors"]:
                            if e.get("key") == error_key:
                                existing = e
                                break
                        if existing is None:
                            stats["top_errors"].append(
                                {
                                    "key": error_key,
                                    "type": et,
                                    "message": (error_data.get("message", "") or "")[:100],
                                    "count": 1,
                                }
                            )
                        else:
                            existing["count"] += 1

                        if len(stats["top_errors"]) > 10:
                            stats["top_errors"] = sorted(stats["top_errors"], key=lambda x: x["count"], reverse=True)[:10]
        except Exception as e:
            logger.error("Failed to generate error stats: %s", e)

        return stats

