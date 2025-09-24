#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Launcher - 引导脚本
调用模块化的 ai_launcher 实现
"""

import sys
from pathlib import Path

# 将ai-scripts目录添加到Python路径，以便导入ai_launcher模块
project_root = Path(__file__).parent.absolute()
ai_scripts_path = project_root / "ai-scripts"
sys.path.insert(0, str(ai_scripts_path))

def create_backend_only_command():
    """创建仅启动后端服务器的命令"""
    import argparse

    # 检查是否是backend-only模式
    if len(sys.argv) > 1 and sys.argv[1] == 'backend-only':
        parser = argparse.ArgumentParser(
            description="启动纯后端服务器 (带QApplication环境)",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  python ai-launcher.py backend-only                           # 使用默认端口
  python ai-launcher.py backend-only --ws-port 8766 --http-port 8081  # 指定端口
            """
        )

        parser.add_argument('mode', choices=['backend-only'], help='启动模式')
        parser.add_argument('--module', default='pdf-viewer', choices=['pdf-viewer', 'pdf-home'],
                          help='前端模块 (默认: pdf-viewer)')
        parser.add_argument('--vite-port', type=int, default=3000,
                          help='Vite开发服务器端口 (默认: 3000)')
        parser.add_argument('--ws-port', type=int, default=8765,
                          help='WebSocket服务器端口 (默认: 8765)')
        parser.add_argument('--http-port', type=int, default=8080,
                          help='HTTP文件服务器端口 (默认: 8080)')
        parser.add_argument('--file-path', help='PDF文件路径 (仅pdf-viewer模块有效)')

        args = parser.parse_args()

        # 启动带QApplication的后端服务器
        start_backend_with_qapp(args)
        return True

    return False

def start_backend_with_qapp(args):
    """启动带QApplication的后端服务器"""
    try:
        # 导入Qt组件
        sys.path.insert(0, str(project_root))
        from src.qt.compat import QApplication
        from src.backend.main import main as backend_main

        print("创建QApplication环境...")
        app = QApplication(sys.argv[:1])  # 只传递程序名，避免参数冲突

        # 设置应用属性
        app.setApplicationName("Anki LinkMaster PDFJS Backend")
        app.setApplicationVersion("1.0.0")
        app.setOrganizationName("Anki LinkMaster")

        print("启动后端服务器...")
        # 启动后端服务器
        backend_main(
            module=args.module,
            vite_port=args.vite_port,
            file_path=args.file_path,
            ws_port=args.ws_port,
            http_port=args.http_port
        )

        print("后端服务器启动完成，进入事件循环...")
        print("按 Ctrl+C 退出")

        # 启动Qt事件循环
        return app.exec()

    except KeyboardInterrupt:
        print("\n收到中断信号，正在关闭...")
        return 0
    except Exception as e:
        print(f"后端服务器启动失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

try:
    # 检查是否是backend-only模式
    if create_backend_only_command():
        # 已处理backend-only命令，直接退出
        pass
    else:
        # 导入模块化版本的主入口
        from ai_launcher.cli.command_parser import main as ai_launcher_main

        # 直接调用模块化版本
        if __name__ == "__main__":
            ai_launcher_main()

except ImportError as e:
    print(f"错误：无法导入AI Launcher模块")
    print(f"详细信息：{e}")
    print(f"请确保ai-scripts/ai_launcher模块完整")
    sys.exit(1)
except Exception as e:
    print(f"AI Launcher执行错误：{e}")
    sys.exit(1)