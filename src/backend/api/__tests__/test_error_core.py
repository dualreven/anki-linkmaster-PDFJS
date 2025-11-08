# -*- coding: utf-8 -*-
import json
from pathlib import Path
import importlib.util as _ilus
import pytest

# 若运行环境缺少 pydantic，跳过本套件（不安装依赖）
if _ilus.find_spec("pydantic") is None:  # pragma: no cover
    pytest.skip("pydantic not available", allow_module_level=True)

from src.backend.api.core.error_models import StandardErrorData
from src.backend.api.core.error_logging import StandardLogFileManager
from src.backend.api.core.error_analysis import StandardErrorAnalyzer


def _mk_error(ts: int = 1730540000) -> StandardErrorData:
    return StandardErrorData(
        type="javascript_error",
        message="TypeError: x is not a function",
        timestamp=ts,
        session_id="sess-1",
        url="http://localhost/app",
        user_agent="pytest/agent",
        filename="app.js",
        lineno=10,
        colno=20,
        stack="at fn()",
        element="<button>",
        source="frontend",
        arguments=["a", 1],
        level="error",
        component="viewer",
        version="1.0.0",
    )


def test_log_manager_write_and_read(tmp_path: Path):
    log_dir = tmp_path / "logs"
    m = StandardLogFileManager(log_dir=str(log_dir))
    e = _mk_error()
    out = m.log_error(e)
    assert "error_id" in out
    # recent
    recent = m.get_recent_errors(limit=10)
    assert isinstance(recent, list) and len(recent) >= 1
    # session filter
    sess = m.get_session_errors("sess-1")
    assert len(sess) >= 1 and sess[0]["session_id"] == "sess-1"
    # stats shape
    stats = m.get_error_stats()
    assert "total_errors" in stats and "error_types" in stats


def test_error_analyzer_basic(tmp_path: Path):
    m = StandardLogFileManager(log_dir=str(tmp_path / "logs"))
    analyzer = StandardErrorAnalyzer(m)
    e = _mk_error()
    a = analyzer.analyze_error(e)
    assert a["severity"] in ("critical", "high")
    assert isinstance(a["suggested_fix"], list) and len(a["suggested_fix"]) >= 1
