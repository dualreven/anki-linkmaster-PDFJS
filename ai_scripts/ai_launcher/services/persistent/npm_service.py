#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Dict, Any

from ..base_service import BaseService

ANSI_ESCAPE_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


class NpmDevServerService(BaseService):
    def __init__(self, project_root: Path):
        super().__init__("npm-dev-server", project_root)
        self.logger = logging.getLogger("ai-launcher.service.npm-dev")
        self.proc_manager.log_file = self.project_root / "logs" / "npm-dev.log"

    def start(self, config: Dict[str, Any]) -> bool:
        port = config.get("port", 3000)
        command = ["pnpm", "run", "dev", "--", "--port", str(port)]
        cwd = str(self.project_root)

        env = os.environ.copy()
        env.setdefault("NO_COLOR", "1")
        env.setdefault("FORCE_COLOR", "0")
        env.setdefault("CLICOLOR", "0")
        env.setdefault("CLICOLOR_FORCE", "0")
        env.setdefault("VITE_FORCE_COLOR", "0")

        # npm dev 为外部进程，无自带日志文件；本模块负责捕获与写入 logs/npm-dev.log
        result = self.proc_manager.start(command, cwd=cwd, shell=True, check_delay=1.0, env=env, capture_log=True)
        self._sanitize_log()
        if not result:
            log_tail = self.proc_manager.tail_log()
            if log_tail:
                self.logger.error(
                    "Vite dev server failed to start. Check logs/npm-dev.log for details.\n%s",
                    log_tail
                )
            else:
                self.logger.error(
                    "Vite dev server failed to start and produced no output. Expected log at %s",
                    self.proc_manager.log_file
                )
        else:
            self.logger.info(
                "Vite dev server started on port %s (log: %s)",
                port,
                self.proc_manager.log_file
            )
        return result

    def _sanitize_log(self) -> None:
        log_file = self.proc_manager.log_file
        if not log_file.exists():
            return
        try:
            content = log_file.read_text(encoding="utf-8")
            cleaned = ANSI_ESCAPE_RE.sub('', content)
            if cleaned != content:
                log_file.write_text(cleaned, encoding="utf-8")
        except Exception as exc:
            self.logger.warning("Failed to sanitize npm-dev log: %s", exc)
