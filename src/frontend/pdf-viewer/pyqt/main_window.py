"""
MainWindow for PDF-Viewer - 集成JSConsoleLogger

这个版本的MainWindow会将javaScriptConsoleMessage自动传递给
JSConsoleLogger，实现完整的JS控制台日志记录功能，
并支持pdf_id动态命名。
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional
import json

from src.qt.compat import (
    QMainWindow, QVBoxLayout, QWidget, QStatusBar,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QUrl, pyqtSignal, QAction, QSizePolicy
)

from src.frontend.pyqtui.main_window import write_js_console_message
import logging
logger = logging.getLogger('pdf-viewer.main_window')


class MainWindow(QMainWindow):
    """主窗口 for PDF-Viewer - 集成JSConsoleLogger"""
    send_debug_message_requested = pyqtSignal()
    web_loaded = pyqtSignal()
    window_closing = pyqtSignal()  # 窗口关闭信号，用于触发资源清理

    def __init__(self, app, remote_debug_port: int | None = None, js_log_file: str | None = None, js_logger=None, pdf_id: str = "empty", stop_backend_on_close: bool = True, enable_close_event_debug: bool = False):
        """初始化主窗口

        Args:
            app: QApplication实例
            remote_debug_port: 远程调试端口
            js_log_file: JS日志文件路径
            js_logger: JSConsoleLogger实例（可选）
            pdf_id: PDF标识符，用于日志文件命名
            stop_backend_on_close: 窗口关闭时是否停止后端服务（默认True）
            enable_close_event_debug: 是否启用closeEvent详细日志（默认False，影响性能）
        """
        super().__init__()
        self.enable_close_event_debug = enable_close_event_debug  # 日志开关
        # 确保窗口关闭时对象被销毁（触发 destroyed 信号），以便宿主映射清理
        try:
            from src.qt.compat import QtCore  # 统一兼容层
            try:
                # PyQt6 写法
                self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)
            except Exception:
                # 旧版/兼容写法
                self.setAttribute(QtCore.Qt.WA_DeleteOnClose, True)  # type: ignore[attr-defined]
        except Exception:
            pass
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9223  # pdf-viewer默认端口
        self._js_log_file = js_log_file
        self.js_logger = js_logger  # 简化版Logger实例
        self.pdf_id = pdf_id
        self.stop_backend_on_close = stop_backend_on_close  # 后端服务停止开关

        # 窗口属性（引入"标题锁定"机制）
        self._locked_title: str | None = f"Anki LinkMaster PDF Viewer - {pdf_id}"
        # 初始标题使用 pdf_id；宿主（pdf-home）可调用 setHumanWindowTitle() 覆盖并锁定为人类可读标题。
        super().setWindowTitle(self._locked_title)
        self.setGeometry(100, 100, 1200, 800)

        # 使用完全无边框窗口（用HTML自定义所有窗口控制按钮）
        try:
            from PyQt6.QtCore import Qt
            self.setWindowFlags(
                Qt.WindowType.Window |  # 保持正常窗口
                Qt.WindowType.FramelessWindowHint  # 完全无边框（去除标题栏和所有原生按钮）
            )
        except Exception:
            pass  # 如果设置失败，使用默认窗口

        # QtWebEngine Inspector设置
        self.inspector_window = None

        # 初始化UI
        self._init_ui()
        # self._init_menu()  # 已移除调试菜单栏
        self._init_status_bar()

    def set_js_logger(self, js_logger):
        """设置JS日志记录器实例"""
        self.js_logger = js_logger
        # 同时更新WebPage中的引用
        if hasattr(self, 'web_page') and self.web_page and hasattr(self.web_page, 'js_logger'):
            self.web_page.js_logger = js_logger

    def _init_ui(self):
        """初始化用户界面"""
        # 启用远程调试端口 - 必须在创建WebEngineView之前设置
        import os
        try:
            existing = os.environ.get('QTWEBENGINE_REMOTE_DEBUGGING')
            if existing:
                # 若进程中已设置（例如 Hosted 场景由 pdf-home 先行设置），复用该端口
                try:
                    self._remote_debug_port = int(str(existing).strip())
                except Exception:
                    pass
                try:
                    logger.info("[RemoteDebug] 已检测到进程级端口，复用 QTWEBENGINE_REMOTE_DEBUGGING=%s", existing)
                except Exception:
                    pass
            else:
                os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = str(self._remote_debug_port)
                try:
                    logger.info("[RemoteDebug] 启用远程调试端口: %s", self._remote_debug_port)
                except Exception:
                    pass
        except Exception:
            # 安静失败，不影响后续
            pass

        # 创建WebEngine视图
        self.web_view = QWebEngineView() if QWebEngineView else None
        if self.web_view:
            self.web_view.loadFinished.connect(self._on_web_loaded)
            # 设置大小策略，确保自适应窗口大小变化
            self.web_view.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
            # 强制固定初始缩放因子为1.0，避免遗留缩放影响
            try:
                self.web_view.setZoomFactor(1.0)
            except Exception:
                pass
            # 安装事件过滤器：拦截 Ctrl+滚轮 的页面缩放（Qt WebEngine 默认行为）
            try:
                from src.qt.compat import QObject, QEvent, Qt as _Qt

                class _ZoomBlocker(QObject):
                    def eventFilter(self, obj, event):  # type: ignore[override]
                        try:
                            if event and event.type() == QEvent.Type.Wheel:
                                mods = event.modifiers() if hasattr(event, 'modifiers') else _Qt.KeyboardModifier.NoModifier
                                if mods & _Qt.KeyboardModifier.ControlModifier:
                                    # 阻止默认页面缩放
                                    return True
                        except Exception:
                            pass
                        # 交由默认处理
                        try:
                            return super().eventFilter(obj, event)
                        except Exception:
                            return False

                self._zoom_blocker = _ZoomBlocker(self)
                self.web_view.installEventFilter(self._zoom_blocker)
                try:
                    logger.info("Installed Ctrl+Wheel zoom blocker on QWebEngineView")
                except Exception:
                    pass
            except Exception as _e:
                try:
                    logger.warning("Failed to install zoom blocker: %s", _e)
                except Exception:
                    pass
            # 绑定标题变更信号，避免被页面/加载流程覆盖为文件名
            try:
                self.web_view.titleChanged.connect(self._on_page_title_changed)  # type: ignore[attr-defined]
            except Exception:
                pass
            try:
                if hasattr(self, 'web_page') and self.web_page:
                    self.web_page.titleChanged.connect(self._on_page_title_changed)  # type: ignore[attr-defined]
            except Exception:
                pass

        # 设置开发者工具属性
        if self.web_view and QWebEngineSettings:
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)

        # 设置安全选项
        if self.web_view and QWebEngineSettings:
            settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.XSSAuditingEnabled, True)

        # 创建增强版自定义页面
        if self.web_view and QWebEnginePage:
            try:
                from PyQt6.QtWebEngineCore import QWebEnginePage as _QWEP  # type: ignore
            except Exception:
                _QWEP = QWebEnginePage

            class EnhancedLoggingWebPage(_QWEP):
                def __init__(self, parent, log_file_path: str | None, js_logger=None, pdf_id: str = "empty"):
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

                def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore
                    """增强版控制台消息处理"""
                    # 1. 写入到文件（保持原有功能）
                    write_js_console_message(
                        self._log_file_path,
                        level=str(level),
                        message=str(message),
                        line_number=lineNumber,
                        source_id=str(sourceID),
                    )

                    # 2. 同时传递给Logger（新增功能）
                    if self.js_logger and hasattr(self.js_logger, 'log_message'):
                        try:
                            self.js_logger.log_message(
                                level=str(level),
                                message=str(message),
                                source=str(sourceID) if sourceID else "",
                                line=lineNumber
                            )
                        except Exception as e:
                            print(f"Warning: Failed to pass message to js_logger (pdf_id: {self.pdf_id}): {e}")

                    try:
                        return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)  # type: ignore
                    except Exception:
                        return None

            self.web_page = EnhancedLoggingWebPage(self.web_view, self._js_log_file, self.js_logger, self.pdf_id)
            self.web_view.setPage(self.web_page)
        else:
            self.web_page = None

        # 设置主布局
        layout = QVBoxLayout()
        # 设置布局边距为0，确保WebView占满整个窗口
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        if self.web_view:
            layout.addWidget(self.web_view)

        # 创建中心部件
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

        # 设置窗口最小尺寸
        self.setMinimumSize(800, 600)

    # def _init_menu(self):
    #     """初始化菜单栏（已移除 - 使用HTML自定义标题栏）"""
    #     menubar = self.menuBar()
    #     debug_menu = menubar.addMenu('调试（PDF-Viewer）')
    #     debug_action = QAction(f'发送消息 (pdf_id: {self.pdf_id})', self)
    #     debug_action.triggered.connect(self.send_debug_message_requested.emit)
    #     debug_menu.addAction(debug_action)
    #
    #     # 文件菜单
    #     file_menu = menubar.addMenu('文件')

    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage(f'准备就绪 (PDF: {self.pdf_id})')

    # -------------------- 标题锁定机制 --------------------
    def setWindowTitle(self, title: str):  # type: ignore[override]
        """重写 setWindowTitle，但不更新锁定标题。

        注意：页面或Qt内部可能调用 setWindowTitle 以同步 document.title。
        为避免“锁定值被无意覆盖”，此重写仅透传到父类，不改动 _locked_title。
        """
        super().setWindowTitle(title)

    def setHumanWindowTitle(self, title: str) -> None:
        """由宿主调用以设置“人类可读标题”，并写入锁定值。"""
        try:
            self._locked_title = str(title)
        except Exception:
            self._locked_title = title
        super().setWindowTitle(self._locked_title)

    def _on_page_title_changed(self, new_title: str):
        """当页面 title 变化时，保持窗口标题为“锁定标题”。"""
        try:
            locked = getattr(self, '_locked_title', None)
            if locked and isinstance(new_title, str) and new_title != locked:
                # 恢复为已锁定的标题，避免被文件名等覆盖
                super().setWindowTitle(locked)
        except Exception:
            # 出现异常时不影响页面其它逻辑
            pass

    def _on_web_loaded(self, success: bool):
        """网页加载完成处理"""
        if success:
            # 注入qwebchannel.js脚本以支持QWebChannel
            if self.web_view and self.web_view.page():
                script = """
                (function() {
                    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
                        var script = document.createElement('script');
                        script.src = 'qrc:///qtwebchannel/qwebchannel.js';
                        script.onload = function() {
                            console.log('[MainWindow] qwebchannel.js loaded successfully');
                        };
                        script.onerror = function() {
                            console.error('[MainWindow] Failed to load qwebchannel.js');
                        };
                        document.head.appendChild(script);
                    } else {
                        console.warn('[MainWindow] qt.webChannelTransport not available');
                    }
                })();
                """
                self.web_view.page().runJavaScript(script)

            # 注入运行时补丁：过滤 URLJumpDispatcher 的调试型 toast，避免误报为 error/warn
            try:
                patch_js = r"""
                (function(){
                  try {
                    // 通过 MutationObserver 监听第三方 toast 容器，移除/降级特定提示
                    function handle(node) {
                      try {
                        var text = (node.textContent || "").trim();
                        // 过滤 URLJumpDispatcher 的调试提示（outlineItemId 检查/为空/parsed keys）
                        if (/\\[URLJumpDispatcher\\]\\s*(检查outlineItemId|outlineItemId为空|parsed keys)/.test(text)) {
                          // 直接移除该 toast
                          try { node.remove(); } catch (_) {}
                          return true;
                        }
                      } catch(e) {}
                      return false;
                    }
                    var root = document.getElementById("izi-toast-root") || document.getElementById("fallback-toast-container");
                    if (!root){
                      var mo = new MutationObserver(function(muts){
                        muts.forEach(function(m){
                          for (var i=0;i<m.addedNodes.length;i++){
                            var n=m.addedNodes[i];
                            if (n && n.nodeType===1){
                              if (n.id==="izi-toast-root" || n.id==="fallback-toast-container"){
                                root = n;
                              }
                              // 立即尝试处理
                              handle(n);
                              // 子树中也处理
                              try {
                                var sub = n.querySelectorAll ? n.querySelectorAll("*") : [];
                                for (var j=0;j<sub.length;j++){ handle(sub[j]); }
                              } catch(_){}
                            }
                          }
                        });
                      });
                      mo.observe(document.documentElement || document.body, { childList:true, subtree:true });
                    } else {
                      var mo2 = new MutationObserver(function(muts){
                        muts.forEach(function(m){
                          for (var i=0;i<m.addedNodes.length;i++){
                            var n=m.addedNodes[i];
                            if (n && n.nodeType===1){
                              if (!handle(n)){
                                try {
                                  var sub = n.querySelectorAll ? n.querySelectorAll("*") : [];
                                  for (var j=0;j<sub.length;j++){ handle(sub[j]); }
                                } catch(_){}
                              }
                            }
                          }
                        });
                      });
                      mo2.observe(root, { childList:true, subtree:true });
                    }
                  } catch(e) {
                    console.warn("[MainWindow] toast filter patch failed:", e && e.message);
                  }
                })();
                """
                if self.web_view and self.web_view.page():
                    self.web_view.page().runJavaScript(patch_js)
            except Exception:
                pass

            # 注入脚本：页面就绪后，使用全局 EventBus 通过 WebSocket 请求 pdf-library:info:requested，
            # 成功后将 header(#pdf-title) 更新为数据库中的 title（严格：不从 URL 与文件名获取）。
            try:
                pid = str(self.pdf_id)
            except Exception:
                pid = ""
            if pid:
                js_title_script = f"""
                (function() {{
                    try {{
                        var pdfId = {json.dumps(pid)};
                        function ensureEventBus() {{
                            try {{
                                return (window.pdfViewerApp && window.pdfViewerApp.eventBus) ? window.pdfViewerApp.eventBus : null;
                            }} catch (e) {{ return null; }}
                        }}
                        function ensureLogger() {{
                            try {{
                                return (window.__logger || console);
                            }} catch (e) {{ return console; }}
                        }}
                        var logger = ensureLogger();
                        function requestInfo() {{
                            var bus = ensureEventBus();
                            if (!bus) {{
                                setTimeout(requestInfo, 120);
                                return;
                            }}
                            var rid = 'info_' + Date.now() + '_' + Math.random().toString(36).slice(2,10);
                            // 统一响应处理（RESPONSE/RECEIVED 兼容）
                            function handleInfoCompleted(message) {{
                                try {{
                                    if (!message || message.request_id !== rid) return;
                                    var t = (message.type || message.received_type || '');
                                    if (t === 'pdf-library:info:completed') {{
                                        var title = (message.data && message.data.title) ? String(message.data.title).trim() : '';
                                        if (title) {{
                                            try {{
                                                var el = document.getElementById('pdf-title');
                                                if (el) {{
                                                    el.textContent = title;
                                                    el.title = title;
                                                }}
                                            }} catch (e) {{}}
                                            logger.info('[Injected] Header title updated from DB');
                                        }} else {{
                                            logger.error('[Injected] DB record missing title (strict)');
                                            try {{
                                                var bus = ensureEventBus();
                                                if (bus && bus.emit) {{
                                                    bus.emit('websocket:message:error', {{
                                                        type: 'pdf-library:info:failed',
                                                        request_id: rid,
                                                        message: '数据库记录缺少标题，请补全后重试'
                                                    }}, {{ actorId: 'InjectedTitle' }});
                                                }}
                                            }} catch(_){{
                                                /* ignore bus error */
                                            }}
                                        }}
                                    }}
                                }} catch(e) {{ }}
                            }}
                            // 注册一次性回调（RESPONSE + RECEIVED 兼容，避免旧包未路由的问题）
                            var onResp = function(message) {{ handleInfoCompleted(message); bus.off && bus.off('websocket:message:response', onResp); }};
                            var onRecv = function(message) {{ handleInfoCompleted(message); bus.off && bus.off('websocket:message:received', onRecv); }};
                            var onErr = function(message) {{
                                try {{
                                    if (!message || message.request_id !== rid) return;
                                    var emsg = (message && (message.message || (message.error && message.error.message))) || '请求失败';
                                    logger.error('[Injected] info request failed:', emsg);
                                    try {{
                                        var bus = ensureEventBus();
                                        if (bus && bus.emit) {{
                                            bus.emit('websocket:message:error', {{
                                                type: 'pdf-library:info:failed',
                                                request_id: rid,
                                                message: emsg
                                            }}, {{ actorId: 'InjectedTitle' }});
                                        }}
                                    }} catch(_){{
                                        /* ignore bus error */
                                    }}
                                }} catch(e) {{}}
                            }};
                            bus.on && bus.on('websocket:message:response', onResp, {{ subscriberId: 'InjectedTitle' }});
                            bus.on && bus.on('websocket:message:received', onRecv, {{ subscriberId: 'InjectedTitle' }});
                            bus.on && bus.on('websocket:message:error', onErr, {{ subscriberId: 'InjectedTitle' }});
                            // 发送请求（严格携带 metadata）
                            var msg = {{
                                type: 'pdf-library:info:requested',
                                request_id: rid,
                                metadata: {{ version: '1.0.0' }},
                                data: {{ pdf_id: pdfId }}
                            }};
                            bus.emit && bus.emit('websocket:message:send', msg, {{ actorId: 'InjectedTitle' }});
                            logger.info('[Injected] info request sent for title');
                        }}
                        requestInfo();
                    }} catch (e) {{
                        try {{ console.error('[Injected] title script error', e); }} catch(_) {{}}
                    }}
                }})();"""
                if self.web_view and self.web_view.page():
                    self.web_view.page().runJavaScript(js_title_script)

            self.status_bar.showMessage(f'页面加载完成 (PDF: {self.pdf_id})')
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage(f'页面加载失败 (PDF: {self.pdf_id})')

    def load_frontend(self, url: str):
        """加载前端URL"""
        if self.web_view:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f'正在加载: {url} (PDF: {self.pdf_id})')

    def update_js_logger_reference(self):
        """更新WebPage中的js_logger引用"""
        if self.web_page and hasattr(self.web_page, 'js_logger'):
            self.web_page.js_logger = self.js_logger

    def resizeEvent(self, event):
        """窗口大小调整事件"""
        super().resizeEvent(event)
        # 确保WebView正确响应窗口大小变化
        if self.web_view:
            # 强制更新布局
            self.web_view.updateGeometry()

    def closeEvent(self, event):
        """窗口关闭事件（最小化实现）。

        仅发出 window_closing 信号并接受事件；其余清理逻辑在 PdfViewerApp.cleanup 中完成。
        """
        try:
            if hasattr(self, 'window_closing'):
                self.window_closing.emit()
        except Exception:
            pass
        try:
            event.accept()
        except Exception:
            pass
        try:
            super().closeEvent(event)
        except Exception:
            pass

    # def closeEvent(self, event):
    #     """窗口关闭事件 - 增强版日志追踪每一步

    #     注意：详细日志默认关闭以提升性能。需要调试时设置 enable_close_event_debug=True
    #     """
    #     import json
    #     from pathlib import Path
    #     from datetime import datetime
    #     import sys
    #     import traceback as tb

    #     # 检查是否启用详细日志
    #     enable_debug = getattr(self, 'enable_close_event_debug', False)

    #     # 创建日志函数，同时输出到控制台和文件（增强版）
    #     def log_message(msg, level="INFO"):
    #         if not enable_debug:
    #             return  # 日志关闭时直接返回

    #         timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    #         formatted_msg = f"[{timestamp}] [{level}] {msg}"
    #         print(formatted_msg, flush=True)  # 强制刷新输出
    #         try:
    #             log_path = Path(__file__).parent.parent.parent.parent / 'logs' / 'window-close.log'
    #             log_path.parent.mkdir(parents=True, exist_ok=True)
    #             with open(log_path, 'a', encoding='utf-8') as f:
    #                 f.write(formatted_msg + "\n")
    #                 f.flush()  # 立即写入磁盘
    #         except Exception as log_error:
    #             print(f"[日志写入失败] {log_error}", flush=True)

    #     log_message(f"========== [MainWindow-{self.pdf_id}] closeEvent 开始 ==========", "START")
    #     log_message(f"Python版本: {sys.version}")
    #     log_message(f"进程PID: {os.getpid()}")

    #     # 步骤 0: 检查对象状态
    #     try:
    #         log_message("步骤0: 检查MainWindow对象状态")
    #         log_message(f"  - pdf_id: {getattr(self, 'pdf_id', 'MISSING')}")
    #         log_message(f"  - web_view存在: {hasattr(self, 'web_view') and self.web_view is not None}")
    #         log_message(f"  - web_page存在: {hasattr(self, 'web_page') and self.web_page is not None}")
    #         log_message(f"  - js_logger存在: {hasattr(self, 'js_logger') and self.js_logger is not None}")
    #         log_message(f"  - parent存在: {hasattr(self, 'parent') and self.parent is not None}")
    #         log_message("步骤0: ✓ 对象状态检查完成")
    #     except Exception as e:
    #         log_message(f"步骤0: ✗ 对象状态检查失败: {e}", "ERROR")
    #         log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     # 步骤 1: 发出窗口关闭信号
    #     log_message("步骤1: 准备发出 window_closing 信号")
    #     try:
    #         # 检查信号是否存在
    #         if not hasattr(self, 'window_closing'):
    #             log_message("步骤1: ✗ window_closing 信号不存在!", "ERROR")
    #         else:
    #             log_message(f"步骤1: window_closing 信号存在，准备 emit()")
    #             self.window_closing.emit()
    #             log_message(f"步骤1: ✓ 已成功发出 window_closing 信号", "SUCCESS")
    #     except Exception as e:
    #         log_message(f"步骤1: ✗ 发出 window_closing 信号失败: {e}", "ERROR")
    #         log_message(f"  异常类型: {type(e).__name__}", "ERROR")
    #         log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     # 步骤 1.5: 先解绑页面与通道、停止页面活动，降低后续清理时序压力
    #     try:
    #         if hasattr(self, 'web_page') and self.web_page is not None:
    #             try:
    #                 # 解除 QWebChannel 绑定，避免桥接对象在销毁过程中收到调用
    #                 self.web_page.setWebChannel(None)
    #             except Exception:
    #                 pass
    #             try:
    #                 # 断开页面标题变更等信号，减少关闭过程中的回调触发
    #                 if hasattr(self.web_page, 'titleChanged'):
    #                     try:
    #                         self.web_page.titleChanged.disconnect()
    #                     except Exception:
    #                         pass
    #             except Exception:
    #                 pass
    #             try:
    #                 # 断开 JS 日志器引用，避免在关闭过程中继续写日志
    #                 if hasattr(self.web_page, 'js_logger'):
    #                     self.web_page.js_logger = None
    #             except Exception:
    #                 pass
    #     except Exception:
    #         pass

    #     # 停止 WebView 的活动脚本/加载（优先切换到 about:blank）
    #     try:
    #         if hasattr(self, 'web_view') and self.web_view is not None:
    #             try:
    #                 self.web_view.stop()
    #             except Exception:
    #                 pass
    #             try:
    #                 from src.qt.compat import QUrl as _QUrl
    #                 self.web_view.setUrl(_QUrl('about:blank'))
    #             except Exception:
    #                 pass
    #     except Exception:
    #         pass

    #     # 步骤 2: 清理 JSON 文件中的窗口记录（采用原子写）
    #     log_message("步骤2: 开始清理 frontend-process-info.json")
    #     try:
    #         # 获取项目根目录 (main_window.py -> pyqt -> pdf-viewer -> frontend -> src -> 项目根目录)
    #         project_root = Path(__file__).parent.parent.parent.parent.parent
    #         log_message(f"步骤2: 项目根目录: {project_root}")

    #         # 从 frontend-process-info.json 中移除当前窗口的记录
    #         try:
    #             frontend_info_path = project_root / 'logs' / 'frontend-process-info.json'
    #             log_message(f"步骤2: 目标文件路径: {frontend_info_path}")
    #             log_message(f"步骤2: 文件是否存在: {frontend_info_path.exists()}")

    #             if frontend_info_path.exists():
    #                 log_message(f"步骤2: 准备读取文件...")
    #                 with open(frontend_info_path, 'r', encoding='utf-8') as f:
    #                     data = json.load(f)
    #                 log_message(f"步骤2: ✓ 文件读取成功，数据键: {list(data.keys())}")

    #                 # 从 frontend 记录中移除 pdf-viewer 相关的实例
    #                 # pdf-viewer 使用 pdf-viewer-{pdf_id} 作为键名
    #                 if 'frontend' in data and isinstance(data['frontend'], dict):
    #                     log_message(f"步骤2: frontend 键存在，包含 {len(data['frontend'])} 个条目")
    #                     log_message(f"步骤2: 现有键列表: {list(data['frontend'].keys())}")

    #                     # 查找并移除所有包含当前pdf_id的键
    #                     keys_to_remove = [
    #                         key for key in data['frontend'].keys()
    #                         if key.startswith('pdf-viewer') and self.pdf_id in key
    #                     ]
    #                     log_message(f"步骤2: 找到 {len(keys_to_remove)} 个需要删除的键: {keys_to_remove}")

    #                     for key in keys_to_remove:
    #                         del data['frontend'][key]
    #                         log_message(f"步骤2: ✓ 已删除键: {key}")

    #                 # 写回文件
    #                 log_message(f"步骤2: 准备写回文件...")
    #                 try:
    #                     tmp_path = frontend_info_path.with_suffix(frontend_info_path.suffix + '.tmp')
    #                     payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    #                     with open(tmp_path, 'w', encoding='utf-8', newline='\n') as f:
    #                         f.write(payload)
    #                     tmp_path.replace(frontend_info_path)
    #                 except Exception as e:
    #                     # 回退到直接写入（尽量不影响关闭流程）
    #                     with open(frontend_info_path, 'w', encoding='utf-8') as f:
    #                         json.dump(data, f, ensure_ascii=False, indent=2)
    #                 log_message(f"步骤2: ✓ 清理前端进程信息成功", "SUCCESS")
    #             else:
    #                 log_message(f"步骤2: 文件不存在，跳过清理", "WARN")
    #         except Exception as e:
    #             log_message(f"步骤2: ✗ 清理前端进程信息失败: {e}", "ERROR")
    #             log_message(f"  异常类型: {type(e).__name__}", "ERROR")
    #             log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     except Exception as e:
    #         log_message(f"步骤2: ✗ 步骤2总体异常: {e}", "ERROR")
    #         log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     # 步骤 3: 清理Qt资源 (web_view, web_page, js_logger)
    #     log_message("步骤3: 开始清理Qt资源")
    #     try:
    #         # 3.1: 清理 web_view
    #         if hasattr(self, 'web_view') and self.web_view is not None:
    #             log_message("步骤3.1: 准备清理 web_view")
    #             try:
    #                 log_message(f"步骤3.1: web_view 类型: {type(self.web_view).__name__}")
    #                 # 停止加载
    #                 self.web_view.stop()
    #                 log_message("步骤3.1: ✓ web_view.stop() 调用成功")
    #                 # 不主动删除，让Qt管理生命周期
    #                 log_message("步骤3.1: ✓ web_view 清理完成", "SUCCESS")
    #             except Exception as e:
    #                 log_message(f"步骤3.1: ✗ 清理 web_view 失败: {e}", "ERROR")
    #                 log_message(f"  堆栈: {tb.format_exc()}", "ERROR")
    #         else:
    #             log_message("步骤3.1: web_view 不存在或已为 None，跳过")

    #         # 3.2: 清理 web_page
    #         if hasattr(self, 'web_page') and self.web_page is not None:
    #             log_message("步骤3.2: 准备清理 web_page")
    #             try:
    #                 log_message(f"步骤3.2: web_page 类型: {type(self.web_page).__name__}")
    #                 # 不主动删除，让Qt管理生命周期
    #                 log_message("步骤3.2: ✓ web_page 清理完成", "SUCCESS")
    #             except Exception as e:
    #                 log_message(f"步骤3.2: ✗ 清理 web_page 失败: {e}", "ERROR")
    #                 log_message(f"  堆栈: {tb.format_exc()}", "ERROR")
    #         else:
    #             log_message("步骤3.2: web_page 不存在或已为 None，跳过")

    #         # 3.3: 清理 js_logger
    #         if hasattr(self, 'js_logger') and self.js_logger is not None:
    #             log_message("步骤3.3: 准备清理 js_logger")
    #             try:
    #                 log_message(f"步骤3.3: js_logger 类型: {type(self.js_logger).__name__}")
    #                 if hasattr(self.js_logger, 'stop'):
    #                     log_message("步骤3.3: 调用 js_logger.stop()...")
    #                     self.js_logger.stop()
    #                     log_message("步骤3.3: ✓ js_logger.stop() 调用成功")
    #                 else:
    #                     log_message("步骤3.3: js_logger 没有 stop() 方法")
    #                 log_message("步骤3.3: ✓ js_logger 清理完成", "SUCCESS")
    #             except Exception as e:
    #                 log_message(f"步骤3.3: ✗ 清理 js_logger 失败: {e}", "ERROR")
    #                 log_message(f"  堆栈: {tb.format_exc()}", "ERROR")
    #         else:
    #             log_message("步骤3.3: js_logger 不存在或已为 None，跳过")

    #         log_message("步骤3: ✓ Qt资源清理完成", "SUCCESS")

    #     except Exception as e:
    #         log_message(f"步骤3: ✗ Qt资源清理总体异常: {e}", "ERROR")
    #         log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     # 步骤 4: 接受关闭事件
    #     log_message("步骤4: 准备调用 event.accept()")
    #     try:
    #         log_message(f"步骤4: event 类型: {type(event).__name__}")
    #         log_message(f"步骤4: event.isAccepted() (调用前): {event.isAccepted()}")
    #         event.accept()
    #         log_message(f"步骤4: event.isAccepted() (调用后): {event.isAccepted()}")
    #         log_message(f"步骤4: ✓ event.accept() 调用成功", "SUCCESS")
    #     except Exception as e:
    #         log_message(f"步骤4: ✗ event.accept() 失败: {e}", "ERROR")
    #         log_message(f"  异常类型: {type(e).__name__}", "ERROR")
    #         log_message(f"  堆栈: {tb.format_exc()}", "ERROR")

    #     log_message(f"========== [MainWindow-{self.pdf_id}] closeEvent 完成 ==========", "END")
    #     log_message("")  # 空行分隔

    #     # 调用父类 closeEvent，确保 Qt 内部资源正确清理
    #     try:
    #         super().closeEvent(event)
    #     except Exception:
    #         pass
