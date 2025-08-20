"""
主窗口类
负责创建和管理应用程序的主界面
"""

from PyQt6.QtWidgets import QMainWindow, QVBoxLayout, QWidget, QStatusBar
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtCore import QUrl, pyqtSignal
from PyQt6.QtGui import QAction


class MainWindow(QMainWindow):
    """主窗口类"""
    
    # 定义信号
    web_loaded = pyqtSignal()
    
    def __init__(self):
        """初始化主窗口"""
        super().__init__()
        
        # 窗口属性
        self.setWindowTitle("Anki LinkMaster PDFJS")
        self.setGeometry(100, 100, 1200, 800)
        
        # 初始化UI
        self._init_ui()
        self._init_menu()
        self._init_status_bar()
        
    def _init_ui(self):
        """初始化用户界面"""
        # 创建WebEngine视图
        self.web_view = QWebEngineView()
        self.web_view.loadFinished.connect(self._on_web_loaded)
        
        # 设置主布局
        layout = QVBoxLayout()
        layout.addWidget(self.web_view)
        
        # 创建中心部件
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)
        
    def _init_menu(self):
        """初始化菜单栏"""
        menubar = self.menuBar()
        
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
        
    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
        
    def load_frontend(self, url="http://localhost:5173"):
        """加载前端页面
        
        Args:
            url: 前端页面URL，默认为开发服务器地址
        """
        try:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f"正在加载: {url}")
        except Exception as e:
            self.status_bar.showMessage(f"加载失败: {str(e)}")
            
    def reload_page(self):
        """重新加载当前页面"""
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
        
    def closeEvent(self, event):
        """窗口关闭事件"""
        # 这里可以添加清理逻辑
        event.accept()