from PyQt6.QtCore import QCoreApplication, Qt
QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts, True)
import PyQt6.QtWebEngineWidgets as we
print('pre-import ok', we)
from PyQt6.QtWidgets import QApplication
app = QApplication([])
print('QApp ok')
