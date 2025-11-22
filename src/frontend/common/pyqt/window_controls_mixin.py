"""
窗口控制Mixin类
提供PyQt Bridge的窗口控制方法（最小化、最大化、关闭、拖拽）
"""

from PyQt6.QtCore import pyqtSlot, QObject, QEvent, QPoint
from PyQt6.QtGui import QCursor
from PyQt6.QtWidgets import QApplication
import logging

logger = logging.getLogger(__name__)


class WindowControlsMixin:
    """
    窗口控制方法混入类，供PyQt Bridge使用

    提供窗口控制方法：
    - minimizeWindow(): 最小化窗口
    - maximizeWindow(): 最大化/还原窗口（切换）
    - requestCloseWindow(): 关闭窗口
    - startWindowDrag(): 开始拖拽模式
    - stopWindowDrag(): 结束拖拽模式

    使用方法:
        class MyBridge(QObject, WindowControlsMixin):
            def __init__(self, parent=None):
                super().__init__(parent)
                self.parent = parent  # 必需！
                self._init_drag_mode()  # 初始化拖拽模式

    注意:
        - 此Mixin假设self.parent是QMainWindow或QWidget实例
        - 所有方法都通过@pyqtSlot暴露给QWebChannel
    """

    def _init_drag_mode(self):
        """初始化拖拽模式相关字段（在Bridge的__init__中调用）"""
        self._drag_mode = False
        self._drag_start_pos = None
        self._window_start_pos = None
        self._mouse_event_filter = None

    @pyqtSlot(result=bool)
    def minimizeWindow(self) -> bool:
        """
        最小化窗口

        通过调用父窗口的showMinimized()方法实现。

        Returns:
            bool: True=成功最小化, False=失败（窗口不存在或方法不可用）

        Example:
            JavaScript调用:
            bridge.minimizeWindow().then(result => {
                console.log('Minimized:', result);
            });
        """
        try:
            # 修复：self.parent 是属性（MainWindow对象），不是方法
            # PyQtBridge.__init__中设置了 self.parent = parent
            window = getattr(self, 'parent', None)
            if window and hasattr(window, 'showMinimized'):
                logger.info("[WindowControlsMixin] Minimizing window...")
                window.showMinimized()
                logger.info("[WindowControlsMixin] Window minimized successfully")
                return True
            else:
                logger.warning("[WindowControlsMixin] Cannot minimize: parent window not found or method not available")
                return False
        except Exception as exc:
            logger.error(f"[WindowControlsMixin] minimizeWindow failed: {exc}")
            return False

    @pyqtSlot(result=bool)
    def maximizeWindow(self) -> bool:
        """
        最大化/还原窗口（切换）

        如果窗口已最大化,则还原到正常大小;
        如果窗口是正常大小,则最大化。

        Returns:
            bool: True=成功切换, False=失败（窗口不存在或方法不可用）

        Example:
            JavaScript调用:
            bridge.maximizeWindow().then(result => {
                console.log('Toggled maximize:', result);
            });
        """
        try:
            # 修复：self.parent 是属性（MainWindow对象），不是方法
            # PyQtBridge.__init__中设置了 self.parent = parent
            window = getattr(self, 'parent', None)
            if window and hasattr(window, 'isMaximized'):
                if window.isMaximized():
                    logger.info("[WindowControlsMixin] Restoring window to normal size...")
                    window.showNormal()
                    logger.info("[WindowControlsMixin] Window restored")
                else:
                    logger.info("[WindowControlsMixin] Maximizing window...")
                    window.showMaximized()
                    logger.info("[WindowControlsMixin] Window maximized")
                return True
            else:
                logger.warning("[WindowControlsMixin] Cannot toggle maximize: parent window not found or method not available")
                return False
        except Exception as exc:
            logger.error(f"[WindowControlsMixin] maximizeWindow failed: {exc}")
            return False

    @pyqtSlot(result=bool)
    def requestCloseWindow(self) -> bool:
        """
        请求关闭窗口

        从前端调用,允许前端在关闭前执行清理操作（如断开WebSocket）。
        调用父窗口的close()方法,会触发closeEvent进行资源清理。

        Returns:
            bool: True=关闭请求已接受, False=失败（窗口不存在）

        Example:
            JavaScript调用:
            // 先断开WebSocket
            await wsClient.disconnect('user_close');
            // 再关闭窗口
            bridge.requestCloseWindow().then(result => {
                console.log('Close requested:', result);
            });
        """
        try:
            # 修复：self.parent 是属性（MainWindow对象），不是方法
            # PyQtBridge.__init__中设置了 self.parent = parent
            window = getattr(self, 'parent', None)
            if window and hasattr(window, 'close'):
                logger.info("[WindowControlsMixin] Window close requested from frontend")
                # Close the window (will trigger closeEvent)
                window.close()
                logger.info("[WindowControlsMixin] Window close method called")
                return True
            else:
                logger.warning("[WindowControlsMixin] Cannot close: parent window not found")
                return False
        except Exception as exc:
            logger.error(f"[WindowControlsMixin] requestCloseWindow failed: {exc}")
            return False

    @pyqtSlot(result=bool)
    def startWindowDrag(self) -> bool:
        """
        开始窗口拖拽模式

        在PyQt层安装全局鼠标事件过滤器，捕捉鼠标移动事件。
        前端只需调用此方法，无需频繁通信。

        Returns:
            bool: True=成功开始, False=失败（窗口不存在）

        Example:
            JavaScript调用:
            bridge.startWindowDrag().then(result => {
                console.log('Drag mode started:', result);
            });
        """
        try:
            window = getattr(self, 'parent', None)
            if not window:
                logger.warning("[WindowControlsMixin] Cannot start drag: parent window not found")
                return False

            # 记录起始位置
            self._drag_start_pos = QCursor.pos()
            self._window_start_pos = window.pos()
            self._drag_mode = True

            # 安装事件过滤器
            if not self._mouse_event_filter:
                self._mouse_event_filter = _MouseDragFilter(self)
                QApplication.instance().installEventFilter(self._mouse_event_filter)

            logger.info("[WindowControlsMixin] Drag mode started")
            return True
        except Exception as exc:
            logger.error(f"[WindowControlsMixin] startWindowDrag failed: {exc}")
            return False

    @pyqtSlot(result=bool)
    def stopWindowDrag(self) -> bool:
        """
        结束窗口拖拽模式

        移除全局鼠标事件过滤器，停止捕捉鼠标移动。

        Returns:
            bool: True=成功结束, False=失败

        Example:
            JavaScript调用:
            bridge.stopWindowDrag().then(result => {
                console.log('Drag mode stopped:', result);
            });
        """
        try:
            self._drag_mode = False

            # 移除事件过滤器
            if self._mouse_event_filter:
                QApplication.instance().removeEventFilter(self._mouse_event_filter)
                self._mouse_event_filter = None

            logger.info("[WindowControlsMixin] Drag mode stopped")
            return True
        except Exception as exc:
            logger.error(f"[WindowControlsMixin] stopWindowDrag failed: {exc}")
            return False


class _MouseDragFilter(QObject):
    """
    全局鼠标事件过滤器（用于拖拽窗口）

    捕捉全局鼠标移动事件，直接在PyQt层移动窗口，
    避免频繁的QWebChannel通信。
    """

    def __init__(self, mixin):
        super().__init__()
        self.mixin = mixin

    def eventFilter(self, obj, event):
        """事件过滤器：处理鼠标移动事件"""
        # 只处理鼠标移动事件
        if event.type() == QEvent.Type.MouseMove and self.mixin._drag_mode:
            window = getattr(self.mixin, 'parent', None)
            if window and self.mixin._drag_start_pos and self.mixin._window_start_pos:
                # 计算鼠标移动的增量
                current_pos = QCursor.pos()
                delta = current_pos - self.mixin._drag_start_pos

                # 移动窗口
                new_window_pos = self.mixin._window_start_pos + delta
                window.move(new_window_pos)

        return False  # 不拦截事件，继续传播
