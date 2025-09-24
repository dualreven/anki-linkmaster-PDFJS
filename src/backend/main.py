#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 主程序入口

这是应用程序的主入口点，负责启动PyQt6应用。
"""

import sys
import os
import argparse
# Respect existing env if provided by launcher; fallback to 9223
_debug_port = os.environ.get('QTWEBENGINE_REMOTE_DEBUGGING', '9223')
os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = _debug_port

# 将项目根目录添加到Python路径
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(backend_dir))
sys.path.insert(0, project_root)

from src.backend.app.application import AnkiLinkMasterApp


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="Anki LinkMaster PDFJS 后端服务器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py                                    # 使用默认端口启动
  python main.py --ws-port 8765 --http-port 8080   # 指定端口启动
  python main.py --module pdf-home                  # 启动pdf-home模块
  python main.py --file-path /path/to/file.pdf      # 指定PDF文件
        """
    )

    parser.add_argument(
        '--module',
        default='pdf-viewer',
        choices=['pdf-viewer', 'pdf-home'],
        help='要加载的前端模块 (默认: pdf-viewer)'
    )

    parser.add_argument(
        '--vite-port',
        type=int,
        default=3000,
        help='Vite开发服务器端口 (默认: 3000)'
    )

    parser.add_argument(
        '--ws-port',
        type=int,
        default=8765,
        help='WebSocket服务器端口 (默认: 8765)'
    )

    parser.add_argument(
        '--http-port',
        type=int,
        default=8080,
        help='HTTP文件服务器端口 (默认: 8080)'
    )

    parser.add_argument(
        '--file-path',
        help='PDF文件路径 (仅pdf-viewer模块有效)'
    )

    return parser.parse_args()


def main(module="pdf-viewer", vite_port=3000, file_path=None, ws_port=8765, http_port=8080):
    """主函数 - 纯后端服务器启动

    Args:
        module: 要加载的前端模块 (pdf-home 或 pdf-viewer)
        vite_port: Vite开发服务器端口
        file_path: PDF文件路径 (仅pdf-viewer模块有效)
        ws_port: WebSocket服务器端口
        http_port: HTTP文件服务器端口

    注意: QApplication 需要由外层启动器(如ai-launcher.py)创建和管理
    """
    try:
        print("启动后端服务器...")

        # 创建并运行应用
        main_app = AnkiLinkMasterApp()
        main_app.run(module, vite_port, file_path, ws_port, http_port)

        print("后端服务器启动成功，服务运行中...")
        print("注意：这个程序需要在有QApplication事件循环的环境中运行")
        print("请使用 ai-launcher.py 或在Anki插件环境中启动")

        return 0

    except Exception as e:
        print(f"应用启动失败: {e}")
        return 1


if __name__ == "__main__":
    # 解析命令行参数
    args = parse_arguments()

    # 使用解析的参数启动应用
    sys.exit(main(
        module=args.module,
        vite_port=args.vite_port,
        file_path=args.file_path,
        ws_port=args.ws_port,
        http_port=args.http_port
    ))
