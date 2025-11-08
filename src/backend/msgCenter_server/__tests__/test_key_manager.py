# -*- coding: utf-8 -*-
from pathlib import Path

from src.backend.msgCenter_server.crypto_core.key_manager import CryptoKeyManager


def test_key_manager_save_and_load(tmp_path: Path):
    km = CryptoKeyManager()
    k1 = km.generate_session_key("s1")
    k2 = km.generate_session_key("s2")
    fp = tmp_path / "keys.json"
    km.save_keys_to_file(str(fp))
    assert fp.exists()
    # 重新加载到新实例
    km2 = CryptoKeyManager()
    km2.load_keys_from_file(str(fp))
    assert km2.get_session_key("s1") == k1
    assert km2.get_session_key("s2") == k2

