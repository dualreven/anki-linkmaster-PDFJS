#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launcher Runner - 启动逻辑（与 UI 解耦）

提供在“Hosted（Qt 线程）/CLI（子进程）”两类路径下的启动函数，
接受 LauncherConfig（已填充默认值）并执行启动。

所有子进程启动均显式 UTF-8；日志路径由调用方通过 config.paths.logs_dir 注入。
"""
from __future__ import annotations

import os
import sys
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, Callable

from .config import LauncherConfig, resolve_component_root
from .ports import read_runtime_ports
from src.backend.launcher_core.session_registry import get_registry, activate_window

def _is_qobject_alive(obj: object) -> bool:
    """最佳努力地判断 Qt 对象是否仍然存活。"""
    if obj is None:
        return False
    try:
        import sip  # type: ignore
        try:
            if sip.isdeleted(obj):
                return False
        except Exception:
            pass
    except Exception:
        # sip 不可用时，尝试一次轻量访问
        pass
    try:
        # 访问一个轻量属性以触发潜在的已销毁异常
        if hasattr(obj, "objectName"):
            _ = obj.objectName()  # type: ignore[attr-defined]
        return True
    except Exception:
        return False


def _py_exe() -> str:
    return sys.executable


def start_backend_cli(cfg: LauncherConfig, *, on_log: Optional[Callable[[str], None]] = None) -> bool:
    root = resolve_component_root()
    launcher_py = root / 'src' / 'backend' / 'launcher.py'
    cmd = [_py_exe(), str(launcher_py), 'start']
    if cfg.ports.msgCenter_port:
        cmd += ['--msgCenter-port', str(int(cfg.ports.msgCenter_port))]
    if cfg.ports.pdfFile_port:
        cmd += ['--pdfFileServer-port', str(int(cfg.ports.pdfFile_port))]
    if cfg.paths.db_path:
        cmd += ['--db-path', str(cfg.paths.db_path)]
    if cfg.paths.data_dir:
        cmd += ['--data-dir', str(cfg.paths.data_dir)]
    if cfg.options.runtime_mode:
        cmd += ['--runtime-mode', str(cfg.options.runtime_mode)]
        if cfg.options.runtime_mode == 'anki' and cfg.options.ankiaddon_root_path:
            cmd += ['--ankiaddon-root-path', str(cfg.options.ankiaddon_root_path)]
    if cfg.paths.static_dir:
        cmd += ['--static-dir', str(cfg.paths.static_dir)]
    if cfg.paths.pdfs_dir:
        cmd += ['--pdfs-dir', str(cfg.paths.pdfs_dir)]

    try:
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        subprocess.Popen(
            cmd,
            cwd=str(root),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation,
        )
        if on_log:
            on_log("Backend CLI started: " + ' '.join(map(str, cmd)))
        return True
    except Exception as e:
        if on_log:
            on_log(f"[ERROR] Backend CLI start failed: {e}")
        return False


def start_backend_hosted(cfg: LauncherConfig, *, parent_app, on_log: Optional[Callable[[str], None]] = None):
    root = resolve_component_root()
    from src.backend.launcher import BackendLauncher
    runtime_mode = cfg.options.runtime_mode or 'single'

    inst = BackendLauncher(
        parent_app=parent_app,
        show_ui=False,
        runtime_mode=runtime_mode,
        ankiaddon_root_path=cfg.options.ankiaddon_root_path,
        data_dir=cfg.paths.data_dir,
        db_path=cfg.paths.db_path,
        static_dir=cfg.paths.static_dir,
        pdfs_dir=cfg.paths.pdfs_dir,
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, 'logs_dir', None) else None,
    )
    ok = inst.start(msgCenter_port=cfg.ports.msgCenter_port, pdfFile_port=cfg.ports.pdfFile_port)
    if on_log:
        on_log(f"Hosted backend started: ok={ok}")
    return inst if ok else None


def start_pdf_home_hosted(cfg: LauncherConfig, *, parent_app, on_log: Optional[Callable[[str], None]] = None) -> int:
    """
    已废弃：建议使用 ensure_pdf_home_hosted（具有单例化与激活能力）。
    """
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'
    spec = _il.spec_from_file_location('pdf_home_launcher', str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError('无法定位 pdf-home launcher 模块')
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source='gui',
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, 'logs_dir', None) else None,
    )
    PdfHomeApp = getattr(mod, 'PdfHomeApp')
    inst = PdfHomeApp(fe_cfg, parent_app=parent_app)
    rc = inst.run()
    if on_log:
        on_log(f"PdfHome hosted run rc={rc}")
    return int(rc or 0)


def start_pdf_viewer_hosted(cfg: LauncherConfig, *, parent_app, pdf_id: Optional[str] = None,
                            page_at: Optional[int] = None, position: Optional[float] = None,
                            anchor_id: Optional[str] = None, annotation_id: Optional[str] = None,
                            outline_item_id: Optional[str] = None, enable_outline: Optional[bool] = None,
                            on_log: Optional[Callable[[str], None]] = None) -> int:
    """
    已废弃：建议使用 ensure_pdf_viewer_hosted（具有按 pdf_id 单例化与激活能力）。
    """
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'
    spec = _il.spec_from_file_location('pdf_viewer_launcher', str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError('无法定位 pdf-viewer launcher 模块')
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    # 组装额外 URL 参数
    _extra: Dict[str, Any] = {}
    if outline_item_id:
        _extra["outline_item_id"] = outline_item_id
    if enable_outline:
        # 改为通过 debug=1 触发前端 WS 读取 debug-info（其中 outline=1 决定是否启用 Outline）
        _extra["debug"] = "1"

    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source='gui',
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, 'logs_dir', None) else None,
        pdf_id=pdf_id,
        page_at=page_at,
        position=position,
        anchor_id=anchor_id,
        annotation_id=annotation_id,
        extra_params=_extra,
    )
    PdfViewerApp = getattr(mod, 'PdfViewerApp')
    inst = PdfViewerApp(fe_cfg, parent_app=parent_app)
    rc = inst.run()
    if on_log:
        on_log(f"PdfViewer hosted run rc={rc}")
    return int(rc or 0)


# ------------------------- 单例化（Hosted）-------------------------
def ensure_pdf_home_hosted(cfg: LauncherConfig, *, parent_app, on_log: Optional[Callable[[str], None]] = None) -> int:
    """
    确保 pdf-home 仅一个实例：
    - 已存在 → 激活窗口并返回 0
    - 不存在 → 按 Hosted 路径创建并运行初始化，注册到单例表
    """
    reg = get_registry()
    existing = reg.get_pdf_home()
    if existing and getattr(existing, "window", None):
        try:
            activate_window(existing.window)
            if on_log: on_log("[Singleton] pdf-home already running, activated window")
            return 0
        except Exception:
            pass
    # 创建新实例（与 start_pdf_home_hosted 相同路径）
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'
    spec = _il.spec_from_file_location('pdf_home_launcher', str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError('无法定位 pdf-home launcher 模块')
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source='gui',
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, 'logs_dir', None) else None,
    )
    PdfHomeApp = getattr(mod, 'PdfHomeApp')
    app_inst = PdfHomeApp(fe_cfg, parent_app=parent_app)
    rc = app_inst.run()
    reg.set_pdf_home(app_inst)
    # 尝试绑定 window 关闭以清理单例（若提供了 window_closing）
    try:
        win = getattr(app_inst, "window", None)
        if win and hasattr(win, "window_closing"):
            def _on_home_close(*_a, **_k):
                try:
                    reg.set_pdf_home(None)
                    if on_log: on_log("[Singleton] pdf-home closed → unregistered")
                except Exception:
                    pass
            try:
                win.window_closing.connect(_on_home_close)  # type: ignore[attr-defined]
            except Exception:
                pass
    except Exception:
        pass
    if on_log: on_log(f"[Singleton] PdfHome hosted run rc={rc}")
    return int(rc or 0)


def ensure_pdf_viewer_hosted(cfg: LauncherConfig, *, parent_app, pdf_id: Optional[str] = None,
                             page_at: Optional[int] = None, position: Optional[float] = None,
                             anchor_id: Optional[str] = None, annotation_id: Optional[str] = None,
                             outline_item_id: Optional[str] = None, enable_outline: Optional[bool] = None,
                             on_log: Optional[Callable[[str], None]] = None) -> int:
    """
    确保每个 pdf-id 对应单例 pdf-viewer：
    - 已存在 → 激活窗口并返回 0（不做跳转变更；后续如需实现“激活并导航”，可在此追加定向事件）
    - 不存在 → 按 Hosted 路径创建并运行初始化，注册到单例表
    """
    reg = get_registry()
    if pdf_id:
        existing = reg.get_viewer(str(pdf_id))
        if existing:
            win = getattr(existing, "window", None)
            if win and _is_qobject_alive(win):
                try:
                    activate_window(win)
                    if on_log: on_log(f"[Singleton] pdf-viewer({pdf_id}) already running, activated window")
                    return 0
                except Exception:
                    # 若激活异常，丢弃并走创建分支
                    try: reg.discard_viewer(str(pdf_id))
                    except Exception: pass
            else:
                # 窗口已被销毁/无效，丢弃注册表记录
                try: reg.discard_viewer(str(pdf_id))
                except Exception: pass

    # 创建新实例（与 start_pdf_viewer_hosted 相同路径）
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'
    spec = _il.spec_from_file_location('pdf_viewer_launcher', str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError('无法定位 pdf-viewer launcher 模块')
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    # 额外 URL 参数
    _extra: Dict[str, Any] = {}
    if outline_item_id:
        _extra["outline_item_id"] = outline_item_id
    if enable_outline:
        _extra["debug"] = "1"
    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source='gui',
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, 'logs_dir', None) else None,
        pdf_id=pdf_id,
        page_at=page_at,
        position=position,
        anchor_id=anchor_id,
        annotation_id=annotation_id,
        extra_params=_extra,
    )
    PdfViewerApp = getattr(mod, 'PdfViewerApp')
    viewer = PdfViewerApp(fe_cfg, parent_app=parent_app)
    # 执行初始化与（hosted）run
    rc = viewer.run()
    if pdf_id:
        reg.set_viewer(str(pdf_id), viewer)
        # 绑定窗口关闭信号以便及时清理注册表，避免陈旧记录阻塞再次打开
        try:
            win = getattr(viewer, "window", None)
            if win:
                def _on_win_close(*_args, **_kwargs):
                    try:
                        reg.discard_viewer(str(pdf_id))
                        if on_log: on_log(f"[Singleton] viewer({pdf_id}) closed → unregistered")
                    except Exception:
                        pass
                try:
                    win.window_closing.connect(_on_win_close)  # type: ignore[attr-defined]
                except Exception:
                    pass
                try:
                    win.destroyed.connect(lambda *_: reg.discard_viewer(str(pdf_id)))  # type: ignore[attr-defined]
                except Exception:
                    pass
        except Exception:
            pass
    if on_log: on_log(f"[Singleton] PdfViewer hosted run rc={rc}")
    return int(rc or 0)


def start_pdf_home_cli(cfg: LauncherConfig, *, is_prod: bool, on_log: Optional[Callable[[str], None]] = None) -> bool:
    """以子进程方式启动 pdf-home 前端 launcher（统一在 runner）。

    - 根据 is_prod 决定传入 --prod 或 --vite-port。
    - 端口来源：优先 cfg.ports / 次之 logs/runtime-ports.json。
    - 日志与 cwd：组件根；调用方负责记录 GUI 侧状态。
    """
    root = resolve_component_root()
    import subprocess

    launcher_path = root / 'src' / 'frontend' / 'pdf-home' / 'launcher.py'
    cmd = [sys.executable, str(launcher_path)]

    # 读取 runtime 端口
    logs_dir = Path(cfg.paths.logs_dir) if cfg.paths.logs_dir else (root / 'logs')
    ports = read_runtime_ports(logs_dir)
    vite_port = cfg.ports.vite_port or ports.get('vite_port') or ports.get('npm_port')
    msg_port = cfg.ports.msgCenter_port or ports.get('msgCenter_port')
    pdf_port = cfg.ports.pdfFile_port or ports.get('pdfFile_port')
    if on_log:
        on_log(f"[TRACE:RUNNER:CLI] pdf-home input cfg ports={cfg.ports} options.frontend_prod={cfg.options.frontend_prod} is_prod={is_prod} logs_dir={logs_dir}")
        on_log(f"[TRACE:RUNNER:CLI] pdf-home runtime-ports={ports}")

    if is_prod:
        cmd.append('--prod')
    elif vite_port:
        cmd += ['--vite-port', str(int(vite_port))]
    if msg_port:
        cmd += ['--msgCenter-port', str(int(msg_port))]
    if pdf_port:
        cmd += ['--pdfFile-port', str(int(pdf_port))]
    cmd.append('--keep-backend')
    if getattr(cfg.paths, 'logs_dir', None):
        cmd += ['--logs-dir', str(cfg.paths.logs_dir)]

    try:
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        subprocess.Popen(
            cmd,
            cwd=str(root),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation,
        )
        if on_log:
            on_log('[TRACE:RUNNER:CLI] PdfHome CLI started: ' + ' '.join(map(str, cmd)))
        return True
    except Exception as e:
        if on_log:
            on_log(f"[ERROR] PdfHome CLI start failed: {e}")
        return False


def start_pdf_viewer_cli(cfg: LauncherConfig, *, is_prod: bool, pdf_id: Optional[str] = None,
                         page_at: Optional[int] = None, position: Optional[float] = None,
                         anchor_id: Optional[str] = None, annotation_id: Optional[str] = None,
                         outline_item_id: Optional[str] = None,
                         on_log: Optional[Callable[[str], None]] = None) -> bool:
    """以子进程方式启动 pdf-viewer 前端 launcher（统一在 runner）。"""
    root = resolve_component_root()
    import subprocess

    launcher_path = root / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'
    cmd = [sys.executable, str(launcher_path)]

    logs_dir = Path(cfg.paths.logs_dir) if cfg.paths.logs_dir else (root / 'logs')
    ports = read_runtime_ports(logs_dir)
    vite_port = cfg.ports.vite_port or ports.get('vite_port') or ports.get('npm_port')
    msg_port = cfg.ports.msgCenter_port or ports.get('msgCenter_port')
    pdf_port = cfg.ports.pdfFile_port or ports.get('pdfFile_port')
    if on_log:
        on_log(f"[TRACE:RUNNER:CLI] pdf-viewer input cfg ports={cfg.ports} options.frontend_prod={cfg.options.frontend_prod} is_prod={is_prod} logs_dir={logs_dir}")
        on_log(f"[TRACE:RUNNER:CLI] pdf-viewer runtime-ports={ports}")

    if is_prod:
        cmd.append('--prod')
    elif vite_port:
        cmd += ['--vite-port', str(int(vite_port))]
    if msg_port:
        cmd += ['--msgCenter-port', str(int(msg_port))]
    if pdf_port:
        cmd += ['--pdfFile-port', str(int(pdf_port))]
    if pdf_id:
        cmd += ['--pdf-id', str(pdf_id)]
    if page_at is not None:
        cmd += ['--page-at', str(int(page_at))]
    if position is not None:
        cmd += ['--position', str(float(position))]
    if anchor_id:
        cmd += ['--anchor-id', str(anchor_id)]
    if annotation_id:
        cmd += ['--annotation-id', str(annotation_id)]
    if outline_item_id:
        cmd += ['--outline-item-id', str(outline_item_id)]
    cmd.append('--keep-backend')
    if getattr(cfg.paths, 'logs_dir', None):
        cmd += ['--logs-dir', str(cfg.paths.logs_dir)]

    try:
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        subprocess.Popen(
            cmd,
            cwd=str(root),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation,
        )
        if on_log:
            on_log('[TRACE:RUNNER:CLI] PdfViewer CLI started: ' + ' '.join(map(str, cmd)))
        return True
    except Exception as e:
        if on_log:
            on_log(f"[ERROR] PdfViewer CLI start failed: {e}")
        return False
