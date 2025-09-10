# 验证脚本：将项目根加入 sys.path，导入 pdfjs_logger 并写入 INFO 日志
import sys
import os
# 将项目根加入 sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.backend.logging import pdfjs_logger

logger = pdfjs_logger.get_pdfjs_logger()
logger.info("AT001 test log - PDF.js init diagnostic entry")
print("Wrote log entry to logs/pdfjs-init.log")