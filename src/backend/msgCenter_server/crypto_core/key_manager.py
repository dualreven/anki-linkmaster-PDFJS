# -*- coding: utf-8 -*-
"""
CryptoKeyManager（独立模块）
- 负责会话密钥的生成、轮换、持久化
"""
from __future__ import annotations

import os
import json
import time
import base64
import logging
import threading
from typing import Dict, Tuple, Optional

from . import aes_gcm as _aes_core

logger = logging.getLogger(__name__)


class CryptoKeyManager:
    """加密密钥管理器（支持24小时自动轮换）"""

    ROTATION_INTERVAL = 24 * 60 * 60  # 24小时（秒）

    def __init__(self, rotation_interval: int = ROTATION_INTERVAL):
        self._session_keys: Dict[str, Tuple[bytes, float]] = {}  # session_id -> (key, creation_time)
        self.rotation_interval = rotation_interval
        self._rotation_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def generate_session_key(self, session_id: str) -> bytes:
        key = _aes_core.generate_key()
        self._session_keys[session_id] = (key, time.time())
        return key

    def get_session_key(self, session_id: str) -> Optional[bytes]:
        if session_id in self._session_keys:
            return self._session_keys[session_id][0]
        return None

    def get_key_age(self, session_id: str) -> Optional[float]:
        if session_id in self._session_keys:
            _, creation_time = self._session_keys[session_id]
            return time.time() - creation_time
        return None

    def remove_session_key(self, session_id: str) -> None:
        self._session_keys.pop(session_id, None)

    def rotate_session_key(self, session_id: str) -> Optional[bytes]:
        if session_id not in self._session_keys:
            return None
        new_key = _aes_core.generate_key()
        self._session_keys[session_id] = (new_key, time.time())
        return new_key

    def _rotation_worker(self):
        while not self._stop_event.is_set():
            try:
                current_time = time.time()
                sessions_to_rotate = []
                for session_id, (_, creation_time) in self._session_keys.items():
                    if current_time - creation_time >= self.rotation_interval:
                        sessions_to_rotate.append(session_id)
                for session_id in sessions_to_rotate:
                    self.rotate_session_key(session_id)
                    logger.info("密钥已自动轮换 - 会话: %s", session_id)
                time.sleep(3600)
            except Exception as e:
                logger.error("密钥轮换线程错误: %s", e)
                time.sleep(60)

    def start_rotation(self):
        if self._rotation_thread is None or not self._rotation_thread.is_alive():
            self._stop_event.clear()
            self._rotation_thread = threading.Thread(target=self._rotation_worker, daemon=True)
            self._rotation_thread.start()
            logger.info("密钥轮换线程已启动")

    def stop_rotation(self):
        self._stop_event.set()
        if self._rotation_thread and self._rotation_thread.is_alive():
            self._rotation_thread.join(timeout=5)
        logger.info("密钥轮换线程已停止")

    def save_keys_to_file(self, filepath: str):
        try:
            keys_data = {
                sid: {"key": base64.b64encode(k).decode("utf-8"), "creation_time": ts}
                for sid, (k, ts) in self._session_keys.items()
            }
            with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                json.dump(keys_data, f, ensure_ascii=False, indent=2)
            logger.info("密钥已保存到: %s", filepath)
        except Exception as e:
            logger.error("保存密钥失败: %s", e)

    def load_keys_from_file(self, filepath: str):
        try:
            if not os.path.exists(filepath):
                logger.warning("密钥文件不存在: %s", filepath)
                return
            with open(filepath, "r", encoding="utf-8") as f:
                keys_data = json.load(f)
            for session_id, key_info in keys_data.items():
                key = base64.b64decode(key_info["key"])
                creation_time = key_info["creation_time"]
                self._session_keys[session_id] = (key, creation_time)
            logger.info("密钥已从文件加载: %s", filepath)
        except Exception as e:
            logger.error("加载密钥失败: %s", e)

