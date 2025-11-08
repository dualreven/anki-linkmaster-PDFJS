# -*- coding: utf-8 -*-
import pytest

from src.backend.msgCenter_server.crypto import AESGCMCrypto, HMACVerifier, CRYPTO_AVAILABLE
from src.backend.msgCenter_server.crypto_core import aes_gcm


@pytest.mark.skipif(not CRYPTO_AVAILABLE or not aes_gcm.CRYPTO_AVAILABLE, reason="cryptography not available")
def test_encrypt_decrypt_message_with_hmac_roundtrip():
    msg = {
        "type": "ping",
        "payload": {"x": 1, "y": "z"},
        "timestamp": 1730540000,
    }
    aes = AESGCMCrypto()  # 随机 key
    hv = HMACVerifier()   # 随机 hmac key
    enc = aes.encrypt_message_with_hmac(msg, hv)
    assert enc.get("encrypted") is True and "ciphertext" in enc and "hmac" in enc
    dec = aes.decrypt_message_with_hmac(enc, hv)
    assert dec["type"] == msg["type"]
    assert dec["payload"] == msg["payload"]
    assert dec["timestamp"] == msg["timestamp"]
    assert dec.get("hmac_verified") is True

