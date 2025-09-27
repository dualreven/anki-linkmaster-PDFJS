"""
PDF文件服务器命令行接口

提供命令行参数解析和服务器启动功能。
支持端口、目录、日志级别等参数配置。
"""

import argparse
import sys
from pathlib import Path
from ..config.settings import DEFAULT_PORT, DEFAULT_DATA_DIR, LOG_FILE_NAME
from ..server.http_server import run_server
from ..utils.logging_config import setup_logging


def create_parser():
    """
    创建命令行参数解析器

    Returns:
        argparse.ArgumentParser: 配置好的参数解析器
    """
    parser = argparse.ArgumentParser(
        description="PDF文件服务器 - 提供PDF文件的HTTP访问服务",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  %(prog)s                                    # 使用默认配置启动
  %(prog)s --port 8081                        # 指定端口
  %(prog)s --directory /path/to/pdfs          # 指定PDF目录
  %(prog)s --port 8081 --directory ./pdfs     # 同时指定端口和目录
  %(prog)s --log-level DEBUG                  # 启用调试日志
  %(prog)s --no-console                       # 禁用控制台输出
        """
    )

    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"服务器监听的端口号 (默认: {DEFAULT_PORT})"
    )

    parser.add_argument(
        "--directory",
        type=str,
        default=str(DEFAULT_DATA_DIR),
        help=f"PDF文件所在的目录 (默认: {DEFAULT_DATA_DIR})"
    )

    parser.add_argument(
        "--log-file",
        type=str,
        help=f"日志文件路径 (默认: logs/{LOG_FILE_NAME})"
    )

    parser.add_argument(
        "--log-level",
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help="日志级别 (默认: INFO)"
    )

    parser.add_argument(
        "--no-console",
        action='store_true',
        help="禁用控制台日志输出，仅写入文件"
    )

    parser.add_argument(
        "--version",
        action='version',
        version='PDF文件服务器 v1.0.0'
    )

    return parser


def validate_arguments(args):
    """
    验证命令行参数

    Args:
        args: 解析后的参数对象

    Returns:
        bool: 验证是否通过

    Raises:
        SystemExit: 参数验证失败时退出
    """
    # 验证端口范围
    if not (1 <= args.port <= 65535):
        print(f"错误: 端口号必须在 1-65535 范围内，当前值: {args.port}", file=sys.stderr)
        return False

    # 验证目录
    directory = Path(args.directory)
    if not directory.exists():
        print(f"警告: 目录 {directory} 不存在，将尝试创建")
        try:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"成功创建目录: {directory}")
        except Exception as e:
            print(f"错误: 无法创建目录 {directory}: {e}", file=sys.stderr)
            return False
    elif not directory.is_dir():
        print(f"错误: {directory} 不是一个有效的目录", file=sys.stderr)
        return False

    return True


def main():
    """
    主函数

    解析命令行参数，验证配置，设置日志，启动服务器。
    """
    # 创建参数解析器
    parser = create_parser()
    args = parser.parse_args()

    # 验证参数
    if not validate_arguments(args):
        sys.exit(1)

    # 设置日志
    try:
        setup_logging(
            log_file_path=args.log_file,
            console_output=not args.no_console,
            log_level=args.log_level
        )
    except Exception as e:
        print(f"错误: 日志配置失败: {e}", file=sys.stderr)
        sys.exit(1)

    # 启动服务器
    try:
        print(f"正在启动PDF文件服务器...")
        print(f"端口: {args.port}")
        print(f"目录: {args.directory}")
        print(f"访问地址: http://localhost:{args.port}/pdfs/")
        print(f"健康检查: http://localhost:{args.port}/health")
        print(f"按 Ctrl+C 停止服务器")
        print("-" * 50)

        run_server(
            port=args.port,
            directory=args.directory,
            blocking=True
        )

    except KeyboardInterrupt:
        print("\n服务器已停止")
        sys.exit(0)
    except Exception as e:
        print(f"错误: 服务器启动失败: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()