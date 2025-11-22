#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launcher Config - 参数与默认值计算（与 UI 解耦）

用途：
- 提供与 UI 无关的配置对象与默认路径/端口计算逻辑；
- 支持 JSON 序列化/反序列化，便于在 Anki 或 CLI 场景直接使用；
- 统一默认日志目录 <component_root>/logs；其余路径遵循 database.config 的参数式规则。

所有文件读写均使用 UTF-8，写入时确保以 \n 结尾。
"""

from __future__ import annotations

from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Optional, Dict, Any, Tuple


def resolve_component_root(relative_to: Optional[Path] = None) -> Path:
    here = (relative_to or Path(__file__).resolve()).parent
    if (here / 'src').exists():
        return here
    for ancestor in here.parents:
        if (ancestor / 'src').exists():
            return ancestor
    return here


@dataclass
class LauncherPorts:
    msgCenter_port: Optional[int] = None
    pdfFile_port: Optional[int] = None
    url_port: Optional[int] = None  # 前端资源获取端口（dev模式=vite_port, prod模式=pdfFile_port）
    vite_port: Optional[int] = None  # 保留以兼容旧代码


@dataclass
class LauncherPaths:
    data_dir: Optional[str] = None
    db_path: Optional[str] = None
    static_dir: Optional[str] = None
    pdfs_dir: Optional[str] = None
    logs_dir: Optional[str] = None


@dataclass
class LauncherOptions:
    runtime_mode: str = 'single'  # 'single' | 'anki'
    ankiaddon_root_path: Optional[str] = None
    frontend_prod: bool = False
    keep_backend: bool = True


@dataclass
class LauncherConfig:
    ports: LauncherPorts = field(default_factory=LauncherPorts)
    paths: LauncherPaths = field(default_factory=LauncherPaths)
    options: LauncherOptions = field(default_factory=LauncherOptions)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'ports': asdict(self.ports),
            'paths': asdict(self.paths),
            'options': asdict(self.options),
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> 'LauncherConfig':
        ports = LauncherPorts(**(d.get('ports') or {}))
        paths = LauncherPaths(**(d.get('paths') or {}))
        options = LauncherOptions(**(d.get('options') or {}))
        return LauncherConfig(ports=ports, paths=paths, options=options)

    def write_json(self, path: Path) -> None:
        txt = __import__('json').dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(txt, encoding='utf-8')

    @staticmethod
    def read_json(path: Path) -> 'LauncherConfig':
        if not path.exists():
            return LauncherConfig()
        data = __import__('json').loads(path.read_text(encoding='utf-8') or '{}')
        return LauncherConfig.from_dict(data)

    def with_defaults(self, component_root: Optional[Path] = None) -> 'LauncherConfig':
        """返回填充默认值的新副本（不修改原对象）。"""
        comp = (component_root or resolve_component_root()).resolve()

        # 计算默认路径：委托给 database.config
        from src.backend.database.config import (
            compute_component_root,
            compute_data_dir,
            compute_db_path,
        )

        mode = (self.options.runtime_mode or 'single').lower()
        anki_root = self.options.ankiaddon_root_path

        try:
            if mode == 'anki' and anki_root:
                comp_root = compute_component_root('anki', ankiaddon_root_path=anki_root, project_root=comp)
            else:
                comp_root = comp
        except Exception:
            comp_root = comp

        def _path_or(val: Optional[str], fallback: Path) -> str:
            return val if (val and str(val).strip()) else str(fallback)

        # data_dir / db_path
        try:
            data_dir = compute_data_dir(mode if mode in ('single', 'anki') else 'single', ankiaddon_root_path=anki_root, project_root=comp_root)
        except Exception:
            data_dir = comp_root / 'data'
        try:
            db_path = compute_db_path(mode if mode in ('single', 'anki') else 'single', ankiaddon_root_path=anki_root, project_root=comp_root)
        except Exception:
            db_path = data_dir / 'anki_linkmaster.db'

        # pdfs_dir
        pdfs_dir = Path(str(self.paths.pdfs_dir)) if self.paths.pdfs_dir else (data_dir / 'pdfs')

        # static_dir：存在者优先
        static_dir = None
        for c in [comp_root / 'static', comp / 'static', comp / 'dist' / 'latest' / 'static']:
            try:
                if c.exists():
                    static_dir = c
                    break
            except Exception:
                continue
        static_dir = Path(self.paths.static_dir) if self.paths.static_dir else (static_dir or comp_root)

        # logs_dir
        logs_dir = Path(self.paths.logs_dir) if self.paths.logs_dir else (comp_root / 'logs')

        # 构造新对象
        new_paths = LauncherPaths(
            data_dir=_path_or(self.paths.data_dir, data_dir),
            db_path=_path_or(self.paths.db_path, db_path),
            static_dir=_path_or(self.paths.static_dir, static_dir),
            pdfs_dir=_path_or(self.paths.pdfs_dir, pdfs_dir),
            logs_dir=_path_or(self.paths.logs_dir, logs_dir),
        )

        # 端口默认：留空时由后端/前端自行分配或按 CLI 注入
        new_ports = LauncherPorts(
            msgCenter_port=self.ports.msgCenter_port,
            pdfFile_port=self.ports.pdfFile_port,
            url_port=self.ports.url_port,
            vite_port=self.ports.vite_port,
        )

        return LauncherConfig(ports=new_ports, paths=new_paths, options=self.options)

