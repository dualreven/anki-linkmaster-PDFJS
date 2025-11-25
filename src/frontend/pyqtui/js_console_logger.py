# -*- coding: utf-8 -*-
"""
JS 控制台日志工具与统一的 QWebEnginePage 子类。

- BaseLoggingWebPage：封装 javaScriptConsoleMessage，将 JS 控制台输出统一写入 UTF-8 日志文件，
  并可选透传到 js_logger（如 pdf-viewer 的 JSConsoleLogger）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Any

from src.qt.compat import QWebEnginePage  # type: ignore


def write_js_console_message(
    log_file_path: Optional[str],
    *,
    level: str,
    message: str,
    line_number: int,
    source_id: str,
) -> None:
    """将 JS 控制台一行写入日志（UTF-8, \\n）。"""
    if not log_file_path:
        return

    try:
        import re
        path = Path(log_file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        from datetime import datetime
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        parsed_message = str(message)

        # 移除开头时间戳（若已带）
        m_ts = re.match(r"^\\[\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\]\\s*", parsed_message)
        if m_ts:
            parsed_message = parsed_message[m_ts.end():].strip()

        # 提取/折叠日志级别
        m_lv = re.match(r"^\\[([A-Z]+)\\]\\s*", parsed_message)
        if m_lv:
            embedded = m_lv.group(1)
            if embedded in {"INFO", "WARN", "WARNING", "ERROR", "DEBUG", "CRITICAL"}:
                level = "WARN" if embedded == "WARNING" else embedded
                parsed_message = parsed_message[m_lv.end():].strip()
        else:
            _lv = str(level).lower()
            if "javascriptconsolemessagelevel" in _lv:
                for key, mapped in [
                    ("infomessagelevel", "INFO"),
                    ("warningmessagelevel", "WARN"),
                    ("errormessagelevel", "ERROR"),
                    ("criticalmessagelevel", "CRITICAL"),
                ]:
                    if key in _lv:
                        level = mapped
                        break

        # 移除冗余前缀（console level / 源 URL）
        for pat in [
            r"^\\[\\s*JavaScriptConsoleMessageLevel\\.[^\\]]+\\]\\s*",
            r"^\\[\\s*JAVASCRIPTCONSOLEMESSAGELEVEL\\.[^\\]]+\\]\\s*",
            r"^\\[\\s*(?:https?|file)://[^\\]]+\\]\\s*",
        ]:
            parsed_message = re.sub(pat, "", parsed_message, flags=re.IGNORECASE).strip()

        line = f"[{ts}][{level}] {parsed_message}"
        with path.open("a", encoding="utf-8", newline="\\n") as handle:
            handle.write(line + "\\n")
    except Exception:
        # 日志助手不抛出异常，避免干扰主流程
        pass


class BaseLoggingWebPage(QWebEnginePage):  # type: ignore[misc]
    """
    统一的 QWebEnginePage 子类：
    - 将 JS 控制台日志写入文件；
    - 可选将日志透传到 js_logger（如 pdf-viewer 的 JSConsoleLogger）。
    """

    def __init__(self, parent: Any, log_file_path: Optional[str], js_logger: Any = None, pdf_id: str = "unknown"):
        super().__init__(parent)
        self._log_file_path = log_file_path
        self.js_logger = js_logger
        self.pdf_id = pdf_id

        try:
            if self._log_file_path:
                import os as _os
                _os.makedirs(_os.path.dirname(self._log_file_path), exist_ok=True)
        except Exception:
            pass

    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore[override]
        """统一的控制台消息处理：写入日志文件 + 可选透传给 js_logger。"""
        try:
            write_js_console_message(
                self._log_file_path,
                level=str(level),
                message=str(message),
                line_number=int(lineNumber),
                source_id=str(sourceID),
            )
        except Exception:
            pass

        if self.js_logger and hasattr(self.js_logger, "log_message"):
            try:
                self.js_logger.log_message(
                    level=str(level),
                    message=str(message),
                    source=str(sourceID) if sourceID else "",
                    line=int(lineNumber),
                )
            except Exception as e:
                try:
                    print(f"Warning: Failed to pass message to js_logger (pdf_id: {self.pdf_id}): {e}")
                except Exception:
                    pass

        try:
            return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)  # type: ignore[misc]
        except Exception:
            return None

