#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys

# 确保可以从项目根目录导入 ai_log 包
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ai_log.main import main

if __name__ == "__main__":
    main()


