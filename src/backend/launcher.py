#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 后端服务启动器（精简入口）

拆分目标：
- launcher_core.ports: 端口/日志目录解析
- launcher_core.processes: 子进程管理
- launcher_core.legacy: 兼容 CLI 的 LegacyBackendLauncher
- launcher_core.pyqt_launcher: BackendLauncher（PyQt 集成）
本文件仅保留日志初始化、参数解析与 CLI main，向下委托。
"""

import sys
import os
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import json as _json

# 设置项目根目录
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent.parent
sys.path.insert(0, str(project_root))

# 从拆分后的核心模块导入
from src.backend.launcher_core.ports import BackendPortManager, _resolve_logs_dir  # noqa: E402
from src.backend.launcher_core.processes import BackendProcessManager  # noqa: E402
from src.backend.launcher_core.legacy import LegacyBackendLauncher  # noqa: E402
from src.backend.launcher_core.pyqt_launcher import BackendLauncher  # noqa: E402

# 确保logs目录存在（可被配置覆盖）
logs_dir = _resolve_logs_dir(project_root)

# 配置日志 - 同时输出到控制台和文件（UTF-8）
log_file = logs_dir / 'backend-launcher.log'
try:
    with open(log_file, 'wb'):
        pass
except Exception:
    pass
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('backend-launcher')


def parse_arguments() -> argparse.Namespace:
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="Anki LinkMaster PDFJS 后端服务启动器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python launcher.py start                                    # 启动所有后端服务
  python launcher.py start --msgCenter-port 8766            # 指定消息中心服务器端口
  python launcher.py start --pdfFileServer-port 8080         # 指定PDF文件服务器端口
  python launcher.py stop                                     # 停止所有服务
  python launcher.py status                                   # 查看服务状态
        """
    )
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    # start 命令
    start_parser = subparsers.add_parser('start', help='启动后端服务')
    start_parser.add_argument('--msgCenter-port', type=int, dest='msgCenter_port', help='消息中心服务器端口')
    start_parser.add_argument('--pdfFileServer-port', type=int, dest='pdfFileServer_port', help='PDF文件服务器端口')
    start_parser.add_argument('--vite-port', type=int, dest='vite_port', help='Vite 开发服务器端口（开发模式必填）')
    start_parser.add_argument('--db-path', type=str, dest='db_path', help='数据库文件绝对路径（可选）')
    start_parser.add_argument('--runtime-mode', type=str, dest='runtime_mode', choices=['anki', 'single'], help='运行模式（anki|single）')
    start_parser.add_argument('--ankiaddon-root-path', type=str, dest='ankiaddon_root_path', help='Anki 插件根目录（当 runtime-mode=anki 时必填）')
    start_parser.add_argument('--data-dir', type=str, dest='data_dir', help='显式数据目录（可选，优先于 runtime-mode）')
    start_parser.add_argument('--static-dir', type=str, dest='static_dir', help='显式静态目录（可选）')
    start_parser.add_argument('--pdfs-dir', type=str, dest='pdfs_dir', help='显式 PDF 库目录（可选）')

    # stop/status
    subparsers.add_parser('stop', help='停止后端服务')
    subparsers.add_parser('status', help='查看服务状态')

    return parser.parse_args()


def main():
    """主函数（CLI 入口）"""
    args = parse_arguments()

    if not args.command:
        print("请指定命令: start, stop, 或 status")
        print("使用 --help 查看详细帮助")
        return 1

    # 使用 Legacy 模式（子进程）
    launcher = LegacyBackendLauncher(project_root=project_root)
    try:
        if args.command == 'start':
            success = launcher.start_services(args)
            status = launcher.show_status()
            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)
            return 0 if success else 1
        elif args.command == 'stop':
            success = launcher.stop_services()
            status = launcher.show_status()
            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)
            return 0 if success else 1
        elif args.command == 'status':
            status = launcher.show_status()
            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)
            return 0
    except KeyboardInterrupt:
        logger.info("用户中断操作")
        return 1
    except Exception as e:
        logger.error(f"执行出错: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
