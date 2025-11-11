#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Controller Layer (Skeleton)

目标：
- 作为 UI 与 Services 的粘合层，承载信号/槽与流程编排；
- 当前仅提供占位类型，后续将把 gui_launcher.py 中的交互逻辑迁移至此；
- 不在导入时引入 PyQt 依赖。
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass
class ControllerOptions:
    component_root: Optional[Path] = None
    logs_dir: Optional[Path] = None
    on_log: Optional[Any] = None  # Callable[[str], None]


class Controller:
    """
    控制器骨架：后续将绑定 UI 事件，并调用 services 层实现具体动作。
    """
    def __init__(self, options: Optional[ControllerOptions] = None) -> None:
        self.options = options or ControllerOptions()
        # 预留：后续注入 services / ui 句柄
        self._services: Dict[str, Any] = {}
        self._ui: Any = None
        # 运行态资源（需显式释放）
        self._fs_watcher = None
        self._status_debounce_timer = None
        self._logs_dir: Optional[Path] = self.options.logs_dir

    # ---------- 依赖注入 ----------

    def attach_services(self, **services: Any) -> None:
        self._services.update(services)

    def attach_ui(self, ui: Any) -> None:
        self._ui = ui

    # ---------- DevServer / Vite ----------

    def ensure_vite_dev(self, port: int, *, ai_module: Optional[object] = None) -> tuple[Optional[int], int]:
        """
        确保 Vite 在端口上运行；若未运行则尝试启动。
        - 委托 services.ensure_vite；
        - 使用 options.component_root / options.logs_dir 作为上下文。
        """
        if 'ensure_vite' not in self._services:
            from . import services as _services
            self._services['ensure_vite'] = _services.ensure_vite
        comp_root = self.options.component_root or Path('.').resolve()
        logs_dir = self.options.logs_dir or (comp_root / 'logs')
        pid, used_port = self._services['ensure_vite'](int(port), component_root=comp_root, logs_dir=logs_dir, ai_module=ai_module)
        # 记录“已发起并确认端口状态”的信息（不宣称一定成功运行，由调用方二次校验监听）
        if callable(self.options.on_log):
            try:
                self.options.on_log(f"Vite 启动请求已处理: PID={pid} 端口={used_port}")
            except Exception:
                pass
        return pid, used_port

    # ---------- Vite 停止 ----------
    def stop_vite_dev(self) -> bool:
        """
        停止 Vite 开发服务器（根据 logs_dir 中记录的 PID）。
        """
        if 'stop_vite' not in self._services:
            from . import services as _services
            self._services['stop_vite'] = _services.stop_vite
        logs_dir = self.options.logs_dir or (self.options.component_root or Path('.').resolve() / 'logs')
        ok = self._services['stop_vite'](logs_dir=logs_dir)
        if callable(self.options.on_log):
            try:
                self.options.on_log("Vite 停止" + ("成功" if ok else "失败"))
            except Exception:
                pass
        return bool(ok)

    # ---------- 运行端口读取 ----------
    def read_runtime_ports(self, logs_dir: Path) -> Dict[str, Any]:
        """读取 logs/runtime-ports.json（委托 services.read_runtime_ports）。"""
        try:
            from . import services as _services
            return _services.read_runtime_ports(Path(logs_dir))
        except Exception:
            return {}

    # ---------- 路径解析（带默认与目录创建） ----------
    def resolve_paths(self, *, defaults: Dict[str, str], overrides: Dict[str, str]) -> Dict[str, str]:
        """
        基于 defaults 与 overrides 解析最终路径；必要目录会被创建。
        - defaults: 必须包含 data_dir/db_path/static_dir/pdfs_dir/logs_dir（字符串路径）
        - overrides: 允许为空字符串；为空时使用对应 defaults
        返回规范化的绝对路径字符串字典。
        """
        def _pick(key: str) -> str:
            v = (overrides.get(key) or "").strip()
            return v or str(defaults.get(key) or "")

        resolved = {
            "data_dir": _pick("data_dir"),
            "db_path": _pick("db_path"),
            "static_dir": _pick("static_dir"),
            "pdfs_dir": _pick("pdfs_dir"),
            "logs_dir": _pick("logs_dir"),
        }
        # 创建必要目录（data/pdfs/logs）
        for k in ("data_dir", "pdfs_dir", "logs_dir"):
            try:
                Path(resolved[k]).mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
        return resolved
    # ---------- 文件监听（状态刷新） ----------

    def init_status_watchers(self, *, parent: Any, logs_dir: Path, on_update_status: Any) -> None:
        """
        使用 QFileSystemWatcher + QTimer 管理状态文件监听与去抖刷新。
        - 仅在有 PyQt 环境时执行；
        - 不抛出异常到调用方（日志通过 on_log 打印）。
        """
        self.dispose_status_watchers()
        self._logs_dir = Path(logs_dir)
        try:
            from PyQt6.QtCore import QFileSystemWatcher, QTimer  # type: ignore
            self._fs_watcher = QFileSystemWatcher(parent)
            # 监听目录
            try:
                self._fs_watcher.addPath(str(self._logs_dir))
            except Exception:
                pass
            # 初始已存在文件
            for name in ("dev-process-info.json", "backend-process-info.json", "frontend-process-info.json"):
                try:
                    p = self._logs_dir / name
                    if p.exists():
                        self._fs_watcher.addPath(str(p))
                except Exception:
                    pass
            # 去抖计时器
            self._status_debounce_timer = QTimer(parent)
            self._status_debounce_timer.setSingleShot(True)

            def _schedule(ms: int) -> None:
                try:
                    if self._status_debounce_timer.isActive():
                        self._status_debounce_timer.stop()
                    self._status_debounce_timer.start(max(0, int(ms)))
                except Exception:
                    try:
                        on_update_status()
                    except Exception:
                        pass

            # 绑定变更事件
            def _on_file_changed(_path: str) -> None:
                _schedule(100)

            def _on_dir_changed(_path: str) -> None:
                # 新出现的状态文件补挂载
                try:
                    files_now = set(self._fs_watcher.files())
                except Exception:
                    files_now = set()
                for name in ("dev-process-info.json", "backend-process-info.json", "frontend-process-info.json"):
                    try:
                        p = self._logs_dir / name
                        sp = str(p)
                        if p.exists() and sp not in files_now:
                            self._fs_watcher.addPath(sp)
                    except Exception:
                        pass
                _schedule(150)

            self._status_debounce_timer.timeout.connect(on_update_status)  # type: ignore
            self._fs_watcher.fileChanged.connect(_on_file_changed)  # type: ignore
            self._fs_watcher.directoryChanged.connect(_on_dir_changed)  # type: ignore

            if callable(self.options.on_log):
                try:
                    self.options.on_log(f"📡 文件监听已绑定: {self._logs_dir}")
                except Exception:
                    pass
        except Exception as e:
            if callable(self.options.on_log):
                try:
                    self.options.on_log(f"[WARN] 初始化文件监听失败: {e}")
                except Exception:
                    pass
            self._fs_watcher = None
            self._status_debounce_timer = None

    def dispose_status_watchers(self) -> None:
        """释放监听资源（若存在）。"""
        try:
            if self._status_debounce_timer is not None:
                self._status_debounce_timer.stop()
        except Exception:
            pass
        self._status_debounce_timer = None
        self._fs_watcher = None
