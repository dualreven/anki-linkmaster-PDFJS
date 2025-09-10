# 验证脚本：导入 pdfjs_logger 并写入 INFO 日志
import time
from src.backend.logging import pdfjs_logger

logger = pdfjs_logger.get_pdfjs_logger()
logger.info("AT001 test log - PDF.js init diagnostic entry")
print("Wrote log entry")