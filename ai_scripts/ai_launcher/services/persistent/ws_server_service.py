#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, Any

from ..base_service import BaseService


class WsServerService(BaseService):
    def __init__(self, project_root: Path):
        super().__init__("ws-server", project_root)

    def start(self, config: Dict[str, Any]) -> bool:
        port = config.get("port", 8765)
        
        # Run as a module from the project root to fix import paths
        module_path = "src.backend.msgCenter_server.standard_server"
        
        argv = [sys.executable, "-m", module_path, "--port", str(port)]
        
        # 服务自身在进程内写入 logs/ws-server.log；ai-launcher 不再捕获其输出
        return self.proc_manager.start(argv, capture_log=False)
