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

# Lazily handle optional cryptography dependency to avoid startup ImportError
try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    from cryptography.exceptions import InvalidTag  # type: ignore
    CRYPTO_AVAILABLE = True
    _CRYPTO_IMPORT_ERROR: Optional[str] = None
except Exception as _e:  # pragma: no cover - only triggers on missing/wrong wheels
    CRYPTO_AVAILABLE = False
    _CRYPTO_IMPORT_ERROR = str(_e)
    class InvalidTag(Exception):  # fallback placeholder
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
            raise ImportError(
                "加密功能不可用：cryptography 未安装或加载失败。"
                f" 原因: {_CRYPTO_IMPORT_ERROR or 'unknown'}"
            )
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
        return os.urandom(AESGCMCrypto.KEY_SIZE)
    
    @staticmethod
    def generate_iv() -> bytes:
        """
        生成随机的初始化向量(IV)
        
        Returns:
            bytes: 12字节的随机IV
        """
        return os.urandom(AESGCMCrypto.IV_SIZE)
    
    def encrypt(self, plaintext: bytes, associated_data: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        """
        使用AES-256-GCM加密数据
        
        Args:
            plaintext: 明文数据
            associated_data: 关联数据（用于认证但不加密）
            
        Returns:
            Tuple[bytes, bytes]: (密文, IV)
        """
        # 生成随机IV
        iv = self.generate_iv()
        
        # 创建加密器
        cipher = Cipher(
            algorithms.AES(self._secret_key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # 添加关联数据（如果提供）
        if associated_data:
            encryptor.authenticate_additional_data(associated_data)
        
        # 加密数据
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()
        
        # 获取认证标签并附加到密文末尾
        tag = encryptor.tag
        ciphertext_with_tag = ciphertext + tag
        
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
        # 分离密文和认证标签（GCM模式认证标签附加在密文末尾）
        actual_ciphertext = ciphertext[:-self.TAG_SIZE]
        tag = ciphertext[-self.TAG_SIZE:]
        
        # 创建解密器
        cipher = Cipher(
            algorithms.AES(self._secret_key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # 添加关联数据（如果提供）
        if associated_data:
            decryptor.authenticate_additional_data(associated_data)
        
        # 解密数据
        plaintext = decryptor.update(actual_ciphertext) + decryptor.finalize()
        
        return plaintext
    
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

class CryptoKeyManager:
    """加密密钥管理器（支持24小时自动轮换）"""
    
    ROTATION_INTERVAL = 24 * 60 * 60  # 24小时（秒）
    
    def __init__(self, rotation_interval: int = ROTATION_INTERVAL):
        """
        初始化加密密钥管理器
        
        Args:
            rotation_interval: 密钥轮换间隔（秒），默认24小时
        """
        self._session_keys: Dict[str, Tuple[bytes, float]] = {}  # session_id -> (key, creation_time)
        self.rotation_interval = rotation_interval
        self._rotation_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
    
    def generate_session_key(self, session_id: str) -> bytes:
        """
        为会话生成加密密钥并记录创建时间
        
        Args:
            session_id: 会话ID
            
        Returns:
            bytes: 生成的加密密钥
        """
        key = AESGCMCrypto.generate_key()
        self._session_keys[session_id] = (key, time.time())
        return key
    
    def get_session_key(self, session_id: str) -> Optional[bytes]:
        """
        获取会话的加密密钥
        
        Args:
            session_id: 会话ID
            
        Returns:
            Optional[bytes]: 加密密钥，如果不存在则返回None
        """
        if session_id in self._session_keys:
            return self._session_keys[session_id][0]
        return None
    
    def get_key_age(self, session_id: str) -> Optional[float]:
        """
        获取密钥的使用时长（秒）
        
        Args:
            session_id: 会话ID
            
        Returns:
            Optional[float]: 密钥使用时长（秒），如果密钥不存在则返回None
        """
        if session_id in self._session_keys:
            _, creation_time = self._session_keys[session_id]
            return time.time() - creation_time
        return None
    
    def remove_session_key(self, session_id: str) -> None:
        """
        移除会话的加密密钥
        
        Args:
            session_id: 会话ID
        """
        self._session_keys.pop(session_id, None)
    
    def rotate_session_key(self, session_id: str) -> Optional[bytes]:
        """
        轮换会话的加密密钥
        
        Args:
            session_id: 会话ID
            
        Returns:
            Optional[bytes]: 新的加密密钥，如果会话不存在则返回None
        """
        if session_id not in self._session_keys:
            return None
        
        new_key = AESGCMCrypto.generate_key()
        self._session_keys[session_id] = (new_key, time.time())
        return new_key
    
    def _rotation_worker(self):
        """密钥轮换工作线程"""
        while not self._stop_event.is_set():
            try:
                current_time = time.time()
                sessions_to_rotate = []
                
                # 检查所有会话密钥是否需要轮换
                for session_id, (key, creation_time) in self._session_keys.items():
                    key_age = current_time - creation_time
                    if key_age >= self.rotation_interval:
                        sessions_to_rotate.append(session_id)
                
                # 轮换过期的密钥
                for session_id in sessions_to_rotate:
                    self.rotate_session_key(session_id)
                    logger.info(f"密钥已自动轮换 - 会话: {session_id}")
                
                # 每小时检查一次
                time.sleep(3600)
                
            except Exception as e:
                logger.error(f"密钥轮换线程错误: {e}")
                time.sleep(60)  # 出错后等待1分钟再重试
    
    def start_rotation(self):
        """启动密钥轮换线程"""
        if self._rotation_thread is None or not self._rotation_thread.is_alive():
            self._stop_event.clear()
            self._rotation_thread = threading.Thread(target=self._rotation_worker, daemon=True)
            self._rotation_thread.start()
            logger.info("密钥轮换线程已启动")
    
    def stop_rotation(self):
        """停止密钥轮换线程"""
        self._stop_event.set()
        if self._rotation_thread and self._rotation_thread.is_alive():
            self._rotation_thread.join(timeout=5)
        logger.info("密钥轮换线程已停止")
    
    def save_keys_to_file(self, filepath: str):
        """
        将会话密钥保存到文件（用于持久化存储）
        
        Args:
            filepath: 文件路径
        """
        try:
            keys_data = {}
            for session_id, (key, creation_time) in self._session_keys.items():
                keys_data[session_id] = {
                    'key': base64.b64encode(key).decode('utf-8'),
                    'creation_time': creation_time
                }
            
            with open(filepath, 'w') as f:
                json.dump(keys_data, f, indent=2)
            
            logger.info(f"密钥已保存到: {filepath}")
            
        except Exception as e:
            logger.error(f"保存密钥失败: {e}")
    
    def load_keys_from_file(self, filepath: str):
        """
        从文件加载会话密钥
        
        Args:
            filepath: 文件路径
        """
        try:
            if not os.path.exists(filepath):
                logger.warning(f"密钥文件不存在: {filepath}")
                return
            
            with open(filepath, 'r') as f:
                keys_data = json.load(f)
            
            for session_id, key_info in keys_data.items():
                key = base64.b64decode(key_info['key'])
                creation_time = key_info['creation_time']
                self._session_keys[session_id] = (key, creation_time)
            
            logger.info(f"密钥已从文件加载: {filepath}")
            
        except Exception as e:
            logger.error(f"加载密钥失败: {e}")

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
        return os.urandom(HMACVerifier.HMAC_KEY_SIZE)
    
    def compute_hmac(self, data: bytes) -> bytes:
        """
        计算数据的HMAC-SHA256签名

        Args:
            data: 要计算HMAC的数据

        Returns:
            bytes: HMAC-SHA256签名（32字节）
        """
        return std_hmac.new(
            self._hmac_key,
            data,
            hashlib.sha256
        ).digest()
    
    def compute_hmac_base64(self, data: bytes) -> str:
        """
        计算数据的HMAC-SHA256签名（Base64编码）
        
        Args:
            data: 要计算HMAC的数据
            
        Returns:
            str: Base64编码的HMAC签名
        """
        hmac_signature = self.compute_hmac(data)
        return base64.b64encode(hmac_signature).decode('utf-8')
    
    def verify_hmac(self, data: bytes, expected_hmac: bytes) -> bool:
        """
        验证数据的HMAC签名

        Args:
            data: 要验证的数据
            expected_hmac: 预期的HMAC签名

        Returns:
            bool: 验证是否成功
        """
        actual_hmac = self.compute_hmac(data)
        return std_hmac.compare_digest(actual_hmac, expected_hmac)
    
    def verify_hmac_base64(self, data: bytes, expected_hmac_base64: str) -> bool:
        """
        验证数据的HMAC签名（Base64编码输入）
        
        Args:
            data: 要验证的数据
            expected_hmac_base64: Base64编码的预期HMAC签名
            
        Returns:
            bool: 验证是否成功
        """
        try:
            expected_hmac = base64.b64decode(expected_hmac_base64)
            return self.verify_hmac(data, expected_hmac)
        except (ValueError, TypeError):
            return False

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