# -*- coding: utf-8 -*-
from __future__ import annotations

"""
Anki 插件事件总线桥接（可选接入）

功能：
- 尝试导入 Anki 插件本体的事件总线（hjp_linkmaster_dev.lib.common_tools.event_bus）；
- 订阅其 request 通道；
- 当接收到“打开 pdf-viewer”或“打开 pdf-home”的请求时，启动本仓对应的启动器；

注意：
- 非 Anki 插件环境（无法导入 event_bus）下，本模块静默跳过集成；
- 通过子进程方式启动前端窗口，避免复用宿主 QApplication（降低耦合）。
"""

import os
import sys
import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional


Logger = logging.getLogger("anki-integration.event-bridge")


def _ensure_logger(project_root: Path) -> logging.Logger:
    try:
        logs_dir = project_root / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(logs_dir / "anki-bridge.log", encoding="utf-8")
        sh = logging.StreamHandler(sys.stdout)
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        fh.setFormatter(fmt)
        sh.setFormatter(fmt)
        lg = logging.getLogger("anki-integration.event-bridge")
        lg.setLevel(logging.INFO)
        # 避免重复添加 handler
        if not lg.handlers:
            lg.addHandler(fh)
            lg.addHandler(sh)
        return lg
    except Exception:
        return logging.getLogger("anki-integration.event-bridge")


def _default_runner(cmd: list[str]) -> Any:
    """默认子进程执行器。"""
    # 在当前项目根目录下执行，避免相对路径问题
    return subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0),
    )


@dataclass
class LaunchOptions:
    pdf_id: Optional[str] = None
    file_path: Optional[str] = None
    page_at: Optional[int] = None
    position: Optional[float] = None
    anchor_id: Optional[str] = None


class AnkiEventBridge:
    """桥接 Anki 插件事件与本仓前端窗口的简单适配器。"""

    def __init__(
        self,
        project_root: Optional[Path] = None,
        process_runner: Optional[Callable[[list[str]], Any]] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self._project_root = project_root or Path(os.getcwd())
        self._runner = process_runner or _default_runner
        self._logger = logger or _ensure_logger(self._project_root)
        self._anki_bus = None  # type: ignore

    # ---- 接入与订阅 ----
    def try_setup(self) -> bool:
        """尝试导入 anki 插件事件总线并订阅 request 通道。失败将返回 False。"""
        try:
            # 延迟导入，避免非插件环境报错
            from hjp_linkmaster_dev.lib.common_tools import event_bus as anki_event_bus
        except Exception as exc:
            self._logger.info("Anki event_bus 不可用，跳过桥接：%s", exc)
            return False

        try:
            anki_event_bus.on_request(self._handle_request)
            self._anki_bus = anki_event_bus
            self._logger.info("已订阅 Anki event_bus.request 事件")
            return True
        except Exception as exc:
            self._logger.error("订阅 Anki event_bus 失败：%s", exc)
            return False

    # ---- 事件处理 ----
    def _handle_request(self, event: Dict[str, Any]) -> None:
        try:
            if not isinstance(event, dict):
                return
            evt_type = event.get("type") or event.get("event")
            data = event.get("data") if isinstance(event.get("data"), dict) else event

            if not evt_type:
                return

            # pdf-viewer 打开请求：兼容若干别名
            if evt_type in {"pdf-library:open:viewer", "pdf-library:viewer:requested", "open_pdf"}:
                opts = self._parse_viewer_options(data)
                self._open_pdf_viewer(opts)
                return

            # pdf-home 打开请求：约定为 pdf-library:open:home（未设计时临时确定）
            if evt_type in {"pdf-library:open:home", "open_pdf_home", "open_home"}:
                self._open_pdf_home()
                return

            # 其它事件忽略
        except Exception as exc:
            self._logger.error("处理 Anki 事件失败：%s; event=%s", exc, _safe_json(event))

    # ---- 启动器封装 ----
    def _open_pdf_viewer(self, opts: LaunchOptions) -> None:
        launcher = self._project_root / "src" / "frontend" / "pdf-viewer" / "launcher.py"
        cmd = [sys.executable, "-u", str(launcher)]

        # 以 pdf-id 优先，其次 file-path
        if opts.pdf_id:
            cmd += ["--pdf-id", str(opts.pdf_id)]
        elif opts.file_path:
            cmd += ["--file-path", str(opts.file_path)]

        if isinstance(opts.page_at, int):
            cmd += ["--page-at", str(int(opts.page_at))]
        if isinstance(opts.position, (int, float)):
            cmd += ["--position", str(float(opts.position))]
        if opts.anchor_id:
            cmd += ["--anchor-id", str(opts.anchor_id)]

        self._logger.info("启动 pdf-viewer：%s", " ".join(cmd))
        self._runner(cmd)

    def _open_pdf_home(self) -> None:
        launcher = self._project_root / "src" / "frontend" / "pdf-home" / "launcher.py"
        cmd = [sys.executable, "-u", str(launcher)]
        self._logger.info("启动 pdf-home：%s", " ".join(cmd))
        self._runner(cmd)

    # ---- 解析 ----
    def _parse_viewer_options(self, data: Dict[str, Any]) -> LaunchOptions:
        # 兼容字段名：file_id/pdf_id/id、file_path/path
        pdf_id = data.get("file_id") or data.get("pdf_id") or data.get("id")
        file_path = data.get("file_path") or data.get("path")

        # 解析 viewer_options 内的页码/位置/锚点
        vopt = data.get("viewer_options") if isinstance(data.get("viewer_options"), dict) else {}

        page = data.get("page_at") or data.get("page") or vopt.get("page")
        position = data.get("position") or vopt.get("position")
        anchor_id = (
            data.get("anchor_id")
            or data.get("pdfanchor")
            or vopt.get("anchor_id")
            or vopt.get("pdfanchor")
        )

        try:
            page_at = int(page) if page is not None else None
        except Exception:
            page_at = None
        try:
            pos_val = float(position) if position is not None else None
        except Exception:
            pos_val = None

        return LaunchOptions(
            pdf_id=str(pdf_id) if pdf_id else None,
            file_path=str(file_path) if file_path else None,
            page_at=page_at,
            position=pos_val,
            anchor_id=str(anchor_id) if anchor_id else None,
        )


def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False)
    except Exception:
        return str(obj)


def setup_bridge(project_root: Optional[Path] = None) -> Optional[AnkiEventBridge]:
    """便捷方法：创建桥接并尝试订阅。成功则返回实例，否则返回 None。"""
    bridge = AnkiEventBridge(project_root=project_root)
    return bridge if bridge.try_setup() else None

