"""
主窗口类
负责创建和管理应用程序的主界面
"""

from src.backend.qt.compat import (
    QMainWindow, QVBoxLayout, QWidget, QStatusBar,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QUrl, pyqtSignal, QAction
)


class MainWindow(QMainWindow):
    """主窗口类"""
    send_debug_message_requested = pyqtSignal()
    # 定义信号
    web_loaded = pyqtSignal()
    
    def __init__(self,app):
        """初始化主窗口"""
        super().__init__()
        self.parent = app
        # 窗口属性
        self.setWindowTitle("Anki LinkMaster PDFJS")
        self.setGeometry(100, 100, 1200, 800)
        
        # QtWebEngine Inspector设置
        self.inspector_window = None
        
        # 初始化UI
        self._init_ui()
        self._init_menu()
        self._init_status_bar()
        
    def _init_ui(self):
        """初始化用户界面"""
        # 启用远程调试端口 - 必须在创建WebEngineView之前设置
        import os
        os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '9222'
        
        # 创建WebEngine视图
        self.web_view = QWebEngineView() if QWebEngineView else None
        if self.web_view:
            self.web_view.loadFinished.connect(self._on_web_loaded)
        
        # 设置开发者工具属性
        if self.web_view and QWebEngineSettings:
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        
        # 设置安全选项
        # 注意：WebSecurityEnabled 在当前PyQt6版本中可能不存在，已移除
        if self.web_view and QWebEngineSettings:
            settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.XSSAuditingEnabled, True)
        
        # 创建自定义页面以支持Inspector
        if self.web_view and QWebEnginePage:
            self.web_page = QWebEnginePage(self.web_view)
            self.web_view.setPage(self.web_page)
        else:
            self.web_page = None
        
        # 设置主布局
        layout = QVBoxLayout()
        if self.web_view:
            layout.addWidget(self.web_view)
        
        # 创建中心部件
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)
        
    def _init_menu(self):
        """初始化菜单栏"""
        menubar = self.menuBar()
        debug_menu = menubar.addMenu('调试,通过ws发送消息到前端')
        debug_action = QAction('发送消息', self)
        debug_action.triggered.connect(self.send_debug_message_requested.emit)
        debug_menu.addAction(debug_action)


        # 文件菜单
        file_menu = menubar.addMenu('文件')
        
        # 添加退出动作
        exit_action = QAction('退出', self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 视图菜单
        view_menu = menubar.addMenu('视图')
        
        # 刷新动作
        refresh_action = QAction('刷新', self)
        refresh_action.triggered.connect(self.reload_page)
        view_menu.addAction(refresh_action)
        
        # 开发者菜单
        dev_menu = menubar.addMenu('开发者')
        
        # 开发者工具
        inspector_action = QAction('开发者工具 (F12)', self)
        inspector_action.setShortcut('F12')
        inspector_action.triggered.connect(self.toggle_inspector)
        dev_menu.addAction(inspector_action)
        
        # 远程调试
        remote_debug_action = QAction('打开远程调试', self)
        remote_debug_action.triggered.connect(self.open_remote_debug)
        dev_menu.addAction(remote_debug_action)
        
        # JavaScript控制台
        console_action = QAction('JavaScript控制台 (Ctrl+Shift+J)', self)
        console_action.setShortcut('Ctrl+Shift+J')
        console_action.triggered.connect(self.open_javascript_console)
        dev_menu.addAction(console_action)
        
        # 页面源码
        source_action = QAction('查看页面源码 (Ctrl+U)', self)
        source_action.setShortcut('Ctrl+U')
        source_action.triggered.connect(self.view_page_source)
        dev_menu.addAction(source_action)
        
    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
        
    def load_frontend(self, url="http://localhost:3000/pdf-viewer/index.html"):
        """加载前端页面"""
        try:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f"正在加载: {url}")
        except Exception as e:
            self.status_bar.showMessage(f"加载失败: {str(e)}")
            
    def reload_page(self):
        """重新加载当前页面"""
        if self.web_view:
            self.web_view.reload()
        
    def _on_web_loaded(self, success):
        """页面加载完成回调"""
        if success:
            self.status_bar.showMessage("页面加载完成")
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage("页面加载失败")
            
    def show_error(self, message):
        """显示错误信息"""
        self.status_bar.showMessage(f"错误: {message}")
        
    def toggle_inspector(self):
        """切换开发者工具显示"""
        if self.inspector_window is None or not self.inspector_window.isVisible():
            self.show_inspector()
        else:
            self.hide_inspector()
    
    def show_inspector(self):
        """显示开发者工具"""
        try:
            from PyQt6.QtWebEngineWidgets import QWebEngineView
            from PyQt6.QtWidgets import QMainWindow
            
            if self.inspector_window is None:
                # 创建Inspector窗口
                self.inspector_window = QMainWindow(self)
                self.inspector_window.setWindowTitle("开发者工具")
                self.inspector_window.setGeometry(1300, 100, 800, 600)
                
                # 创建Inspector视图
                self.inspector_view = QWebEngineView()
                self.inspector_window.setCentralWidget(self.inspector_view)
            
            # 显示Inspector
            self.inspector_window.show()
            self.inspector_window.raise_()
            self.inspector_window.activateWindow()
            
            # 设置Inspector URL
            inspector_url = "http://localhost:9222"
            self.inspector_view.load(QUrl(inspector_url))
            
            self.status_bar.showMessage("开发者工具已打开")
            
        except Exception as e:
            self.status_bar.showMessage(f"打开开发者工具失败: {str(e)}")
    
    def hide_inspector(self):
        """隐藏开发者工具"""
        if self.inspector_window:
            self.inspector_window.hide()
            self.status_bar.showMessage("开发者工具已关闭")
    
    def open_remote_debug(self):
        """打开远程调试页面"""
        import webbrowser
        try:
            webbrowser.open("http://localhost:9222")
            self.status_bar.showMessage("远程调试页面已打开")
        except Exception as e:
            self.status_bar.showMessage(f"打开远程调试失败: {str(e)}")
    
    def open_javascript_console(self):
        """打开JavaScript控制台"""
        try:
            if self.web_page:
                self.web_page.runJavaScript("console.clear(); console.log('JavaScript控制台已激活');")
            self.show_inspector()
            self.status_bar.showMessage("JavaScript控制台已激活")
        except Exception as e:
            self.status_bar.showMessage(f"激活JavaScript控制台失败: {str(e)}")
    
    def view_page_source(self):
        """查看页面源码"""
        try:
            if self.web_page:
                self.web_page.toHtml(self._on_page_source_loaded)
            self.status_bar.showMessage("正在获取页面源码...")
        except Exception as e:
            self.status_bar.showMessage(f"获取页面源码失败: {str(e)}")
    
    def _on_page_source_loaded(self, html):
        """页面源码加载完成回调"""
        try:
            from PyQt6.QtWidgets import QDialog, QTextEdit, QVBoxLayout, QPushButton
            
            # 创建源码查看窗口
            dialog = QDialog(self)
            dialog.setWindowTitle("页面源码")
            dialog.setGeometry(200, 200, 800, 600)
            
            # 创建文本编辑器
            text_edit = QTextEdit()
            text_edit.setPlainText(html)
            text_edit.setReadOnly(True)
            
            # 创建关闭按钮
            close_button = QPushButton("关闭")
            close_button.clicked.connect(dialog.close)
            
            # 设置布局
            layout = QVBoxLayout()
            layout.addWidget(text_edit)
            layout.addWidget(close_button)
            
            dialog.setLayout(layout)
            dialog.exec_()
            
            self.status_bar.showMessage("页面源码查看完成")
            
        except Exception as e:
            self.status_bar.showMessage(f"显示页面源码失败: {str(e)}")

    def closeEvent(self, event):
        """窗口关闭事件"""
        # 关闭Inspector窗口
        if self.inspector_window:
            self.inspector_window.close()
        event.accept()