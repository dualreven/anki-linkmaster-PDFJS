#!/usr/bin/env python3
"""
PyQt Bridge for QWebChannel

通过 QWebChannel 暴露 PyQt 功能给前端 JavaScript。
负责原生 UI 交互（文件选择对话框、确认对话框等）。

Usage:
    bridge = PyQtBridge(parent_window)
    channel.registerObject('pyqtBridge', bridge)
"""

import logging
from pathlib import Path
from PyQt6.QtCore import QObject, pyqtSlot
from PyQt6.QtWidgets import QFileDialog, QMessageBox
from src.frontend.common.pyqt.window_controls_mixin import WindowControlsMixin

logger = logging.getLogger("pdf-home.pyqt-bridge")

def _resolve_logs_dir(base: Path) -> Path:
    """解析日志目录（与后端/launcher一致）：支持 logs/gui-launcher-config.json 覆盖。"""
    try:
        cfg = base / 'logs' / 'gui-launcher-config.json'
        if cfg.exists():
            import json as _json
            data = _json.loads(cfg.read_text(encoding='utf-8') or '{}')
            logs_dir_decl = ((data.get('paths') or {}).get('logs_dir') or '').strip()
            if logs_dir_decl and logs_dir_decl.lower() not in ('none', 'null', 'undefined'):
                p = Path(logs_dir_decl).expanduser()
                p.mkdir(parents=True, exist_ok=True)
                return p
    except Exception:
        pass
    d = base / 'logs'
    d.mkdir(parents=True, exist_ok=True)
    return d


class PyQtBridge(QObject, WindowControlsMixin):
    """
    PyQt 桥接对象

    通过 QWebChannel 暴露给前端，提供原生 UI 功能和窗口控制方法。

    Attributes:
        parent: 父窗口对象，用于显示对话框和窗口控制
    """

    def __init__(self, parent=None, is_prod: bool | None = None, logs_dir: str | None = None):
        """
        初始化 PyQtBridge

        Args:
            parent: 父窗口对象（MainWindow）
        """
        super().__init__(parent)
        self.parent = parent  # WindowControlsMixin needs this to control the window
        self._init_drag_mode()  # Initialize drag mode (from WindowControlsMixin)
        # 运行模式标记（由调用方传入，避免依赖环境变量）
        self._is_prod: bool | None = is_prod
        logger.info("[PyQtBridge] PyQtBridge 初始化")

        # 显式日志目录（必需）
        if not logs_dir:
            raise RuntimeError("PyQtBridge 缺少 logs_dir 参数（请从 gui/runner/hosted 传入）")
        try:
            self._logs_dir = Path(logs_dir).resolve()
            self._logs_dir.mkdir(parents=True, exist_ok=True)
        except Exception as _e:
            raise RuntimeError(f"PyQtBridge 无法创建日志目录: {logs_dir} err={_e}")

        # 记录已打开的 pdf-viewer 窗口（由 pdf-home MainWindow 统一管理）
        # 若 parent(MainWindow) 未初始化该字典，则在此做兜底
        try:
            if getattr(self.parent, "viewer_windows", None) is None:
                setattr(self.parent, "viewer_windows", {})
        except Exception:
            pass

    @pyqtSlot(result=str)
    def testConnection(self):
        """
        测试 QWebChannel 连接

        用于验证 PyQt 和 JavaScript 之间的通信是否正常。

        Returns:
            str: 测试消息 "PyQt Bridge Connected"
        """
        logger.info("[PyQtBridge] testConnection 被调用")
        logger.info("[PyQtBridge] QWebChannel 连接正常")
        return "PyQt Bridge Connected"

    @pyqtSlot(bool, str, result=list)
    def selectFiles(self, multiple=True, fileType='pdf'):
        """
        打开文件选择对话框

        通过 Qt 原生对话框让用户选择文件。

        Args:
            multiple (bool): 是否允许多选。默认 True
            fileType (str): 文件类型过滤。'pdf' 或 'all'。默认 'pdf'

        Returns:
            list: 选中的文件路径列表。用户取消则返回空列表 []

        Example:
            files = bridge.selectFiles(True, 'pdf')
            # 返回: ['C:/path/file1.pdf', 'C:/path/file2.pdf']
        """
        logger.info(f"[PyQtBridge] [阶段2] selectFiles 被调用: multiple={multiple}, fileType={fileType}")

        try:
            # 设置文件过滤器
            if fileType == 'pdf':
                file_filter = "PDF Files (*.pdf)"
            elif fileType == 'all':
                file_filter = "All Files (*.*)"
            else:
                file_filter = "PDF Files (*.pdf)"

            logger.info(f"[PyQtBridge] [阶段2] 文件过滤器: {file_filter}")

            # 打开文件选择对话框
            if multiple:
                logger.info("[PyQtBridge] [阶段2] 打开多选文件对话框...")
                files, _ = QFileDialog.getOpenFileNames(
                    parent=self.parent,
                    caption="选择PDF文件",
                    directory="",  # 使用系统默认目录
                    filter=file_filter
                )
            else:
                logger.info("[PyQtBridge] [阶段2] 打开单选文件对话框...")
                file_path, _ = QFileDialog.getOpenFileName(
                    parent=self.parent,
                    caption="选择PDF文件",
                    directory="",
                    filter=file_filter
                )
                files = [file_path] if file_path else []

            # 记录结果
            if not files:
                logger.info("[PyQtBridge] [阶段2] 用户取消了文件选择")
            else:
                logger.info(f"[PyQtBridge] [阶段2] 用户选择了 {len(files)} 个文件:")
                for i, file_path in enumerate(files, 1):
                    logger.info(f"[PyQtBridge] [阶段2]   文件{i}: {file_path}")

            return files

        except Exception as e:
            logger.error(f"[PyQtBridge] [阶段2] selectFiles 发生错误: {e}", exc_info=True)
            return []

    @pyqtSlot(str, str, result=bool)
    def showConfirmDialog(self, title, message):
        """
        显示确认对话框

        通过 Qt 原生对话框让用户确认操作。

        Args:
            title (str): 对话框标题
            message (str): 提示消息

        Returns:
            bool: 用户是否点击确认 (True=是, False=否)

        Example:
            confirmed = bridge.showConfirmDialog('确认删除', '确定要删除此文件吗？')
            # 返回: True 或 False
        """
        logger.info(f"[PyQtBridge] [删除-阶段1] showConfirmDialog 被调用: title={title}")
        logger.info(f"[PyQtBridge] [删除-阶段1] 消息内容: {message}")

        try:
            # 显示确认对话框
            reply = QMessageBox.question(
                self.parent,
                title,
                message,
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No  # 默认选择"否"，防止误操作
            )

            confirmed = (reply == QMessageBox.StandardButton.Yes)
            logger.info(f"[PyQtBridge] [删除-阶段1] 用户选择: {'确认' if confirmed else '取消'}")

            return confirmed

        except Exception as e:
            logger.error(f"[PyQtBridge] [删除-阶段1] showConfirmDialog 发生错误: {e}", exc_info=True)
            return False  # 发生错误时默认返回取消

    # ---------- 新增：批量打开 pdf-viewer 窗口 ----------

    def _read_runtime_ports(self) -> tuple[int, int, int, dict]:
        """读取 logs/runtime-ports.json 以获取 vite/ws/pdfFile 端口。

        Returns:
            (vite_port, msgCenter_port, pdfFile_port, extras)
        """
        try:
            from pathlib import Path
            import json
            # 项目根目录: pyqt-bridge.py -> pdf-home -> frontend -> src -> 项目根
            project_root = Path(__file__).parent.parent.parent.parent
            cfg_path = project_root / 'logs' / 'runtime-ports.json'
            if cfg_path.exists():
                text = cfg_path.read_text(encoding='utf-8')
                data = json.loads(text or '{}')
                vite_port = int(data.get('vite_port') or data.get('npm_port') or 3000)
                msg_port = int(data.get('msgCenter_port') or data.get('ws_port') or 8765)
                pdf_port = int(data.get('pdfFile_port') or data.get('pdf_port') or 8080)
                extras = {k: v for k, v in data.items() if k not in ("vite_port", "npm_port", "msgCenter_port", "ws_port", "pdfFile_port", "pdf_port")}
                return vite_port, msg_port, pdf_port, extras
        except Exception as exc:
            logger.warning(f"[PyQtBridge] 读取运行端口失败: {exc}")
        return 3000, 8765, 8080, {}

    def _read_debug_info(self) -> dict:
        """读取 logs/debug-info.json 以获取调试标志（如 outline 等）。

        Returns:
            dict: 调试信息字典，如 {'outline': 1, ...}
        """
        try:
            from pathlib import Path
            import json
            # 项目根目录: pyqt-bridge.py -> pdf-home -> frontend -> src -> 项目根
            project_root = Path(__file__).parent.parent.parent.parent
            debug_info_path = project_root / 'logs' / 'debug-info.json'
            if debug_info_path.exists():
                text = debug_info_path.read_text(encoding='utf-8')
                data = json.loads(text or '{}')
                # 过滤掉元数据
                return {k: v for k, v in data.items() if not k.startswith('_')}
        except Exception as exc:
            logger.warning(f"[PyQtBridge] 读取调试信息失败: {exc}")
        return {}

    def _next_js_debug_port(self, base: int = 9223) -> int:
        """分配下一个可用的 JS 远程调试端口（pdf-viewer）。

        简单策略：在 base 开始，按已存在窗口数量顺延。
        """
        try:
            existing = getattr(self.parent, "viewer_windows", {}) or {}
            return base + max(0, len(existing))
        except Exception:
            return base

    def _build_pdf_viewer_url(self, vite_port: int, msgCenter_port: int, pdfFile_port: int,
                               pdf_id: str, page_at: int | None = None, position: float | None = None,
                               file_path: str | None = None) -> str:
        """构建 pdf-viewer 前端 URL（供测试与调用）。

        规则：
        - 若初始化时传入 is_prod=True，则强制走文件服务器端口；
        - 若 is_prod=False，则走 Vite；
        - 若 is_prod=None，则按静态入口存在性回退（原有行为）。
        """
        url = build_pdf_viewer_url(
            vite_port, msgCenter_port, pdfFile_port, pdf_id, page_at, position, prod=self._is_prod
        )
        if file_path:
            import urllib.parse
            url += f"&file={urllib.parse.quote(str(file_path))}"
        return url

    @pyqtSlot(list, result=bool)
    def openPdfViewers(self, pdf_ids: list) -> bool:
        """批量打开 pdf-viewer 窗口（不通过 launcher，直接从 Python 启动）。

        Args:
            pdf_ids: 选中的 PDF 标识列表（字符串数组）

        Returns:
            True 表示已发起打开动作（不保证全部成功）
        """
        try:
            if not pdf_ids:
                logger.info("[PyQtBridge] openPdfViewers 被调用，但没有选中任何条目")
                return False

            # 端口解析
            vite_port, msg_port, pdf_port, _extras = self._read_runtime_ports()
            # 读取调试信息（outline 等标志），优先级高于 runtime-ports
            debug_info = self._read_debug_info()
            _extras.update(debug_info)  # debug-info 覆盖 runtime-ports 中的同名字段

            # 统一接口：通过 PdfViewerApp + FE LaunchConfig 启动（与 Anki/GUI 一致）
            from src.qt.compat import QApplication
            import importlib.util as _ilu
            from pathlib import Path as _Path
            _viewer_launcher_path = _Path(__file__).parent.parent / 'pdf-viewer' / 'launcher.py'
            _spec = _ilu.spec_from_file_location('pdf_viewer_launcher', _viewer_launcher_path)
            assert _spec and _spec.loader, "无法定位 pdf-viewer 启动器模块"
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)  # type: ignore[attr-defined]
            PdfViewerApp = getattr(_mod, 'PdfViewerApp')
            FE_LaunchConfig = getattr(_mod, 'LaunchConfig')

            app = QApplication.instance()
            if app is None:
                logger.error("[PyQtBridge] QApplication 实例不存在，无法创建窗口")
                return False

            # 初始化父窗口的字典
            parent_win = self.parent
            if getattr(parent_win, "viewer_windows", None) is None:
                setattr(parent_win, "viewer_windows", {})

            for raw_id in pdf_ids:
                pdf_id = str(raw_id)
                # 若已存在则激活已有窗口；若已不可见/失效则移除后重建
                existing = parent_win.viewer_windows.get(pdf_id) if hasattr(parent_win, 'viewer_windows') else None
                if existing:
                    try:
                        if hasattr(existing, 'isVisible') and not existing.isVisible():
                            try:
                                parent_win.viewer_windows.pop(pdf_id, None)
                                logger.info(f"[PyQtBridge] 发现失效窗口条目，移除并重建: {pdf_id}")
                            except Exception:
                                pass
                        else:
                            existing.raise_()  # type: ignore[attr-defined]
                            existing.activateWindow()
                            logger.info(f"[PyQtBridge] 已存在窗口，激活: {pdf_id}")
                            continue
                    except Exception:
                        try:
                            parent_win.viewer_windows.pop(pdf_id, None)
                        except Exception:
                            pass

                debug_port = self._next_js_debug_port()
                js_log_path = self._compute_js_log_path(pdf_id)
                # 清空对应 pdf-viewer 的 JS 日志文件，确保每次从 pdf-home 打开都是干净的日志
                try:
                    from io import TextIOWrapper  # 仅用于类型提示
                    with open(js_log_path, 'w', encoding='utf-8', newline='\n') as _f:  # type: TextIOWrapper
                        _f.write('')
                    logger.info(f"[PyQtBridge] 已清空 JS 日志文件: {js_log_path}")
                except Exception as _e:
                    logger.warning(f"[PyQtBridge] 清空 JS 日志失败: {js_log_path} err={_e}")
                # 解析文件路径（若无法解析则仍然仅传递 pdf-id）
                file_path = self._resolve_pdf_file_path(pdf_id)

                # 通过 PdfViewerApp 启动（hosted），保持一致
                # 从 runtime-ports.json 的 extras 透传 Debug 开关到前端 URL（由前端 WS 读取 debug-info 决定是否启用 Outline）
                extra_params = {}
                try:
                    if (_extras.get('outline') in (True, 1, '1', 'true', 'yes', 'on')) or (_extras.get('feature_outline') in (True, 1, '1', 'true', 'yes', 'on')):
                        extra_params['debug'] = '1'
                except Exception:
                    pass

                fe_cfg = FE_LaunchConfig(
                    is_prod=True,
                    keep_backend=True,
                    msgCenter_port=msg_port,
                    pdfFile_port=pdf_port,
                    vite_port=vite_port,
                    pdf_id=pdf_id,
                    file_path=file_path,
                    source='pdf-home',
                    extra_params=extra_params
                )
                viewer_app = PdfViewerApp(fe_cfg, parent_app=app)
                viewer_app.run()
                try:
                    w = getattr(viewer_app, 'window', None)
                    if w is not None:
                        parent_win.viewer_windows[pdf_id] = w
                        try:
                            w.destroyed.connect(lambda _=None, _pid=pdf_id: parent_win.viewer_windows.pop(_pid, None))  # type: ignore[attr-defined]
                        except Exception:
                            pass
                except Exception:
                    pass

                # 记录到父窗口字典，便于统一关闭；并在销毁时清理映射，避免下次误判
                try:
                    parent_win.viewer_windows[pdf_id] = viewer
                except Exception:
                    pass
                try:
                    viewer.destroyed.connect(lambda _=None, _pid=pdf_id: parent_win.viewer_windows.pop(_pid, None))  # type: ignore[attr-defined]
                except Exception:
                    pass

            return True
        except Exception as e:
            logger.error(f"[PyQtBridge] 打开 pdf-viewer 失败: {e}", exc_info=True)
            return False

    @pyqtSlot('QVariant', result='QVariant')
    def openPdfViewersEx(self, payload):
        """增强版本：支持传入 { pdfIds, items }，items 可包含 filename 与 file_path。

        payload 结构示例：
          {
            'pdfIds': ['id1', 'id2'],
            'items': [
               { 'id': 'id1', 'filename': 'a.pdf', 'file_path': 'C:/docs/a.pdf' },
               { 'id': 'id2', 'filename': 'b.pdf' }
            ]
          }

        Returns:
            dict: {'success': True} 或 {'success': False, 'error': '错误消息', 'traceback': '详细堆栈'}
        """
        try:
            logger.info("[PyQtBridge] [步骤PyQt-1] openPdfViewersEx 被调用")
            logger.info(f"[PyQtBridge] [步骤PyQt-1] payload: {payload}")

            vite_port, msg_port, pdf_port, _extras = self._read_runtime_ports()
            # 读取调试信息（outline 等标志），优先级高于 runtime-ports
            debug_info = self._read_debug_info()
            _extras.update(debug_info)  # debug-info 覆盖 runtime-ports 中的同名字段
            logger.info(f"[PyQtBridge] [步骤PyQt-2] 读取端口配置: vite={vite_port}, msg={msg_port}, pdf={pdf_port}, debug_flags={debug_info}")

            from src.qt.compat import QApplication
            import importlib.util as _ilu
            from pathlib import Path as _Path
            _viewer_main_path = _Path(__file__).parent.parent / 'pdf-viewer' / 'pyqt' / 'main_window.py'
            logger.info(f"[PyQtBridge] [步骤PyQt-3] 查找 pdf-viewer MainWindow: {_viewer_main_path}")

            _spec = _ilu.spec_from_file_location('pdf_viewer_main_window', _viewer_main_path)
            if not _spec or not _spec.loader:
                error_msg = f"无法定位 pdf-viewer 主窗口模块: {_viewer_main_path}"
                logger.error(f"[PyQtBridge] [步骤PyQt-3] {error_msg}")
                return {'success': False, 'error': error_msg, 'step': 'load_module'}

            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)  # type: ignore[attr-defined]
            ViewerMainWindow = getattr(_mod, 'MainWindow')
            logger.info("[PyQtBridge] [步骤PyQt-4] 成功加载 pdf-viewer MainWindow 类")

            app = QApplication.instance()
            if app is None:
                error_msg = "QApplication 实例不存在，无法创建窗口"
                logger.error(f"[PyQtBridge] [步骤PyQt-5] {error_msg}")
                return {'success': False, 'error': error_msg, 'step': 'qapp_check'}

            logger.info("[PyQtBridge] [步骤PyQt-5] 检查父窗口状态")
            parent_win = self.parent
            if getattr(parent_win, "viewer_windows", None) is None:
                setattr(parent_win, "viewer_windows", {})

            logger.info("[PyQtBridge] [步骤PyQt-6] 解析 payload")
            pdf_ids = []
            try:
                if isinstance(payload, dict):
                    if isinstance(payload.get('pdfIds'), list):
                        pdf_ids.extend([str(x) for x in payload.get('pdfIds') if x is not None])
            except Exception as parse_err:
                logger.warning(f"[PyQtBridge] [步骤PyQt-6] 解析 pdfIds 失败: {parse_err}")

            items_map = {}
            try:
                if isinstance(payload, dict) and isinstance(payload.get('items'), list):
                    for it in payload.get('items'):
                        try:
                            _id = str(it.get('id') or '') if isinstance(it, dict) else ''
                            if not _id:
                                continue
                            items_map[_id] = {
                                'filename': it.get('filename') or None,
                                'file_path': it.get('file_path') or None,
                                'title': it.get('title') or None
                            }
                            if _id not in pdf_ids:
                                pdf_ids.append(_id)
                        except Exception as item_err:
                            logger.warning(f"[PyQtBridge] [步骤PyQt-6] 解析 item 失败: {item_err}")
            except Exception as items_err:
                logger.warning(f"[PyQtBridge] [步骤PyQt-6] 解析 items 失败: {items_err}")

            logger.info(f"[PyQtBridge] [步骤PyQt-7] 准备打开 {len(pdf_ids)} 个PDF窗口: {pdf_ids}")

            opened_count = 0
            for idx, raw_id in enumerate(pdf_ids, 1):
                pdf_id = str(raw_id)
                logger.info(f"[PyQtBridge] [步骤PyQt-8.{idx}] 处理PDF: {pdf_id}")

                existing = parent_win.viewer_windows.get(pdf_id) if hasattr(parent_win, 'viewer_windows') else None
                if existing:
                    try:
                        if hasattr(existing, 'isVisible') and not existing.isVisible():
                            try:
                                parent_win.viewer_windows.pop(pdf_id, None)
                                logger.info(f"[PyQtBridge] [步骤PyQt-8.{idx}] 发现失效窗口，移除并重建: {pdf_id}")
                            except Exception:
                                pass
                        else:
                            existing.raise_()  # type: ignore[attr-defined]
                            existing.activateWindow()
                            logger.info(f"[PyQtBridge] [步骤PyQt-8.{idx}] 窗口已存在，激活: {pdf_id}")
                            opened_count += 1
                            continue
                    except Exception:
                        try:
                            parent_win.viewer_windows.pop(pdf_id, None)
                        except Exception:
                            pass

                logger.info(f"[PyQtBridge] [步骤PyQt-9.{idx}] 分配调试端口和日志路径")
                debug_port = self._next_js_debug_port()
                js_log_path = self._compute_js_log_path(pdf_id)
                logger.info(f"[PyQtBridge] [步骤PyQt-9.{idx}] debug_port={debug_port}, js_log={js_log_path}")

                # 清空对应 pdf-viewer 的 JS 日志文件
                try:
                    from io import TextIOWrapper  # 仅用于类型提示
                    with open(js_log_path, 'w', encoding='utf-8', newline='\n') as _f:  # type: TextIOWrapper
                        _f.write('')
                    logger.info(f"[PyQtBridge] [步骤PyQt-10.{idx}] 已清空 JS 日志文件")
                except Exception as _e:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-10.{idx}] 清空 JS 日志失败: {_e}")

                logger.info(f"[PyQtBridge] [步骤PyQt-11.{idx}] 解析元信息")
                filename = None
                provided_path = None
                try:
                    meta = items_map.get(pdf_id) or {}
                    filename = meta.get('filename')
                    provided_path = meta.get('file_path')
                    logger.info(f"[PyQtBridge] [步骤PyQt-11.{idx}] 元信息: filename={filename}, path={provided_path}")
                except Exception as meta_err:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-11.{idx}] 解析元信息失败: {meta_err}")

                # 解析文件路径：优先 items.file_path，其次 filename 在常见目录中查找；最后回退原有解析逻辑（不直连数据库，遵循隔离原则）
                logger.info(f"[PyQtBridge] [步骤PyQt-12.{idx}] 解析文件路径")
                file_path = None
                try:
                    from pathlib import Path as _P
                    if provided_path and _P(provided_path).exists():
                        file_path = provided_path
                        logger.info(f"[PyQtBridge] [步骤PyQt-12.{idx}] 使用提供的路径: {file_path}")
                    elif filename:
                        # 在常见目录中按文件名查找
                        candidates_root = [
                            _P(__file__).parent.parent.parent.parent / 'data' / 'pdfs',
                            _P(__file__).parent.parent.parent.parent / 'public',
                            _P(__file__).parent.parent.parent.parent / 'src' / 'data' / 'pdfs',
                        ]
                        for root in candidates_root:
                            p = root / filename
                            if p.exists():
                                file_path = str(p)
                                logger.info(f"[PyQtBridge] [步骤PyQt-12.{idx}] 在 {root} 找到文件: {filename}")
                                break
                    if not file_path:
                        file_path = self._resolve_pdf_file_path(pdf_id)
                        logger.info(f"[PyQtBridge] [步骤PyQt-12.{idx}] 通过解析器获取路径: {file_path}")
                except Exception as path_err:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-12.{idx}] 路径解析失败: {path_err}")
                    file_path = self._resolve_pdf_file_path(pdf_id)

                logger.info(f"[PyQtBridge] [步骤PyQt-13.{idx}] 创建 pdf-viewer 窗口实例")
                try:
                    viewer = ViewerMainWindow(
                        app,
                        remote_debug_port=debug_port,
                        js_log_file=js_log_path,
                        js_logger=None,
                        pdf_id=pdf_id,
                        stop_backend_on_close=False
                    )
                    logger.info(f"[PyQtBridge] [步骤PyQt-13.{idx}] 窗口实例创建成功")
                except Exception as create_err:
                    error_msg = f"创建窗口实例失败: {create_err}"
                    logger.error(f"[PyQtBridge] [步骤PyQt-13.{idx}] {error_msg}", exc_info=True)
                    return {'success': False, 'error': error_msg, 'step': 'create_window', 'pdf_id': pdf_id}

                # 设置窗口标题：优先使用 title，其次 filename 去掉扩展名，最后用 pdf_id
                logger.info(f"[PyQtBridge] [步骤PyQt-14.{idx}] 设置窗口标题")
                try:
                    title_meta = None
                    try:
                        title_meta = (items_map.get(pdf_id) or {}).get('title')
                    except Exception:
                        pass
                    display_title = None
                    if title_meta:
                        display_title = str(title_meta)
                    elif filename:
                        try:
                            import os as _os
                            display_title = _os.path.splitext(str(filename))[0]
                        except Exception:
                            display_title = str(filename)
                    else:
                        display_title = str(pdf_id)
                    # 优先使用"人类可读标题"API，保证标题锁定不被页面覆盖
                    try:
                        if hasattr(viewer, 'setHumanWindowTitle'):
                            viewer.setHumanWindowTitle(f"Anki LinkMaster PDF Viewer - {display_title}")
                        else:
                            viewer.setWindowTitle(f"Anki LinkMaster PDF Viewer - {display_title}")
                        logger.info(f"[PyQtBridge] [步骤PyQt-14.{idx}] 窗口标题: {display_title}")
                    except Exception as title_err:
                        logger.warning(f"[PyQtBridge] [步骤PyQt-14.{idx}] 设置标题失败: {title_err}")
                        try:
                            viewer.setWindowTitle(f"Anki LinkMaster PDF Viewer - {display_title}")
                        except Exception:
                            pass
                except Exception as title_outer_err:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-14.{idx}] 标题处理失败: {title_outer_err}")

                logger.info(f"[PyQtBridge] [步骤PyQt-15.{idx}] 构建前端 URL")
                url = self._build_pdf_viewer_url(vite_port, msg_port, pdf_port, pdf_id, file_path=file_path)
                # 追加 Debug 开关（若存在）：前端将据此通过 WS 拉取 debug-info 决定是否启用 Outline
                try:
                    if (_extras.get('outline') in (True, 1, '1', 'true', 'yes', 'on')) or (_extras.get('feature_outline') in (True, 1, '1', 'true', 'yes', 'on')):
                        url = f"{url}&debug=1"
                except Exception:
                    pass
                try:
                    import urllib.parse as _up
                    if title_meta:
                        url = f"{url}&title={_up.quote(str(title_meta))}"
                except Exception:
                    pass
                logger.info(f"[PyQtBridge] [步骤PyQt-15.{idx}] URL: {url}")

                logger.info(f"[PyQtBridge] [步骤PyQt-16.{idx}] 加载前端并显示窗口")
                try:
                    viewer.load_frontend(url)
                    viewer.show()
                    try:
                        viewer.raise_()  # type: ignore[attr-defined]
                        viewer.activateWindow()
                    except Exception:
                        pass
                    logger.info(f"[PyQtBridge] [步骤PyQt-16.{idx}] 窗口显示成功")
                except Exception as show_err:
                    error_msg = f"加载和显示窗口失败: {show_err}"
                    logger.error(f"[PyQtBridge] [步骤PyQt-16.{idx}] {error_msg}", exc_info=True)
                    return {'success': False, 'error': error_msg, 'step': 'show_window', 'pdf_id': pdf_id}

                logger.info(f"[PyQtBridge] [步骤PyQt-17.{idx}] 注册窗口到父窗口字典")
                try:
                    parent_win.viewer_windows[pdf_id] = viewer
                except Exception as reg_err:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-17.{idx}] 注册窗口失败: {reg_err}")
                try:
                    viewer.destroyed.connect(lambda _=None, _pid=pdf_id: parent_win.viewer_windows.pop(_pid, None))  # type: ignore[attr-defined]
                except Exception as conn_err:
                    logger.warning(f"[PyQtBridge] [步骤PyQt-17.{idx}] 连接销毁信号失败: {conn_err}")

                opened_count += 1
                logger.info(f"[PyQtBridge] [步骤PyQt-18.{idx}] PDF窗口打开完成: {pdf_id}")

            logger.info(f"[PyQtBridge] [步骤PyQt-19] 所有窗口打开完成，共 {opened_count}/{len(pdf_ids)} 个")
            return {'success': True, 'opened_count': opened_count, 'total_count': len(pdf_ids)}

        except Exception as e:
            import traceback
            error_msg = str(e)
            error_traceback = traceback.format_exc()
            logger.error(f"[PyQtBridge] [ERROR] openPdfViewersEx 失败: {error_msg}", exc_info=True)
            logger.error(f"[PyQtBridge] [ERROR] 堆栈跟踪:\n{error_traceback}")
            return {
                'success': False,
                'error': error_msg,
                'traceback': error_traceback,
                'step': 'unknown'
            }

    def _compute_js_log_path(self, pdf_id: str) -> str:
        """计算 pdf-viewer JS 日志文件路径（UTF-8）。"""
        try:
            path = self._logs_dir / f"pdf-viewer-{pdf_id}-js.log"
            # 每次启动 viewer 前清空旧日志（UTF-8，无 BOM）。
            # 这样从 pdf-home 启动时行为与独立 launcher 截断一致。
            try:
                with open(path, 'w', encoding='utf-8', newline='\n') as f:
                    f.write('')
            except Exception:
                # 若清空失败，仍返回路径，避免影响启动流程
                pass
            return str(path)
        except Exception:
            # 兜底返回相对路径名
            return f"logs/pdf-viewer-{pdf_id}-js.log"

    def _resolve_pdf_file_path(self, pdf_id: str) -> str | None:
        """解析 pdf-id 对应的文件路径。

        优先复用 pdf-viewer/launcher.py 中的 `resolve_pdf_id_to_file_path` 逻辑。
        """
        try:
            import importlib.util as _ilu
            from pathlib import Path as _Path
            _launcher_path = _Path(__file__).parent.parent / 'pdf-viewer' / 'launcher.py'
            if not _launcher_path.exists():
                return None
            _spec = _ilu.spec_from_file_location('pdf_viewer_launcher', _launcher_path)
            if not _spec or not _spec.loader:
                return None
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)  # type: ignore[attr-defined]
            resolver = getattr(_mod, 'resolve_pdf_id_to_file_path', None)
            if not resolver:
                return None
            path = resolver(str(pdf_id))
            return path
        except Exception:
            return None

def build_pdf_viewer_url(vite_port: int, msgCenter_port: int, pdfFile_port: int,
                         pdf_id: str, page_at: int | None = None, position: float | None = None,
                         prod: bool | None = None) -> str:
    """构建 pdf-viewer 前端 URL（复用“生产标记”）。

    决策顺序：
      1) 若 prod 为 True → 使用文件服务器；
      2) 若 prod 为 False → 使用 Vite；
      3) 若 prod 为 None → 按静态入口存在性回退（保持历史行为）。
    """
    import urllib.parse
    from pathlib import Path as _Path

    if prod is True:
        base = f"http://127.0.0.1:{int(pdfFile_port)}/pdf-viewer/?msgCenter={int(msgCenter_port)}&pdfs={int(pdfFile_port)}"
    elif prod is False:
        base = f"http://127.0.0.1:{int(vite_port)}/pdf-viewer/?msgCenter={int(msgCenter_port)}&pdfs={int(pdfFile_port)}"
    else:
        try:
            project_root = _Path(__file__).parent.parent.parent.parent
            static_index = project_root / 'static' / 'pdf-viewer' / 'index.html'
            use_static = static_index.exists()
        except Exception:
            use_static = False
        base = (
            f"http://127.0.0.1:{int(pdfFile_port)}/pdf-viewer/?msgCenter={int(msgCenter_port)}&pdfs={int(pdfFile_port)}"
            if use_static else
            f"http://127.0.0.1:{int(vite_port)}/pdf-viewer/?msgCenter={int(msgCenter_port)}&pdfs={int(pdfFile_port)}"
        )

    if pdf_id:
        base += f"&pdf-id={urllib.parse.quote(str(pdf_id))}"
    if page_at is not None:
        base += f"&page-at={int(page_at)}"
    if position is not None:
        pos = max(0.0, min(100.0, float(position)))
        base += f"&position={pos}"
    return base
