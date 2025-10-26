#!/usr/bin/env python3
"""
Launch Configuration for PDF-Home and PDF-Viewer

统一的启动参数配置类，支持从命令行参数或代码构造。
用于 pdf-home 和 pdf-viewer 的双模式启动（子进程/寄宿）。
"""

from dataclasses import dataclass, field
from typing import Optional, Literal
import argparse


@dataclass
class LaunchConfig:
    """
    前端启动配置类

    支持两种构造方式：
    1. 从命令行参数构造：LaunchConfig.from_args(args)
    2. 从代码直接构造：LaunchConfig(pdf_id="xxx", is_prod=True, ...)

    示例：
        # CLI 模式
        args = parser.parse_args()
        config = LaunchConfig.from_args(args)

        # 代码模式
        config = LaunchConfig(
            pdf_id="sample",
            page_at=5,
            position=50.0,
            is_prod=True
        )
    """

    # ===== 运行模式 =====
    is_prod: bool = False
    """生产模式（True）或开发模式（False）"""

    use_vite: bool = True
    """是否使用 Vite 开发服务器（仅开发模式有效）"""

    # ===== 端口配置 =====
    vite_port: Optional[int] = None
    """Vite 开发服务器端口（None=自动解析）"""

    msgCenter_port: Optional[int] = None
    """消息中心 WebSocket 服务器端口（None=自动解析）"""

    pdfFile_port: Optional[int] = None
    """PDF 文件服务器端口（None=自动解析）"""

    js_debug_port: Optional[int] = None
    """JavaScript 调试端口（用于 QtWebEngine 远程调试）"""

    # ===== PDF-Viewer 专用参数 =====
    pdf_id: Optional[str] = None
    """PDF 标识符（优先于 file_path）"""

    file_path: Optional[str] = None
    """PDF 文件路径（当 pdf_id 无法解析时使用）"""

    page_at: Optional[int] = None
    """目标页码（1-based index，用于 URL 导航）"""

    position: Optional[float] = None
    """页面内垂直位置百分比（0-100，用于 URL 导航）"""

    anchor_id: Optional[str] = None
    """锚点 ID（格式：pdfanchor-test 或 pdfanchor-xxxxxxxxxxxx）"""

    annotation_id: Optional[str] = None
    """标注 ID（用于聚焦特定标注）"""

    # ===== 控制参数 =====
    keep_backend: bool = False
    """窗口关闭时保持后端服务运行（不停止）"""

    no_persist: bool = False
    """不持久化端口配置到 runtime-ports.json"""

    # ===== 元数据 =====
    source: str = "cli"
    """启动来源标识（cli | home | button | anki | integration）"""

    extra_params: dict = field(default_factory=dict)
    """额外的自定义参数"""

    # ===== 诊断模式 =====
    diagnose_only: bool = False
    """仅运行诊断，不启动 Qt 事件循环"""

    disable_webchannel: bool = False
    """禁用 QWebChannel 桥接"""

    disable_websocket: bool = False
    """禁用 WebSocket 连接"""

    disable_js_console: bool = False
    """禁用 JavaScript 控制台日志记录"""

    disable_frontend_load: bool = False
    """禁用前端加载（用于测试）"""

    # ===== 日志目录（新增） =====
    logs_dir: Optional[str] = None
    """显式日志目录（用于 runtime-ports 与前端日志落盘）；必须由调用方传入"""

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> 'LaunchConfig':
        """
        从命令行参数构造配置对象

        Args:
            args: argparse.Namespace 对象

        Returns:
            LaunchConfig 实例
        """
        # 判断生产模式
        is_prod = getattr(args, 'prod', False)

        # 端口参数
        vite_port = getattr(args, 'vite_port', None)
        msgCenter_port = getattr(args, 'msgCenter_port', None)
        pdfFile_port = getattr(args, 'pdfFile_port', None)
        js_debug_port = getattr(args, 'js_debug_port', None)

        # PDF-Viewer 导航参数
        pdf_id = getattr(args, 'pdf_id', None)
        file_path = getattr(args, 'file_path', None)
        page_at = getattr(args, 'page_at', None)
        position = getattr(args, 'position', None)
        anchor_id = getattr(args, 'anchor_id', None)
        annotation_id = getattr(args, 'annotation_id', None)

        # 控制参数
        keep_backend = getattr(args, 'keep_backend', False)
        no_persist = getattr(args, 'no_persist', False)
        logs_dir = getattr(args, 'logs_dir', None)

        # 诊断模式参数
        diagnose_only = getattr(args, 'diagnose_only', False)
        disable_webchannel = getattr(args, 'disable_webchannel', False)
        disable_websocket = getattr(args, 'disable_websocket', False)
        disable_js_console = getattr(args, 'disable_js_console', False)
        disable_frontend_load = getattr(args, 'disable_frontend_load', False)

        return cls(
            is_prod=is_prod,
            vite_port=vite_port,
            msgCenter_port=msgCenter_port,
            pdfFile_port=pdfFile_port,
            js_debug_port=js_debug_port,
            pdf_id=pdf_id,
            file_path=file_path,
            page_at=page_at,
            position=position,
            anchor_id=anchor_id,
            annotation_id=annotation_id,
            keep_backend=keep_backend,
            no_persist=no_persist,
            diagnose_only=diagnose_only,
            disable_webchannel=disable_webchannel,
            disable_websocket=disable_websocket,
            disable_js_console=disable_js_console,
            disable_frontend_load=disable_frontend_load,
            source="cli"
        , logs_dir=logs_dir)

    def to_dict(self) -> dict:
        """
        转换为字典（便于日志记录和序列化）

        Returns:
            包含所有配置项的字典
        """
        return {
            'is_prod': self.is_prod,
            'use_vite': self.use_vite,
            'vite_port': self.vite_port,
            'msgCenter_port': self.msgCenter_port,
            'pdfFile_port': self.pdfFile_port,
            'js_debug_port': self.js_debug_port,
            'pdf_id': self.pdf_id,
            'file_path': self.file_path,
            'page_at': self.page_at,
            'position': self.position,
            'anchor_id': self.anchor_id,
            'annotation_id': self.annotation_id,
            'keep_backend': self.keep_backend,
            'no_persist': self.no_persist,
            'source': self.source,
            'diagnose_only': self.diagnose_only,
            'disable_webchannel': self.disable_webchannel,
            'disable_websocket': self.disable_websocket,
            'disable_js_console': self.disable_js_console,
            'disable_frontend_load': self.disable_frontend_load,
            'extra_params': self.extra_params,
            'logs_dir': self.logs_dir
        }

    def __repr__(self) -> str:
        """字符串表示（便于调试）"""
        params = []
        if self.is_prod:
            params.append("prod")
        else:
            params.append("dev")

        if self.pdf_id:
            params.append(f"pdf_id={self.pdf_id}")
        if self.page_at:
            params.append(f"page={self.page_at}")
        if self.position:
            params.append(f"pos={self.position}%")
        if self.anchor_id:
            params.append(f"anchor={self.anchor_id}")

        return f"LaunchConfig({', '.join(params)})"
