"""
Anki LinkMaster PDFJS - 应用辅助函数
包含应用使用的各种辅助函数
"""

import logging
import os
import re

# 配置日志
logger = logging.getLogger(__name__)


def get_vite_port():
    r"""
    Docstring for gdef get_vite_port():
    从 logs\npm-dev.log 获取 port
    返回port值
    """
    # 下面这个地址获取不正确
    app_path = os.path.dirname(__file__)
    backend_path = os.path.dirname(app_path)
    src_path = os.path.dirname(backend_path)
    src_path = os.path.dirname(src_path)
    log_file_path = os.path.join(src_path, 'logs', 'npm-dev.log')
    
    try:
        with open(log_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找包含"Local:"的行
        lines = content.split('\n')
        for line in lines:
            if 'Local:' in line and 'localhost:' in line:
                # 提取端口号
                match = re.search(r'localhost:(\d+)', line)
                if match:
                    return int(match.group(1))
        
        # 如果没有找到，返回默认端口3000
        return 3000
    except FileNotFoundError:
        logger.warning(f"npm-dev.log文件未找到: {log_file_path}")
        return 3000
    except Exception as e:
        logger.error(f"读取npm-dev.log文件时出错: {str(e)}")
        return 3000