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
    ok = inst.start(
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        url_port=cfg.ports.url_port  # ✅ 传入 url_port (dev模式=vite_port, prod模式=pdfFile_port)
    )
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
        url_port=cfg.ports.url_port,  # ✅ 新增：前端资源获取统一端口（dev=vite_port, prod=pdfFile_port）
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
        url_port=cfg.ports.url_port,  # ✅ 新增：前端资源获取统一端口（dev=vite_port, prod=pdfFile_port）
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
def ensure_pdf_home_hosted(
    cfg: LauncherConfig,
    *,
    parent_app,
    on_log: Optional[Callable[[str], None]] = None,
    window_lifecycle: Any = None,
) -> int:
    """
    确保 pdf-home 仅一个实例：
    - 已存在 → 激活窗口并返回 0
    - 不存在 → 按 Hosted 路径创建并运行初始化，注册到单例表
    """
    reg = get_registry()
    existing = reg.get_pdf_home()
    if existing and getattr(existing, "window", None):
        try:
            win = getattr(existing, "window", None)
            if window_lifecycle is not None and win is not None:
                try:
                    window_lifecycle.register_window("pdf-home", existing, win, {"window_type": "pdf-home"})
                except Exception:
                    pass
            activate_window(win)
            if on_log:
                on_log("[Singleton] pdf-home already running, activated window")
            return 0
        except Exception:
            try:
                reg.set_pdf_home(None)
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
        url_port=cfg.ports.url_port,  # ✅ 新增：前端资源获取统一端口（dev=vite_port, prod=pdfFile_port）
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
    try:
        win = getattr(app_inst, "window", None)
        if window_lifecycle is not None and win is not None:
            try:
                window_lifecycle.register_window("pdf-home", app_inst, win, {"window_type": "pdf-home"})
                ws_client = getattr(app_inst, "ws_client", None)
                if ws_client is not None:
                    window_lifecycle.bind_ws_client("pdf-home", ws_client)
            except Exception:
                pass
    except Exception:
        pass
    # 尝试绑定 window 关闭以清理单例（若提供了 window_closing）
    try:
        win = getattr(app_inst, "window", None)
        if win and hasattr(win, "window_closing"):
            def _on_home_close(*_a, **_k):
                try:
                    reg.set_pdf_home(None)
                    if window_lifecycle is not None:
                        try:
                            window_lifecycle.on_window_closed(win)
                        except Exception:
                            pass
                    if on_log:
                        on_log("[Singleton] pdf-home closed → unregistered")
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


def ensure_pdf_viewer_hosted(
    cfg: LauncherConfig,
    *,
    parent_app,
    pdf_id: Optional[str] = None,
    page_at: Optional[int] = None,
    position: Optional[float] = None,
    anchor_id: Optional[str] = None,
    annotation_id: Optional[str] = None,
    outline_item_id: Optional[str] = None,
    enable_outline: Optional[bool] = None,
    on_log: Optional[Callable[[str], None]] = None,
    window_lifecycle: Any = None,
) -> int:
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
                # 确保生命周期管理器中也有记录
                if window_lifecycle is not None:
                    client_id = f"pdf-viewer-{pdf_id}"
                    try:
                        window_lifecycle.register_window(
                            client_id,
                            existing,
                            win,
                            {"window_type": "pdf-viewer", "pdf_id": str(pdf_id)},
                        )
                        ws_client = getattr(existing, "ws_client", None)
                        if ws_client is not None:
                            window_lifecycle.bind_ws_client(client_id, ws_client)
                    except Exception:
                        pass
                try:
                    activate_window(win)
                    if on_log:
                        on_log(f"[Singleton] pdf-viewer({pdf_id}) already running, activated window")
                    return 0
                except Exception:
                    # 若激活异常，丢弃并走创建分支
                    try:
                        reg.discard_viewer(str(pdf_id))
                    except Exception:
                        pass
            else:
                # 窗口已被销毁/无效，丢弃注册表记录
                try:
                    reg.discard_viewer(str(pdf_id))
                except Exception:
                    pass

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
        url_port=cfg.ports.url_port,  # ✅ 新增：前端资源获取统一端口（dev=vite_port, prod=pdfFile_port）
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
        client_id = f"pdf-viewer-{pdf_id}"
        # 注册到 WindowLifecycleManager（若提供）
        if window_lifecycle is not None:
            try:
                win = getattr(viewer, "window", None)
                if win is not None:
                    window_lifecycle.register_window(
                        client_id,
                        viewer,
                        win,
                        {"window_type": "pdf-viewer", "pdf_id": str(pdf_id)},
                    )
                    ws_client = getattr(viewer, "ws_client", None)
                    if ws_client is not None:
                        window_lifecycle.bind_ws_client(client_id, ws_client)
            except Exception:
                pass
        # 绑定窗口关闭信号以便及时清理注册表和生命周期管理器，避免陈旧记录阻塞再次打开
        try:
            win = getattr(viewer, "window", None)
            if win:
                def _on_win_close(*_args, **_kwargs):
                    try:
                        reg.discard_viewer(str(pdf_id))
                        if window_lifecycle is not None:
                            try:
                                window_lifecycle.on_window_closed(win)
                            except Exception:
                                pass
                        if on_log:
                            on_log(f"[Singleton] viewer({pdf_id}) closed → unregistered")
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


def ensure_anno_manager_hosted(
    cfg: LauncherConfig,
    *,
    parent_app,
    on_log: Optional[Callable[[str], None]] = None,
    window_lifecycle: Any = None,
    pdf_id: Optional[str] = None,
) -> int:
    """确保标注管理器窗口在 Hosted 模式下被打开（当前为简单 Web 窗口）。"""
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / "src" / "frontend" / "anno-manager" / "launcher.py"
    spec = _il.spec_from_file_location("anno_manager_launcher", str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError("无法定位 anno-manager launcher 模块")
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    extra_params: Dict[str, Any] = {"client_id": "anno-manager"}
    if pdf_id:
        extra_params["pdf_id"] = str(pdf_id)

    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        url_port=cfg.ports.url_port,
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source="gui",
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, "logs_dir", None) else None,
        extra_params=extra_params,
    )
    AnnoManagerApp = getattr(mod, "AnnoManagerApp")
    app_inst = AnnoManagerApp(fe_cfg, parent_app=parent_app)
    rc = app_inst.run()
    try:
        win = getattr(app_inst, "window", None)
        if window_lifecycle is not None and win is not None:
            try:
                window_lifecycle.register_window("anno-manager", app_inst, win, {"window_type": "anno-manager"})
            except Exception:
                pass
    except Exception:
        pass
    if on_log:
        on_log(f"[Hosted] AnnoManager run rc={rc}")
    return int(rc or 0)


def ensure_new_card_scheduler_hosted(
    cfg: LauncherConfig,
    *,
    parent_app,
    on_log: Optional[Callable[[str], None]] = None,
    window_lifecycle: Any = None,
) -> int:
    """确保新卡片规划器窗口在 Hosted 模式下被打开。"""
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / "src" / "frontend" / "anno-manager" / "launcher.py"
    spec = _il.spec_from_file_location("anno_manager_launcher", str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError("无法定位 anno-manager launcher 模块")
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        url_port=cfg.ports.url_port,
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source="gui",
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, "logs_dir", None) else None,
        extra_params={"client_id": "new-card-scheduler"},
    )
    NewCardSchedulerApp = getattr(mod, "NewCardSchedulerApp")
    app_inst = NewCardSchedulerApp(fe_cfg, parent_app=parent_app)
    rc = app_inst.run()
    try:
        win = getattr(app_inst, "window", None)
        if window_lifecycle is not None and win is not None:
            try:
                window_lifecycle.register_window("new-card-scheduler", app_inst, win, {"window_type": "new-card-scheduler"})
            except Exception:
                pass
    except Exception:
        pass
    if on_log:
        on_log(f"[Hosted] NewCardScheduler run rc={rc}")
    return int(rc or 0)


def ensure_custom_reviewer_hosted(
    cfg: LauncherConfig,
    *,
    parent_app,
    client_id: str,
    on_log: Optional[Callable[[str], None]] = None,
    window_lifecycle: Any = None,
) -> int:
    """确保定制卡片复习器窗口在 Hosted 模式下被打开（支持多实例 client_id）。"""
    root = resolve_component_root()
    import importlib.util as _il
    launcher_path = root / "src" / "frontend" / "anno-manager" / "launcher.py"
    spec = _il.spec_from_file_location("anno_manager_launcher", str(launcher_path))
    if spec is None or spec.loader is None:
        raise ImportError("无法定位 anno-manager launcher 模块")
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    from src.frontend.common.launch_config import LaunchConfig as FEConfig  # type: ignore
    fe_cfg = FEConfig(
        is_prod=bool(cfg.options.frontend_prod),
        keep_backend=bool(cfg.options.keep_backend),
        url_port=cfg.ports.url_port,
        msgCenter_port=cfg.ports.msgCenter_port,
        pdfFile_port=cfg.ports.pdfFile_port,
        vite_port=cfg.ports.vite_port,
        source="gui",
        logs_dir=str(cfg.paths.logs_dir) if getattr(cfg.paths, "logs_dir", None) else None,
        extra_params={"client_id": client_id},
    )
    CustomReviewerApp = getattr(mod, "CustomReviewerApp")
    app_inst = CustomReviewerApp(fe_cfg, parent_app=parent_app)
    rc = app_inst.run()
    try:
        win = getattr(app_inst, "window", None)
        if window_lifecycle is not None and win is not None:
            try:
                window_lifecycle.register_window(client_id, app_inst, win, {"window_type": "custom-reviewer"})
            except Exception:
                pass
    except Exception:
        pass
    if on_log:
        on_log(f"[Hosted] CustomReviewer run rc={rc}")
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

    # 读取端口配置（优先级：cfg.ports > runtime-ports.json）
    logs_dir = Path(cfg.paths.logs_dir) if cfg.paths.logs_dir else (root / 'logs')
    runtime_ports = read_runtime_ports(logs_dir)

    # ✅ 优先使用 url_port，回退到 vite_port（兼容旧调用）
    url_port = cfg.ports.url_port or runtime_ports.get('url_port') or cfg.ports.vite_port or runtime_ports.get('vite_port')
    msgCenter_port = cfg.ports.msgCenter_port or runtime_ports.get('msgCenter_port')
    pdfFile_port = cfg.ports.pdfFile_port or runtime_ports.get('pdfFile_port')

    if on_log:
        on_log(f"[TRACE:RUNNER:CLI] pdf-home cfg.ports={cfg.ports} runtime_ports={runtime_ports}")
        on_log(f"[TRACE:RUNNER:CLI] pdf-home resolved: url={url_port}, msgCenter={msgCenter_port}, pdfFile={pdfFile_port}, is_prod={is_prod}")

    # ✅ 严格校验：缺少必要端口则报错
    missing = []
    if not url_port:
        missing.append('url_port (或 vite_port)')
    if not msgCenter_port:
        missing.append('msgCenter_port')
    if not pdfFile_port:
        missing.append('pdfFile_port')

    if missing:
        error_msg = (
            f"启动 pdf-home 失败，端口缺失：{', '.join(missing)}\n"
            f"runtime-ports.json: {runtime_ports}\n"
            f"解决方案：\n"
            f"1. 通过 GUI 启动后端（自动写入端口配置）\n"
            f"2. 或显式传入 CLI 参数"
        )
        if on_log:
            on_log(f"[ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    # 构建启动命令
    cmd += ['--url-port', str(int(url_port))]  # ✅ 传递 url_port
    cmd += ['--msgCenter-port', str(int(msgCenter_port))]
    cmd += ['--pdfFile-port', str(int(pdfFile_port))]

    if is_prod:
        cmd.append('--prod')
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

    # 读取端口配置（优先级：cfg.ports > runtime-ports.json）
    logs_dir = Path(cfg.paths.logs_dir) if cfg.paths.logs_dir else (root / 'logs')
    runtime_ports = read_runtime_ports(logs_dir)

    # ✅ 优先使用 url_port，回退到 vite_port（兼容旧调用）
    url_port = cfg.ports.url_port or runtime_ports.get('url_port') or cfg.ports.vite_port or runtime_ports.get('vite_port')
    msgCenter_port = cfg.ports.msgCenter_port or runtime_ports.get('msgCenter_port')
    pdfFile_port = cfg.ports.pdfFile_port or runtime_ports.get('pdfFile_port')

    if on_log:
        on_log(f"[TRACE:RUNNER:CLI] pdf-viewer cfg.ports={cfg.ports} runtime_ports={runtime_ports}")
        on_log(f"[TRACE:RUNNER:CLI] pdf-viewer resolved: url={url_port}, msgCenter={msgCenter_port}, pdfFile={pdfFile_port}, is_prod={is_prod}")

    # ✅ 严格校验：缺少必要端口则报错
    missing = []
    if not url_port:
        missing.append('url_port (或 vite_port)')
    if not msgCenter_port:
        missing.append('msgCenter_port')
    if not pdfFile_port:
        missing.append('pdfFile_port')

    if missing:
        error_msg = (
            f"启动 pdf-viewer 失败，端口缺失：{', '.join(missing)}\n"
            f"runtime-ports.json: {runtime_ports}\n"
            f"解决方案：\n"
            f"1. 通过 GUI 启动后端（自动写入端口配置）\n"
            f"2. 或显式传入 CLI 参数"
        )
        if on_log:
            on_log(f"[ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    # 构建启动命令
    cmd += ['--url-port', str(int(url_port))]  # ✅ 传递 url_port
    cmd += ['--msgCenter-port', str(int(msgCenter_port))]
    cmd += ['--pdfFile-port', str(int(pdfFile_port))]

    if is_prod:
        cmd.append('--prod')
    if pdf_id:
        cmd += ['--pdf-id', str(pdf_id)]
    # 按规范，URL 导航参数（page-at/position/anchor-id/annotation-id/outline-item-id）已废弃，不再通过 CLI 传递。
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
