# -*- coding: utf-8 -*-
"""
AES-GCM 核心（纯函数）
- 严格依赖 cryptography；未安装时，通过 CRYPTO_AVAILABLE 暴露能力
"""
from __future__ import annotations

from typing import Optional, Tuple
import os

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    from cryptography.exceptions import InvalidTag  # type: ignore
    CRYPTO_AVAILABLE = True
    _CRYPTO_IMPORT_ERROR: Optional[str] = None
except Exception as _e:  # pragma: no cover
    CRYPTO_AVAILABLE = False
    _CRYPTO_IMPORT_ERROR = str(_e)

KEY_SIZE = 32  # AES-256
IV_SIZE = 12   # GCM 推荐 96-bit
TAG_SIZE = 16  # 128-bit tag


def get_import_error() -> Optional[str]:
    return _CRYPTO_IMPORT_ERROR


def generate_key() -> bytes:
    return os.urandom(KEY_SIZE)


def generate_iv() -> bytes:
    return os.urandom(IV_SIZE)


def encrypt_bytes_gcm(key: bytes, plaintext: bytes, aad: Optional[bytes] = None) -> Tuple[bytes, bytes]:
    """
    返回 (ciphertext_with_tag, iv)
    """
    if not CRYPTO_AVAILABLE:
        raise ImportError(f"cryptography 未安装或加载失败: {_CRYPTO_IMPORT_ERROR or 'unknown'}")
    iv = generate_iv()
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
    enc = cipher.encryptor()
    if aad:
        enc.authenticate_additional_data(aad)
    ct = enc.update(plaintext) + enc.finalize()
    return ct + enc.tag, iv


def decrypt_bytes_gcm(key: bytes, ciphertext_with_tag: bytes, iv: bytes, aad: Optional[bytes] = None) -> bytes:
    """
    输入附带 tag 的密文；返回明文
    """
    if not CRYPTO_AVAILABLE:
        raise ImportError(f"cryptography 未安装或加载失败: {_CRYPTO_IMPORT_ERROR or 'unknown'}")
    tag = ciphertext_with_tag[-TAG_SIZE:]
    ct = ciphertext_with_tag[:-TAG_SIZE]
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
    dec = cipher.decryptor()
    if aad:
        dec.authenticate_additional_data(aad)
    return dec.update(ct) + dec.finalize()

