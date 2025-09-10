# pdfjs_logger.py
# Provides get_pdfjs_logger() for backend modules to log PDF.js init diagnostics.
# Uses Python logging with TimedRotatingFileHandler to rotate daily and keep 7 days.

import logging
from logging.handlers import TimedRotatingFileHandler
import os

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', '..', 'logs')
# normalize path: src/backend/logging -> src/backend/logging/../../logs -> src/logs? keep project root logs
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'logs'))
LOG_FILE = os.path.join(LOG_DIR, 'pdfjs-init.log')

def ensure_log_dir():
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
    except Exception:
        # best-effort; let handler fail later if necessary
        pass

def get_pdfjs_logger(name='pdfjs'):
    """
    Return a logger configured to write PDF.js init diagnostics to logs/pdfjs-init.log,
    rotated daily, keeping 7 days.
    Usage:
        logger = get_pdfjs_logger()
        logger.info("PDF.js initialized ...")
    """
    ensure_log_dir()

    logger = logging.getLogger(name)
    if getattr(logger, '_pdfjs_configured', False):
        return logger

    logger.setLevel(logging.INFO)
    # Prevent adding multiple handlers if called multiple times
    handler = TimedRotatingFileHandler(LOG_FILE, when='midnight', interval=1, backupCount=7, encoding='utf-8')
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
    handler.setFormatter(formatter)
    handler.suffix = "%Y-%m-%d"
    logger.addHandler(handler)
    logger.propagate = False
    logger._pdfjs_configured = True
    return logger