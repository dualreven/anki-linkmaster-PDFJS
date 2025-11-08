# -*- coding: utf-8 -*-
import pytest

from src.backend.msgCenter_server.crypto_core import aes_gcm, hmac_sha256


@pytest.mark.skipif(not aes_gcm.CRYPTO_AVAILABLE, reason=f"cryptography not available: {aes_gcm.get_import_error()}")
def test_aes_gcm_roundtrip():
    key = aes_gcm.generate_key()
    pt = "你好，PDF!".encode("utf-8")
    aad = b"ts=1730540000"
    ct, iv = aes_gcm.encrypt_bytes_gcm(key, pt, aad)
    assert isinstance(ct, (bytes, bytearray))
    assert len(iv) == aes_gcm.IV_SIZE
    rt = aes_gcm.decrypt_bytes_gcm(key, ct, iv, aad)
    assert rt == pt


def test_hmac_compute_and_verify():
    key = hmac_sha256.generate_key()
    data = b"hello"
    mac = hmac_sha256.compute_hmac(data, key)
    assert hmac_sha256.verify_hmac(data, mac, key)
    mac_b64 = hmac_sha256.compute_hmac_base64(data, key)
    assert hmac_sha256.verify_hmac_base64(data, mac_b64, key)
    # 错误的 mac
    assert not hmac_sha256.verify_hmac_base64(data, "ZmFrZQ==", key)

