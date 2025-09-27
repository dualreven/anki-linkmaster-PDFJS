"""
PDF文件服务器模块入口点

当使用 python -m src.backend.pdfFile_server 启动时执行
"""

from .cli.main import main

if __name__ == "__main__":
    main()