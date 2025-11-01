"""PDF 书签表插件实现（兼容层）

前端已切换为 outline 域。为兼容旧导入路径，本模块导出旧类名，
其实现委托至 `PDFOutlineTablePlugin`。建议新代码改用：
`src.backend.database.plugins.pdf_outline_plugin.PDFOutlineTablePlugin`。
"""
from __future__ import annotations

from .pdf_outline_plugin import PDFOutlineTablePlugin as _PDFOutlineTablePlugin


class PDFBookmarkTablePlugin(_PDFOutlineTablePlugin):
    """兼容旧类名，行为由 PDFOutlineTablePlugin 提供。"""
    pass

