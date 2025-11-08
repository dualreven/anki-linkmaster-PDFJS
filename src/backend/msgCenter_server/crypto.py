"""
WebSocket通信加密模块
实现AES-256-GCM加密算法，用于WebSocket消息的安全传输
"""

import os
import base64
import json
import logging
import time
import threading
import hashlib
import hmac as std_hmac
from typing import Optional, Tuple, Dict, Any

# 依赖核心纯函数模块，避免入口文件过胖
from src.backend.msgCenter_server.crypto_core import aes_gcm as _aes_core
from src.backend.msgCenter_server.crypto_core import hmac_sha256 as _hmac_core

# Lazily expose capability flags similar to old behavior
CRYPTO_AVAILABLE: bool = _aes_core.CRYPTO_AVAILABLE
try:
    # 仅在可用时引入具体异常类型，便于上层捕获
    from cryptography.exceptions import InvalidTag  # type: ignore
except Exception:  # pragma: no cover
    class InvalidTag(Exception):
        pass

logger = logging.getLogger(__name__)

class AESGCMCrypto:
    """AES-256-GCM加密算法实现类"""
    
    # AES-256密钥长度（32字节）
    KEY_SIZE = 32
    # GCM认证标签长度（16字节）
    TAG_SIZE = 16
    # IV（初始化向量）长度（12字节，推荐用于GCM模式）
    IV_SIZE = 12
    
    def __init__(self, secret_key: Optional[bytes] = None):
        """
        初始化加密器
        
        Args:
            secret_key: 加密密钥（32字节），如果为None则自动生成
        """
        if not CRYPTO_AVAILABLE:
            raise ImportError("加密功能不可用：cryptography 未安装或加载失败。"
                              f" 原因: {_aes_core.get_import_error() or 'unknown'}")
        if secret_key is None:
            self._secret_key = self.generate_key()
        else:
            if len(secret_key) != self.KEY_SIZE:
                raise ValueError(f"密钥长度必须为{self.KEY_SIZE}字节")
            self._secret_key = secret_key
    
    @property
    def secret_key(self) -> bytes:
        """获取加密密钥"""
        return self._secret_key
    
    @staticmethod
    def generate_key() -> bytes:
        """
        生成随机的AES-256密钥
        
        Returns:
            bytes: 32字节的随机密钥
        """
        return _aes_core.generate_key()
    
    @staticmethod
    def generate_iv() -> bytes:
        """
        生成随机的初始化向量(IV)
        
        Returns:
            bytes: 12字节的随机IV
        """
        return _aes_core.generate_iv()
    
    def encrypt(self, plaintext: bytes, associated_data: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        """
        使用AES-256-GCM加密数据
        
        Args:
            plaintext: 明文数据
            associated_data: 关联数据（用于认证但不加密）
            
        Returns:
            Tuple[bytes, bytes]: (密文, IV)
        """
        ciphertext_with_tag, iv = _aes_core.encrypt_bytes_gcm(self._secret_key, plaintext, associated_data)
        return ciphertext_with_tag, iv
    
    def decrypt(self, ciphertext: bytes, iv: bytes, associated_data: Optional[bytes] = None) -> bytes:
        """
        使用AES-256-GCM解密数据
        
        Args:
            ciphertext: 密文数据（包含认证标签）
            iv: 初始化向量
            associated_data: 关联数据
            
        Returns:
            bytes: 解密后的明文
            
        Raises:
            InvalidTag: 如果认证失败
        """
        return _aes_core.decrypt_bytes_gcm(self._secret_key, ciphertext, iv, associated_data)
    
    def encrypt_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        加密JSON消息
        
        Args:
            message: 要加密的消息字典
            
        Returns:
            Dict[str, Any]: 包含加密数据和HMAC签名的消息
        """
        # 序列化消息为JSON字符串
        plaintext = json.dumps(message, ensure_ascii=False).encode('utf-8')
        
        # 使用时间戳作为关联数据
        timestamp = str(message.get('timestamp', 0)).encode('utf-8')
        
        # 加密数据
        ciphertext, iv = self.encrypt(plaintext, timestamp)
        
        # 构建加密消息
        encrypted_message = {
            'encrypted': True,
            'iv': base64.b64encode(iv).decode('utf-8'),
            'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
            'timestamp': message.get('timestamp', 0)
        }
        
        return encrypted_message
    
    def encrypt_message_with_hmac(self, message: Dict[str, Any], hmac_verifier: 'HMACVerifier') -> Dict[str, Any]:
        """
        加密JSON消息并添加HMAC签名
        
        Args:
            message: 要加密的消息字典
            hmac_verifier: HMAC验证器实例
            
        Returns:
            Dict[str, Any]: 包含加密数据和HMAC签名的消息
        """
        # 序列化原始消息
        plaintext = json.dumps(message, ensure_ascii=False).encode('utf-8')
        
        # 计算原始消息的HMAC（在加密前验证完整性）
        hmac_signature = hmac_verifier.compute_hmac_base64(plaintext)
        
        # 使用AES加密消息
        encrypted_message = self.encrypt_message(message)
        
        # 添加HMAC签名到加密消息
        encrypted_message['hmac'] = hmac_signature
        encrypted_message['hmac_verified'] = True
        
        return encrypted_message
    
    def decrypt_message(self, encrypted_message: Dict[str, Any]) -> Dict[str, Any]:
        """
        解密JSON消息
        
        Args:
            encrypted_message: 加密的消息字典
            
        Returns:
            Dict[str, Any]: 解密后的消息字典
            
        Raises:
            ValueError: 如果消息格式无效
            InvalidTag: 如果认证失败
        """
        if not encrypted_message.get('encrypted'):
            raise ValueError("消息未加密")
        
        # 解码Base64数据
        try:
            iv = base64.b64decode(encrypted_message['iv'])
            ciphertext = base64.b64decode(encrypted_message['ciphertext'])
        except (KeyError, ValueError) as e:
            raise ValueError(f"无效的加密消息格式: {e}")
        
        # 使用时间戳作为关联数据
        timestamp = str(encrypted_message.get('timestamp', 0)).encode('utf-8')
        
        # 解密数据（GCM模式会自动验证认证标签）
        plaintext = self.decrypt(ciphertext, iv, timestamp)
        
        # 解析JSON消息
        try:
            message = json.loads(plaintext.decode('utf-8'))
        except json.JSONDecodeError as e:
            raise ValueError(f"解密后的消息不是有效的JSON: {e}")
        
        return message
    
    def decrypt_message_with_hmac(self, encrypted_message: Dict[str, Any], hmac_verifier: 'HMACVerifier') -> Dict[str, Any]:
        """
        验证HMAC签名并解密消息
        
        Args:
            encrypted_message: 包含加密数据和HMAC签名的消息
            hmac_verifier: HMAC验证器实例
            
        Returns:
            Dict[str, Any]: 解密后的消息字典
            
        Raises:
            ValueError: 如果HMAC验证失败或消息格式无效
        """
        # 检查必要的字段
        if 'hmac' not in encrypted_message:
            raise ValueError("消息缺少HMAC签名")
        
        # 先解密消息获取原始数据
        try:
            decrypted_message = self.decrypt_message(encrypted_message)
        except Exception as e:
            raise ValueError(f"解密失败: {e}")
        
        # 序列化解密后的消息用于HMAC验证
        decrypted_plaintext = json.dumps(decrypted_message, ensure_ascii=False).encode('utf-8')
        
        # 验证HMAC签名
        hmac_signature = encrypted_message['hmac']
        if not hmac_verifier.verify_hmac_base64(decrypted_plaintext, hmac_signature):
            raise ValueError("HMAC签名验证失败 - 消息可能被篡改")
        
        # 添加验证状态
        decrypted_message['hmac_verified'] = True
        
        return decrypted_message

from src.backend.msgCenter_server.crypto_core.key_manager import CryptoKeyManager

class HMACVerifier:
    """HMAC-SHA256验证器类"""
    
    # HMAC密钥长度（建议32字节，与AES-256密钥长度一致）
    HMAC_KEY_SIZE = 32
    
    def __init__(self, hmac_key: Optional[bytes] = None):
        """
        初始化HMAC验证器
        
        Args:
            hmac_key: HMAC密钥，如果为None则自动生成
        """
        if hmac_key is None:
            self._hmac_key = self.generate_key()
        else:
            if len(hmac_key) != self.HMAC_KEY_SIZE:
                raise ValueError(f"HMAC密钥长度必须为{self.HMAC_KEY_SIZE}字节")
            self._hmac_key = hmac_key
    
    @property
    def hmac_key(self) -> bytes:
        """获取HMAC密钥"""
        return self._hmac_key
    
    @staticmethod
    def generate_key() -> bytes:
        """
        生成随机的HMAC密钥
        
        Returns:
            bytes: 32字节的随机HMAC密钥
        """
        return _hmac_core.generate_key()
    
    def compute_hmac(self, data: bytes) -> bytes:
        """
        计算数据的HMAC-SHA256签名

        Args:
            data: 要计算HMAC的数据

        Returns:
            bytes: HMAC-SHA256签名（32字节）
        """
        return _hmac_core.compute_hmac(data, self._hmac_key)
    
    def compute_hmac_base64(self, data: bytes) -> str:
        """
        计算数据的HMAC-SHA256签名（Base64编码）
        
        Args:
            data: 要计算HMAC的数据
            
        Returns:
            str: Base64编码的HMAC签名
        """
        return _hmac_core.compute_hmac_base64(data, self._hmac_key)
    
    def verify_hmac(self, data: bytes, expected_hmac: bytes) -> bool:
        """
        验证数据的HMAC签名

        Args:
            data: 要验证的数据
            expected_hmac: 预期的HMAC签名

        Returns:
            bool: 验证是否成功
        """
        return _hmac_core.verify_hmac(data, expected_hmac, self._hmac_key)
    
    def verify_hmac_base64(self, data: bytes, expected_hmac_base64: str) -> bool:
        """
        验证数据的HMAC签名（Base64编码输入）
        
        Args:
            data: 要验证的数据
            expected_hmac_base64: Base64编码的预期HMAC签名
            
        Returns:
            bool: 验证是否成功
        """
        return _hmac_core.verify_hmac_base64(data, expected_hmac_base64, self._hmac_key)

# 全局密钥管理器实例（启用24小时自动轮换）
key_manager = CryptoKeyManager()

def get_crypto_for_session(session_id: str) -> Optional[AESGCMCrypto]:
    """
    为指定会话获取AESGCMCrypto实例

    Args:
        session_id: 会话ID

    Returns:
        Optional[AESGCMCrypto]: 如果会话存在则返回加密器实例，否则返回None
    """
    session_key = key_manager.get_session_key(session_id)
    if session_key is None:
        return None
    return AESGCMCrypto(session_key)

