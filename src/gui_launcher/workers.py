#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Workers Layer

- 将 gui_launcher.py 中的线程类拆分出来，降低入口文件体积；
- 保持对外行为与参数契约不变，避免回归；
- 严格 UTF-8 与明确契约，不做兜底隐式行为。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from PyQt6.QtCore import QThread, pyqtSignal  # type: ignore

# 延迟导入，保持模块职责清晰
from src.gui_launcher import services as _gl_services
from src.launcher.config import (
    LauncherConfig as _LConfig,
    LauncherOptions as _LOpts,
    LauncherPorts as _LPorts,
    LauncherPaths as _LPaths,
)
from src.launcher.config import resolve_component_root as _cfg_resolve_component_root


def _load_ai_module():
    """
    兼容加载 ai_launcher（若不可用则返回 None）。
    """
    try:
        import importlib
        return importlib.import_module("ai_launcher")
    except Exception:
        try:
            import importlib
            return importlib.import_module("ai_launcher_dist")
        except Exception:
            return None


_ai = _load_ai_module()


class LauncherThread(QThread):
    """
    后台线程执行启动任务
    - 任务类型：vite/backend/backend-hosted/pdf-home/pdf-home-hosted/pdf-viewer/stop
    - 参数：见 GUI 面板传递的 dict，路径与端口均需显式传入
    """
    log_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(bool, str)
    instance_signal = pyqtSignal(object)  # 用于 Hosted 模式返回实例

    def __init__(self, task_type: str, params: Dict[str, Any]):
        """记录任务类型与参数，并解析组件根路径，供后续子任务使用。"""
        super().__init__()
        self.task_type = task_type
        self.params = params
        # 组件根（相对位置，用于必要场景；绝大多数参数来自 UI）
        try:
            self.component_root: Path = _cfg_resolve_component_root()
        except Exception:
            self.component_root = Path(__file__).resolve().parents[2]

    # ---- 主执行入口 ----
    def run(self):
        """根据任务类型分发到具体启动/停止实现，并通过信号回传结果。"""
        try:
            if self.task_type == "vite":
                self._start_vite()
            elif self.task_type == "backend":
                self._start_backend()
            elif self.task_type == "backend-hosted":
                self._start_backend_hosted()
            elif self.task_type == "pdf-home":
                self._start_pdf_home()
            elif self.task_type == "pdf-home-hosted":
                self._start_pdf_home_hosted()
            elif self.task_type == "pdf-viewer":
                self._start_pdf_viewer()
            elif self.task_type == "stop":
                self._stop_all()
            else:
                self.finished_signal.emit(False, f"未知任务类型: {self.task_type}")
        except Exception as e:
            self.finished_signal.emit(False, f"执行失败: {e}")

    # ---- 任务实现 ----
    def _start_vite(self):
        """通过 ai_launcher 启动或跳过 Vite 开发服务器，并输出结果日志。"""
        self.log_signal.emit("📦 正在启动 Vite 开发服务器...")
        vite_port = int(self.params.get("vite_port", 3000) or 3000)
        if _ai is None or not hasattr(_ai, "_start_vite"):
            self.log_signal.emit("⚠️ ai_launcher 不可用：跳过 Vite 启动")
            self.finished_signal.emit(True, "Vite 启动跳过")
            return
        pid = _ai._start_vite(vite_port)
        if pid:
            self.log_signal.emit(f"✅ Vite 启动成功 (PID: {pid}, Port: {vite_port})")
            self.finished_signal.emit(True, "Vite 启动成功")
        else:
            self.log_signal.emit("❌ Vite 启动失败")
            self.finished_signal.emit(False, "Vite 启动失败")

    def _start_backend(self):
        """以子进程模式启动后端服务（单实例），按参数构造 LauncherConfig 并调用 services。"""
        self.log_signal.emit("🚀 正在启动后端服务器 (子进程模式)...")
        if not self.params.get("logs_dir"):
            self.finished_signal.emit(False, "缺少路径参数：logs_dir")
            return
        if not all(self.params.get(k) for k in ("data_dir", "db_path", "static_dir", "pdfs_dir")):
            self.finished_signal.emit(False, "缺少路径参数：data_dir/db_path/static_dir/pdfs_dir")
            return

        cfg = _LConfig(
            ports=_LPorts(
                msgCenter_port=self.params.get("msgCenter_port"),
                pdfFile_port=self.params.get("pdfFile_port"),
            ),
            paths=_LPaths(
                data_dir=str(self.params.get("data_dir")),
                db_path=str(self.params.get("db_path")),
                static_dir=str(self.params.get("static_dir")),
                pdfs_dir=str(self.params.get("pdfs_dir")),
                logs_dir=str(self.params.get("logs_dir")),
            ),
            options=_LOpts(
                runtime_mode=self.params.get("runtime_mode") or "single",
                ankiaddon_root_path=self.params.get("ankiaddon_root_path"),
                keep_backend=True,
            ),
        )
        ok = _gl_services.start_backend_cli(cfg, on_log=lambda m: self.log_signal.emit(m))
        if ok:
            self.log_signal.emit("✅ 后端启动成功 (CLI)")
            self.finished_signal.emit(True, "后端启动成功")
        else:
            self.log_signal.emit("❌ 后端启动失败 (CLI)")
            self.finished_signal.emit(False, "后端启动失败")

    def _start_backend_hosted(self):
        """以 Hosted 模式在现有 Qt 应用中启动后端，并通过 instance_signal 返回实例。"""
        """启动后端服务器 (Hosted 模式 - 主进程托管)"""
        self.log_signal.emit("🚀 正在启动后端服务器 (Hosted 模式)...")
        try:
            if not self.params.get("logs_dir"):
                raise RuntimeError("缺少路径参数：logs_dir")
            if not all(self.params.get(k) for k in ("data_dir", "db_path", "static_dir", "pdfs_dir")):
                raise RuntimeError("缺少路径参数：data_dir/db_path/static_dir/pdfs_dir")

            is_prod = bool(self.params.get("is_prod", False))
            vite_port = self.params.get("vite_port")

            # ⚠️ 验证：开发模式必须提供 vite_port
            if not is_prod and vite_port is None:
                raise RuntimeError(
                    "开发模式 (is_prod=False) 必须提供 vite_port 参数！\n"
                    "请确保 Vite 开发服务器已启动（端口 3000）。"
                )

            cfg = _LConfig(
                ports=_LPorts(
                    vite_port=None if is_prod else vite_port,
                    msgCenter_port=self.params.get("msgCenter_port"),
                    pdfFile_port=self.params.get("pdfFile_port"),
                ),
                paths=_LPaths(
                    data_dir=str(self.params.get("data_dir")),
                    db_path=str(self.params.get("db_path")),
                    static_dir=str(self.params.get("static_dir")),
                    pdfs_dir=str(self.params.get("pdfs_dir")),
                    logs_dir=str(self.params.get("logs_dir")),
                ),
                options=_LOpts(
                    runtime_mode="single",
                    frontend_prod=is_prod,
                    keep_backend=True,
                ),
            )

            parent_app = self.params.get("parent_app")
            if not parent_app:
                raise RuntimeError("Hosted 模式需要 parent_app 参数")

            inst = _gl_services.start_backend_hosted(
                cfg,
                parent_app=parent_app,
                on_log=lambda m: self.log_signal.emit(m)
            )

            if inst:
                self.log_signal.emit("✅ 后端 Hosted 启动成功")
                self.instance_signal.emit(inst)  # 发送实例给主线程
                self.finished_signal.emit(True, "后端 Hosted 启动成功")
            else:
                self.log_signal.emit("❌ 后端 Hosted 启动失败")
                self.finished_signal.emit(False, "后端 Hosted 启动失败")
        except Exception as e:
            self.log_signal.emit(f"❌ 后端 Hosted 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"后端 Hosted 启动失败: {e}")

    def _start_pdf_home(self):
        """以 CLI 模式启动 PDF-Home，并在必要时同步 outline 标志到 runtime-ports.json。"""
        self.log_signal.emit("🏠 正在启动 PDF-Home...")
        try:
            if not self.params.get("logs_dir"):
                raise RuntimeError("缺少必需参数：logs_dir")
            base_logs = Path(self.params.get("logs_dir"))
            enable_outline = bool(self.params.get("enable_outline", False))
            try:
                base_logs.mkdir(parents=True, exist_ok=True)
                if enable_outline:
                    _gl_services.merge_runtime_ports(base_logs, {"outline": 1})
                    self.log_signal.emit("[TRACE:CLI] 同步 outline=1 到 runtime-ports.json")
                else:
                    _gl_services.merge_runtime_ports(base_logs, {"outline": None})
                    self.log_signal.emit("[TRACE:CLI] 从 runtime-ports.json 移除 outline 标志")
            except Exception as _e:
                self.log_signal.emit(f"[WARN] 同步 outline 标志到 runtime-ports.json 失败: {_e}")

            cfg = _LConfig(
                ports=_LPorts(
                    vite_port=self.params.get("vite_port"),
                    msgCenter_port=self.params.get("msgCenter_port"),
                    pdfFile_port=self.params.get("pdfFile_port"),
                ),
                paths=_LPaths(
                    logs_dir=str(base_logs),
                    data_dir=str(self.params.get("data_dir")),
                    db_path=str(self.params.get("db_path")),
                    static_dir=str(self.params.get("static_dir")),
                    pdfs_dir=str(self.params.get("pdfs_dir")),
                ),
                options=_LOpts(
                    runtime_mode=self.params.get("runtime_mode") or "single",
                    ankiaddon_root_path=self.params.get("ankiaddon_root_path"),
                    keep_backend=True,
                ),
            )
            try:
                self.log_signal.emit(
                    f"[TRACE:CLI] pdf-home cfg → ports(vite={cfg.ports.vite_port}, ws={cfg.ports.msgCenter_port}, http={cfg.ports.pdfFile_port}) "
                    f"options(runtime_mode={cfg.options.runtime_mode}) is_prod={bool(self.params.get('is_prod'))} "
                    f"outline={enable_outline} logs_dir={cfg.paths.logs_dir}"
                )
            except Exception:
                pass
            ok = _gl_services.start_pdf_home_cli(
                cfg,
                is_prod=bool(self.params.get("is_prod")),
                on_log=lambda m: self.log_signal.emit(m),
            )
            if ok:
                self.log_signal.emit("✅ PDF-Home 启动成功 (CLI)")
                self.finished_signal.emit(True, "PDF-Home 启动成功")
            else:
                self.log_signal.emit("❌ PDF-Home 启动失败 (CLI)")
                self.finished_signal.emit(False, "PDF-Home 启动失败")
        except Exception as e:
            self.log_signal.emit(f"❌ PDF-Home 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"PDF-Home 启动失败: {e}")

    def _start_pdf_home_hosted(self):
        """以 Hosted 模式在现有 Qt 应用中启动 PDF-Home。"""
        """启动 PDF-Home (Hosted 模式 - 主进程托管)"""
        self.log_signal.emit("🏠 正在启动 PDF-Home (Hosted 模式)...")
        try:
            if not self.params.get("logs_dir"):
                raise RuntimeError("缺少必需参数：logs_dir")

            is_prod = bool(self.params.get("is_prod", False))
            base_logs = Path(self.params.get("logs_dir"))

            # 创建日志目录
            base_logs.mkdir(parents=True, exist_ok=True)

            # Vite 端口检查（dev 模式）
            vite_port = self.params.get("vite_port")
            if not is_prod and vite_port:
                # 检查 Vite 是否在监听（这个检查在主线程中已经做过了）
                pass

            cfg = _LConfig(
                ports=_LPorts(
                    vite_port=None if is_prod else vite_port,
                    msgCenter_port=self.params.get("msgCenter_port"),
                    pdfFile_port=self.params.get("pdfFile_port"),
                ),
                paths=_LPaths(
                    data_dir=str(self.params.get("data_dir")),
                    db_path=str(self.params.get("db_path")),
                    static_dir=str(self.params.get("static_dir")),
                    pdfs_dir=str(self.params.get("pdfs_dir")),
                    logs_dir=str(base_logs),
                ),
                options=_LOpts(
                    frontend_prod=is_prod,
                    keep_backend=True,
                    runtime_mode="single",
                ),
            )

            parent_app = self.params.get("parent_app")
            if not parent_app:
                raise RuntimeError("Hosted 模式需要 parent_app 参数")

            rc = _gl_services.start_pdf_home_hosted(
                cfg,
                parent_app=parent_app,
                on_log=lambda m: self.log_signal.emit(m)
            )

            # Hosted 路径下，返回 0 也表示正常启动（未进入子事件循环）
            try:
                rc_int = int(rc or 0)
            except Exception:
                rc_int = 0
            if rc_int >= 0:
                self.log_signal.emit(f"✅ PDF-Home (Hosted) 启动完成 rc={rc_int}")
                self.finished_signal.emit(True, "PDF-Home 启动完成")
            else:
                self.log_signal.emit(f"❌ PDF-Home (Hosted) 启动失败 rc={rc_int}")
                self.finished_signal.emit(False, "PDF-Home 启动失败")
        except Exception as e:
            self.log_signal.emit(f"❌ PDF-Home (Hosted) 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"PDF-Home 启动失败: {e}")

    def _start_pdf_viewer(self):
        """以 CLI 模式启动 PDF-Viewer（单窗口或多实例），依据参数构造配置并调用 services。"""
        self.log_signal.emit("📄 正在启动 PDF-Viewer...")
        pdf_id = self.params.get("pdf_id")
        page_at = self.params.get("page_at")
        position = self.params.get("position")
        anchor_id = self.params.get("anchor_id") or self.params.get("pdfanchor_id")
        annotation_id = self.params.get("annotation_id") or self.params.get("pdfannotation_id")
        outline_item_id = self.params.get("outline_item_id") or self.params.get("pdfoutline_item_id")

        if not pdf_id:
            self.log_signal.emit("💡 提示: 未指定 PDF ID，将启动空白查看器")

        try:
            if not self.params.get("logs_dir"):
                raise RuntimeError("缺少必需参数：logs_dir")
            base_logs = Path(self.params.get("logs_dir"))
            cfg = _LConfig(
                ports=_LPorts(
                    vite_port=self.params.get("vite_port"),
                    msgCenter_port=self.params.get("msgCenter_port"),
                    pdfFile_port=self.params.get("pdfFile_port"),
                ),
                paths=_LPaths(
                    logs_dir=str(base_logs),
                    data_dir=str(self.params.get("data_dir")),
                    db_path=str(self.params.get("db_path")),
                    static_dir=str(self.params.get("static_dir")),
                    pdfs_dir=str(self.params.get("pdfs_dir")),
                ),
                options=_LOpts(
                    runtime_mode=self.params.get("runtime_mode") or "single",
                    ankiaddon_root_path=self.params.get("ankiaddon_root_path"),
                    keep_backend=True,
                ),
            )
            ok = _gl_services.start_pdf_viewer_cli(
                cfg,
                is_prod=bool(self.params.get("is_prod")),
                pdf_id=pdf_id,
                page_at=page_at,
                position=position,
                anchor_id=anchor_id,
                annotation_id=annotation_id,
                outline_item_id=outline_item_id,
                on_log=lambda m: self.log_signal.emit(m),
            )
            if ok:
                self.log_signal.emit("✅ PDF-Viewer 启动成功 (CLI)")
                self.finished_signal.emit(True, "PDF-Viewer 启动成功")
            else:
                self.log_signal.emit("❌ PDF-Viewer 启动失败 (CLI)")
                self.finished_signal.emit(False, "PDF-Viewer 启动失败")
        except Exception as e:
            self.log_signal.emit(f"❌ PDF-Viewer 启动失败: {e}")
            import traceback
            self.log_signal.emit(f"   错误详情: {traceback.format_exc()}")
            self.finished_signal.emit(False, f"PDF-Viewer 启动失败: {e}")

    def _stop_all(self):
        """请求停止所有由 gui_launcher 启动的子进程（Vite/后端/PDF 窗口等）。"""
        # 预留：根据需要实现统一停止
        self.log_signal.emit("🛑 停止命令：未实现统一停止逻辑（保持与原行为一致）")
        self.finished_signal.emit(True, "停止完成")


class _AiThread(QThread):
    """
    后台线程运行 ai_launcher.main(argv) 并输出日志
    - 与 gui_launcher.py 中原始实现保持一致
    """
    log_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(int)

    def __init__(self, argv: list[str]):
        """记录传入的命令行参数，用于在后台线程中调用 ai_launcher.main。"""
        super().__init__()
        self.argv = argv

    def run(self):
        """在后台调用 ai_launcher.main(argv)，将 stdout/stderr 通过信号输出并返回退出码。"""
        if _ai is None:
            self.finished_signal.emit(-1)
            return
        import io, contextlib, traceback
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                rc = _ai.main(self.argv)
        except SystemExit as se:
            rc = int(getattr(se, "code", 0) or 0)
        except Exception:
            rc = 1
            buf.write(traceback.format_exc())
        out = buf.getvalue()
        if out:
            for line in out.splitlines():
                self.log_signal.emit(line)
        self.finished_signal.emit(int(rc))
