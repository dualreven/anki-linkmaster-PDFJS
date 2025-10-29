# -*- coding: utf-8 -*-
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from .ports import BackendPortManager

logger = logging.getLogger('backend-launcher')

# 计算工程根目录（相对于当前模块）
_this_dir = Path(__file__).resolve().parent               # .../src/backend/launcher_core
project_root = _this_dir.parents[3]                       # repo root


class BackendLauncher:
    """
    后端服务启动器（PyQt 集成版）

    支持两种模式:
    1. 子进程模式: 无 parent_app，自动创建测试 QApplication
    2. 寄宿模式: 传入 parent_app，共享父应用事件循环
    """

    def __init__(self, parent_app=None, show_ui: bool = False, *, db_path: Optional[str] = None,
                 runtime_mode: Optional[str] = None, ankiaddon_root_path: Optional[str] = None,
                 data_dir: Optional[str] = None, static_dir: Optional[str] = None,
                 pdfs_dir: Optional[str] = None, logs_dir: Optional[str] = None):
        """
        初始化后端启动器

        Args:
            parent_app: 父 QApplication（Anki 的 mw 或 None）
            show_ui: 是否显示测试 UI（仅在子进程模式有效，默认 False）
        """
        self.parent_app = parent_app
        self.mode = "hosted" if parent_app else "subprocess"
        self.show_ui = show_ui
        self.db_path = db_path
        self.runtime_mode = runtime_mode
        self.ankiaddon_root_path = ankiaddon_root_path
        self.data_dir = data_dir
        self.static_dir = static_dir
        self.pdfs_dir = pdfs_dir
        self.logs_dir_override: Optional[Path] = Path(logs_dir).expanduser() if logs_dir else None

        self.ws_server = None
        self.http_server = None
        self.test_app = None
        self.test_ui = None

        self.port_manager = BackendPortManager(project_root, logs_dir=self.logs_dir_override or None)

        # 日志记录
        self.logger = logging.getLogger(f'BackendLauncher[{self.mode}]')
        # 若提供了 logs_dir 覆盖，则调整已有 FileHandler 指向新目录
        try:
            if self.logs_dir_override:
                self.logs_dir_override.mkdir(parents=True, exist_ok=True)
                new_path = self.logs_dir_override / 'backend-launcher.log'

                def _retarget(lg: logging.Logger):
                    to_remove = []
                    for h in getattr(lg, 'handlers', []) or []:
                        try:
                            if isinstance(h, logging.FileHandler) and 'backend-launcher.log' in str(getattr(h, 'baseFilename', '')):
                                to_remove.append(h)
                        except Exception:
                            continue
                    for h in to_remove:
                        try:
                            lg.removeHandler(h)
                        except Exception:
                            pass
                    fh = logging.FileHandler(new_path, mode='a', encoding='utf-8')
                    fmt = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
                    fh.setFormatter(fmt)
                    lg.addHandler(fh)

                _retarget(logging.getLogger())
                _retarget(self.logger)
        except Exception:
            pass

    def start(self, msgCenter_port: Optional[int] = None,
              pdfFile_port: Optional[int] = None) -> bool:
        """
        启动后端服务

        Args:
            msgCenter_port: WebSocket 端口（None=自动分配）
            pdfFile_port: HTTP 端口（None=自动分配）
        """
        self.logger.info(f"=== 启动后端服务 ({self.mode} 模式) ===")
        try:
            import sys as _sys
            from pathlib import Path as _Path
            self.logger.info("diagnose: cwd=%s sys.path[0]=%s backend.project_root=%s db_path_param=%s",
                             str(_Path.cwd()), str(_sys.path[0]), str(project_root), str(self.db_path))
        except Exception:
            pass

        try:
            # 1. 子进程模式: 创建 QApplication
            if self.mode == "subprocess":
                from PyQt6.QtWidgets import QApplication
                self.test_app = QApplication(sys.argv)
                parent = self.test_app
                self.logger.info("✅ 已创建测试 QApplication")

                if self._should_show_test_ui():
                    self.logger.info("启动测试 UI...")
                    from src.backend.test_ui import TestUI
                    self.test_ui = TestUI(launcher=self)
                    self.test_ui.show()
                    self.logger.info("✅ 测试 UI 已显示")
            else:
                parent = self.parent_app
                self.logger.info("✅ 使用父应用 QApplication")

            # 2. 端口分配
            ws_port = self._allocate_port('msgCenter_port', msgCenter_port)
            http_port = self._allocate_port('pdfFile_port', pdfFile_port)
            if not (ws_port and http_port):
                self.logger.error("❌ 端口分配失败")
                return False

            # 3. 启动 WebSocket 服务器
            from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer

            # 严格参数校验
            missing = []
            if not self.logs_dir_override:
                missing.append("logs_dir")
            if not self.data_dir:
                missing.append("data_dir")
            if not self.db_path:
                missing.append("db_path")
            if not self.pdfs_dir:
                missing.append("pdfs_dir")
            if not self.static_dir:
                missing.append("static_dir")
            if missing:
                raise RuntimeError(f"缺少必要路径参数：{', '.join(missing)}（禁止兜底）。请在 GUI 或 CLI 显式传入。")

            self.ws_server = EmbedMsgCenterServer(
                host="127.0.0.1",
                port=ws_port,
                parent=parent,
                db_path=self.db_path,
                data_dir=self.data_dir,
            )
            if not self.ws_server.start():
                self.logger.error(f"❌ WebSocket 服务器启动失败: {ws_port}")
                return False
            self.logger.info(f"✅ WebSocket 服务器已启动: ws://127.0.0.1:{ws_port}")

            # 将消息中心作为纯转发层：连接其 message_received 信号，由后端执行实际动作
            try:
                if hasattr(self.ws_server, '_server') and hasattr(self.ws_server._server, 'message_received'):
                    self.ws_server._server.message_received.connect(self._on_msgcenter_message)  # type: ignore[attr-defined]
                    self.logger.info("[BackendLauncher] 已连接 msgCenter.message_received → BackendLauncher._on_msgcenter_message")
                elif hasattr(self.ws_server, 'message_received'):
                    self.ws_server.message_received.connect(self._on_msgcenter_message)  # type: ignore[attr-defined]
                    self.logger.info("[BackendLauncher] 已连接（兼容封装） msgCenter.message_received → BackendLauncher._on_msgcenter_message")
            except Exception as _e:
                self.logger.warning("[BackendLauncher] 连接 msgCenter.message_received 信号失败: %s", str(_e))

            # 4. 启动 HTTP 文件服务器
            from src.backend.pdfFile_server.embed_fileserver import EmbedFileServer

            _data_dir = Path(self.data_dir).expanduser().resolve()
            _pdfs_dir_path = Path(self.pdfs_dir).expanduser().resolve()
            s = Path(self.static_dir).expanduser().resolve()
            if not _pdfs_dir_path.exists():
                raise RuntimeError(f"指定的 pdfs_dir 不存在：{_pdfs_dir_path}")
            if not s.exists():
                raise RuntimeError(f"指定的 static_dir 不存在：{s}")
            if not (s / "pdf-home").exists():
                raise RuntimeError(f"static_dir 缺少子目录：pdf-home（{s / 'pdf-home'}）")
            if not (s / "pdf-viewer").exists():
                raise RuntimeError(f"static_dir 缺少子目录：pdf-viewer（{s / 'pdf-viewer'}）")
            root_dir = _pdfs_dir_path
            pdfs_dir = str(_pdfs_dir_path)
            mounts = {
                "/static": str(s),
                "/pdf-viewer": str(s / "pdf-viewer"),
                "/pdf-home": str(s / "pdf-home"),
            }
            self.http_server = EmbedFileServer(
                root_dir=str(root_dir),
                host="127.0.0.1",
                port=http_port,
                parent=parent,
                pdfs_dir=pdfs_dir,
                static_dir=str(s),
                mounts=mounts,
                logs_dir=str(self.logs_dir_override),
            )
            if not self.http_server.start():
                self.logger.error(f"❌ HTTP 服务器启动失败: {http_port}")
                self.ws_server.stop()
                return False
            self.logger.info(f"✅ HTTP 文件服务器已启动: http://127.0.0.1:{http_port}")

            # 5. 保存端口配置（合并写入）
            self._save_ports(ws_port, http_port)

            # 6. 子进程模式: 运行事件循环
            if self.test_app:
                self.logger.info("\n📌 按 Ctrl+C 或关闭窗口停止服务器\n")
                sys.exit(self.test_app.exec())

            return True
        except Exception as e:
            self.logger.error(f"❌ 启动服务异常: {e}", exc_info=True)
            return False

    def stop(self):
        """停止所有服务"""
        self.logger.info("=== 停止后端服务 ===")
        if self.ws_server:
            self.ws_server.stop()
            self.logger.info("✅ WebSocket 服务器已停止")
        if self.http_server:
            self.http_server.stop()
            self.logger.info("✅ HTTP 服务器已停止")

    def is_ws_running(self) -> bool:
        return self.ws_server and self.ws_server.is_running()

    def is_http_running(self) -> bool:
        return self.http_server and self.http_server.is_running()

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "websocket": {
                "running": self.is_ws_running(),
                "port": self.ws_server.port if self.ws_server else None,
                "clients": self.ws_server.get_client_count() if self.ws_server else 0
            },
            "http": {
                "running": self.is_http_running(),
                "port": self.http_server.port if self.http_server else None
            }
        }

    def _read_debug_info_flags(self) -> Dict[str, Any]:
        """
        读取 logs/debug-info.json，返回调试标志字典（UTF-8）。
        - 仅返回纯标志位键值（过滤 _metadata）
        - 失败返回空 dict
        """
        candidates = []
        try:
            if getattr(self, "logs_dir_override", None):
                candidates.append(Path(self.logs_dir_override))
        except Exception:
            pass
        try:
            candidates.append((project_root / "logs"))
        except Exception:
            pass

        for base in candidates:
            try:
                p = Path(base) / "debug-info.json"
                if p.exists():
                    obj = json.loads(p.read_text(encoding="utf-8") or "{}")
                    if isinstance(obj, dict):
                        return {k: v for k, v in obj.items() if not str(k).startswith("_")}
            except Exception:
                continue
        return {}

    def _is_outline_enabled_flag(self) -> bool:
        """检查 outline 功能是否启用（从 debug-info.json 读取布尔开关）"""
        flags = self._read_debug_info_flags()
        v = flags.get("enable_outline")
        return bool(v) is True

    # 由 msgCenter 转发的消息（按需实现）
    def _on_msgcenter_message(self, client, message: Dict[str, Any]) -> None:
        try:
            self.logger.debug("[MsgDispatch] 收到消息: %s", str(message)[:256])
            msg_type = (message.get('type') or '').strip()
            if not msg_type:
                return
            if msg_type == 'pdf-viewer.outline.enabled-query':
                enabled = self._is_outline_enabled_flag()
                try:
                    # 懒加载 Qt 依赖（仅在此路径使用到）
                    from PyQt6.QtWidgets import QApplication
                    app = QApplication.instance()
                    if not app:
                        self.logger.warning("[MsgDispatch] QApplication.instance() is None, fallback to CLI launch")
                except Exception:
                    pass
                client.send_text(json.dumps({
                    "ok": True,
                    "data": {"enabled": enabled}
                }, ensure_ascii=False))
                return

            # 通过 WS 触发的查看器打开请求（来自 pdf-home 前端）
            if msg_type == 'pdf-library:viewer:requested':
                try:
                    from src.launcher.config import LauncherConfig, LauncherPorts, LauncherPaths, LauncherOptions  # type: ignore
                    from src.launcher.runner import ensure_pdf_viewer_hosted, ensure_pdf_home_hosted  # type: ignore
                except Exception as e:
                    self.logger.error("[MsgDispatch] 无法导入启动器模块: %s", e)
                    return

                data = message.get('data') or {}
                pdf_id = data.get('pdf_id') or data.get('file_id') or data.get('id')
                viewer_opts = data.get('viewer_options') if isinstance(data.get('viewer_options'), dict) else {}
                # 仅接受 pageAt（严格），其余按需解析
                page_at = None
                try:
                    page_at = int(viewer_opts.get('page_at') if viewer_opts.get('page_at') is not None else data.get('page_at'))
                except Exception:
                    page_at = None
                position = None
                try:
                    position = float(viewer_opts.get('position') if viewer_opts.get('position') is not None else data.get('position'))
                except Exception:
                    position = None
                anchor_id = viewer_opts.get('anchor_id') or data.get('anchor_id')
                annotation_id = viewer_opts.get('annotation_id') or data.get('annotation_id')
                outline_item_id = viewer_opts.get('outline_item_id') or data.get('outline_item_id')

                if not pdf_id:
                    self.logger.warning("[MsgDispatch] 忽略打开请求：缺少 pdf_id")
                    return

                # 组装启动配置（沿用 Hosted 环境当前端口与路径，禁止兜底）
                ports = LauncherPorts(
                    msgCenter_port=getattr(self.ws_server, 'port', None) if self.ws_server else None,
                    pdfFile_port=getattr(self.http_server, 'port', None) if self.http_server else None,
                    vite_port=None
                )
                paths = LauncherPaths(
                    data_dir=str(self.data_dir),
                    db_path=str(self.db_path),
                    static_dir=str(self.static_dir) if getattr(self, 'static_dir', None) else None,
                    pdfs_dir=str(self.pdfs_dir) if getattr(self, 'pdfs_dir', None) else None,
                    logs_dir=str(self.logs_dir_override) if getattr(self, 'logs_dir_override', None) else None,
                )
                options = LauncherOptions(
                    runtime_mode=self.runtime_mode or 'single',
                    ankiaddon_root_path=self.ankiaddon_root_path,
                    keep_backend=True,
                    frontend_prod=True
                )
                cfg = LauncherConfig(ports=ports, paths=paths, options=options)

                self.logger.info("[MsgDispatch] 打开 pdf-viewer (hosted): pdf_id=%s page_at=%s pos=%s anchor=%s annot=%s",
                                 str(pdf_id), str(page_at), str(position), str(anchor_id), str(annotation_id))
                try:
                    rc = ensure_pdf_viewer_hosted(
                        cfg,
                        parent_app=self.parent_app or getattr(self, 'app', None),
                        pdf_id=str(pdf_id),
                        page_at=page_at,
                        position=position,
                        anchor_id=anchor_id,
                        annotation_id=annotation_id,
                        on_log=lambda s: self.logger.info("[ViewerHost] %s", s)
                    )
                    self.logger.info("[MsgDispatch] PdfViewer ensure-hosted rc=%s", str(rc))

                    # 若包含导航目标（annotation/anchor/page/outline），在激活/创建后追加一次定向导航请求
                    try:
                        if any([annotation_id, anchor_id, page_at, position, outline_item_id]):
                            from src.backend.msgCenter_server.handlers.pdf_viewer.viewer import navigate_viewer  # type: ignore
                            nav_target = None
                            if annotation_id:
                                nav_target = {"type": "annotation", "annotation_id": str(annotation_id)}
                            elif anchor_id:
                                nav_target = {"type": "anchor", "anchor_id": str(anchor_id)}
                            elif outline_item_id:
                                nav_target = {"type": "outline", "outline_item_id": str(outline_item_id)}
                            elif page_at:
                                t = {"type": "page", "page_number": int(page_at)}
                                try:
                                    if position is not None:
                                        # 统一用 y_percent 表示百分比
                                        t["position"] = {"y_percent": float(position)}
                                except Exception:
                                    pass
                                nav_target = t
                            # outline_item_id 暂未从 viewer_options 透传，这里按需扩展
                            if nav_target:
                                nav_req = {
                                    "to": {"pdf_uuid": str(pdf_id)},
                                    "target": nav_target,
                                    "options": {}
                                }
                                try:
                                    rid = f"nav_{int(time.time()*1000)}"
                                except Exception:
                                    rid = None
                                # 直接调用 handler，内部会通过 _forward_viewer_navigate 定向发送到目标 viewer
                                _server = getattr(self.ws_server, "_server", None) if self.ws_server else None
                                if _server is not None:
                                    resp = navigate_viewer(_server, rid, nav_req)
                                    self.logger.info("[MsgDispatch] Forward navigate → %s", str(resp.get("status") or resp.get("type")))
                                else:
                                    self.logger.warning("[MsgDispatch] 无法导航：ws_server._server 不可用")
                    except Exception as _nav_exc:
                        self.logger.warning("[MsgDispatch] 导航追加失败（已激活窗口）：%s", _nav_exc)
                except Exception as e:
                    self.logger.error("[MsgDispatch] 启动 pdf-viewer 失败: %s", e, exc_info=True)
                return

            # 通过 WS 触发的 pdf-home 打开请求（单例化 + 激活）
            if msg_type in ('pdf-library:open:home', 'pdf-home:open:requested'):
                try:
                    from src.launcher.config import LauncherConfig, LauncherPorts, LauncherPaths, LauncherOptions  # type: ignore
                    from src.launcher.runner import ensure_pdf_home_hosted  # type: ignore
                except Exception as e:
                    self.logger.error("[MsgDispatch] 无法导入启动器模块: %s", e)
                    return

                ports = LauncherPorts(
                    msgCenter_port=getattr(self.ws_server, 'port', None) if self.ws_server else None,
                    pdfFile_port=getattr(self.http_server, 'port', None) if self.http_server else None,
                    vite_port=None
                )
                paths = LauncherPaths(
                    data_dir=str(self.data_dir),
                    db_path=str(self.db_path),
                    static_dir=str(self.static_dir) if getattr(self, 'static_dir', None) else None,
                    pdfs_dir=str(self.pdfs_dir) if getattr(self, 'pdfs_dir', None) else None,
                    logs_dir=str(self.logs_dir_override) if getattr(self, 'logs_dir_override', None) else None,
                )
                options = LauncherOptions(
                    runtime_mode=self.runtime_mode or 'single',
                    ankiaddon_root_path=self.ankiaddon_root_path,
                    keep_backend=True,
                    frontend_prod=True
                )
                cfg = LauncherConfig(ports=ports, paths=paths, options=options)
                try:
                    rc = ensure_pdf_home_hosted(
                        cfg,
                        parent_app=self.parent_app or getattr(self, 'app', None),
                        on_log=lambda s: self.logger.info("[PdfHomeHost] %s", s)
                    )
                    self.logger.info("[MsgDispatch] PdfHome ensure-hosted rc=%s", str(rc))
                except Exception as e:
                    self.logger.error("[MsgDispatch] 启动 pdf-home 失败: %s", e, exc_info=True)
                return
        except Exception as e:
            self.logger.warning("[MsgDispatch] 处理消息失败: %s", str(e))

    def _allocate_port(self, service_name: str, preferred_port: Optional[int]) -> Optional[int]:
        try:
            return self.port_manager.find_available_port(service_name, preferred_port)
        except Exception:
            return None

    def _save_ports(self, ws_port: int, http_port: int):
        try:
            self.port_manager.save_runtime_ports({"msgCenter_port": ws_port, "pdfFile_port": http_port})
        except Exception:
            pass

    def _should_show_test_ui(self) -> bool:
        return self.mode == "subprocess" and self.show_ui
