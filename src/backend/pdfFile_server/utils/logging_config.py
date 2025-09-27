"""
PDF文件服务器日志配置工具

提供统一的日志配置功能，支持文件和控制台输出。
遵循项目的UTF-8编码和覆盖模式要求。
"""

import logging
from pathlib import Path
from ..config.settings import (
    LOG_LEVEL, LOG_FORMAT, LOG_ENCODING,
    LOG_FILE_MODE, DEFAULT_LOG_DIR
)


def setup_logging(log_file_path=None, console_output=True, log_level=None):
    """
    配置日志记录器

    Args:
        log_file_path (str|Path, optional): 日志文件路径，默认使用配置中的路径
        console_output (bool): 是否同时输出到控制台，默认True
        log_level (str, optional): 日志级别，默认使用配置中的级别

    Returns:
        logging.Logger: 配置好的日志记录器
    """
    # 确定日志文件路径
    if log_file_path is None:
        log_file_path = DEFAULT_LOG_DIR / "pdf-server.log"
    else:
        log_file_path = Path(log_file_path)

    # 确保日志目录存在
    log_file_path.parent.mkdir(parents=True, exist_ok=True)

    # 确定日志级别
    if log_level is None:
        log_level = LOG_LEVEL

    # 配置根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # 清除现有的处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # 创建格式化器
    formatter = logging.Formatter(LOG_FORMAT)

    # 添加文件处理器
    file_handler = logging.FileHandler(
        log_file_path,
        mode=LOG_FILE_MODE,
        encoding=LOG_ENCODING
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # 添加控制台处理器
    if console_output:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # 获取模块特定的日志记录器
    logger = logging.getLogger('pdfFile_server')
    logger.info("日志系统初始化完成")
    logger.info(f"日志文件: {log_file_path}")
    logger.info(f"日志级别: {log_level}")

    return logger


def get_logger(name=None):
    """
    获取日志记录器实例

    Args:
        name (str, optional): 日志记录器名称，默认为模块名

    Returns:
        logging.Logger: 日志记录器实例
    """
    if name is None:
        name = 'pdfFile_server'
    return logging.getLogger(name)