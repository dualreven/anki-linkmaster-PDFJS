"""
AES-256-GCM加密算法测试用例
测试加密模块的功能正确性和安全性
"""

import unittest
import json
import base64
from cryptography.exceptions import InvalidTag
from src.backend.websocket.crypto import AESGCMCrypto, CryptoKeyManager, key_manager

class TestAESGCMCrypto(unittest.TestCase):
    """AES-256-GCM加密算法测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.crypto = AESGCMCrypto()
        self.test_message = {
            "type": "test_message",
            "timestamp": 1234567890,
            "data": {"key": "value", "number": 42}
        }
        self.plaintext = b"Hello, this is a test message for AES-GCM encryption!"
    
    def test_key_generation(self):
        """测试密钥生成"""
        key1 = AESGCMCrypto.generate_key()
        key2 = AESGCMCrypto.generate_key()
        
        # 验证密钥长度
        self.assertEqual(len(key1), 32)
        self.assertEqual(len(key2), 32)
        
        # 验证密钥随机性
        self.assertNotEqual(key1, key2)
    
    def test_iv_generation(self):
        """测试IV生成"""
        iv1 = AESGCMCrypto.generate_iv()
        iv2 = AESGCMCrypto.generate_iv()
        
        # 验证IV长度
        self.assertEqual(len(iv1), 12)
        self.assertEqual(len(iv2), 12)
        
        # 验证IV随机性
        self.assertNotEqual(iv1, iv2)
    
    def test_encrypt_decrypt_bytes(self):
        """测试字节数据的加密和解密"""
        # 加密
        ciphertext, iv = self.crypto.encrypt(self.plaintext)
        
        # 验证输出格式
        self.assertIsInstance(ciphertext, bytes)
        self.assertIsInstance(iv, bytes)
        self.assertEqual(len(iv), 12)
        
        # 解密
        decrypted = self.crypto.decrypt(ciphertext, iv, b'')
        
        # 验证解密结果
        self.assertEqual(decrypted, self.plaintext)
    
    def test_encrypt_decrypt_with_ad(self):
        """测试带关联数据的加密和解密"""
        associated_data = b"additional authentication data"
        
        # 加密
        ciphertext, iv = self.crypto.encrypt(self.plaintext, associated_data)
        
        # 解密（使用正确的关联数据）
        decrypted = self.crypto.decrypt(ciphertext, iv, associated_data)
        self.assertEqual(decrypted, self.plaintext)
        
        # 测试关联数据验证失败
        wrong_ad = b"wrong authentication data"
        with self.assertRaises(InvalidTag):
            self.crypto.decrypt(ciphertext, iv, wrong_ad)
    
    def test_encrypt_decrypt_message(self):
        """测试JSON消息的加密和解密"""
        # 加密消息
        encrypted_msg = self.crypto.encrypt_message(self.test_message)
        
        # 验证加密消息格式
        self.assertTrue(encrypted_msg['encrypted'])
        self.assertIn('iv', encrypted_msg)
        self.assertIn('ciphertext', encrypted_msg)
        self.assertIn('timestamp', encrypted_msg)
        
        # 解密消息
        decrypted_msg = self.crypto.decrypt_message(encrypted_msg)
        
        # 验证解密结果
        self.assertEqual(decrypted_msg, self.test_message)
    
    def test_message_tampering_detection(self):
        """测试消息篡改检测"""
        # 加密消息
        encrypted_msg = self.crypto.encrypt_message(self.test_message)
        
        # 篡改密文
        tampered_ciphertext = base64.b64decode(encrypted_msg['ciphertext'])
        tampered_ciphertext = tampered_ciphertext[:-1] + bytes([tampered_ciphertext[-1] ^ 0x01])
        encrypted_msg['ciphertext'] = base64.b64encode(tampered_ciphertext).decode('utf-8')
        
        # 验证篡改检测
        with self.assertRaises(InvalidTag):
            self.crypto.decrypt_message(encrypted_msg)
    
    def test_timestamp_tampering_detection(self):
        """测试时间戳篡改检测"""
        # 加密消息
        encrypted_msg = self.crypto.encrypt_message(self.test_message)
        
        # 篡改时间戳
        encrypted_msg['timestamp'] = 9999999999
        
        # 验证篡改检测
        with self.assertRaises(InvalidTag):
            self.crypto.decrypt_message(encrypted_msg)
    
    def test_invalid_message_format(self):
        """测试无效消息格式"""
        # 测试未加密消息
        with self.assertRaises(ValueError):
            self.crypto.decrypt_message({"encrypted": False})
        
        # 测试缺少必需字段
        with self.assertRaises(ValueError):
            self.crypto.decrypt_message({"encrypted": True})
    
    def test_different_keys_security(self):
        """测试不同密钥的安全性"""
        # 使用不同密钥的加密器
        crypto2 = AESGCMCrypto()
        
        # 使用crypto1加密
        ciphertext, iv = self.crypto.encrypt(self.plaintext)
        
        # 使用crypto2解密应该失败
        with self.assertRaises(InvalidTag):
            crypto2.decrypt(ciphertext, iv, b'')
    
    def test_key_rotation(self):
        """测试密钥轮换"""
        crypto1 = AESGCMCrypto(b'\x00' * 32)  # 固定密钥
        crypto2 = AESGCMCrypto(b'\x01' * 32)   # 不同密钥
        
        # 使用crypto1加密
        ciphertext, iv = crypto1.encrypt(self.plaintext)
        
        # 使用crypto1解密应该成功
        decrypted = crypto1.decrypt(ciphertext, iv, b'')
        self.assertEqual(decrypted, self.plaintext)
        
        # 使用crypto2解密应该失败（模拟密钥轮换）
        with self.assertRaises(InvalidTag):
            crypto2.decrypt(ciphertext, iv, b'')

class TestCryptoKeyManager(unittest.TestCase):
    """加密密钥管理器测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.manager = CryptoKeyManager()
        self.session_id = "test_session_123"
    
    def test_generate_session_key(self):
        """测试会话密钥生成"""
        key = self.manager.generate_session_key(self.session_id)
        
        # 验证密钥格式
        self.assertIsInstance(key, bytes)
        self.assertEqual(len(key), 32)
        
        # 验证密钥存储
        stored_key = self.manager.get_session_key(self.session_id)
        self.assertEqual(key, stored_key)
    
    def test_get_nonexistent_session_key(self):
        """测试获取不存在的会话密钥"""
        key = self.manager.get_session_key("nonexistent_session")
        self.assertIsNone(key)
    
    def test_remove_session_key(self):
        """测试移除会话密钥"""
        key = self.manager.generate_session_key(self.session_id)
        self.manager.remove_session_key(self.session_id)
        
        # 验证密钥已移除
        stored_key = self.manager.get_session_key(self.session_id)
        self.assertIsNone(stored_key)
    
    def test_rotate_session_key(self):
        """测试会话密钥轮换"""
        old_key = self.manager.generate_session_key(self.session_id)
        new_key = self.manager.rotate_session_key(self.session_id)
        
        # 验证密钥已更新
        self.assertNotEqual(old_key, new_key)
        
        # 验证存储的是新密钥
        stored_key = self.manager.get_session_key(self.session_id)
        self.assertEqual(new_key, stored_key)

class TestSecurityProperties(unittest.TestCase):
    """安全性属性测试类"""
    
    def test_deterministic_encryption(self):
        """测试加密的非确定性（相同明文不同密文）"""
        crypto = AESGCMCrypto()
        plaintext = b"repeated test message"
        
        # 多次加密相同明文
        ciphertext1, iv1 = crypto.encrypt(plaintext)
        ciphertext2, iv2 = crypto.encrypt(plaintext)
        
        # 验证每次加密结果都不同
        self.assertNotEqual(ciphertext1, ciphertext2)
        self.assertNotEqual(iv1, iv2)
        
        # 但解密结果应该相同
        decrypted1 = crypto.decrypt(ciphertext1, iv1, b'')
        decrypted2 = crypto.decrypt(ciphertext2, iv2, b'')
        self.assertEqual(decrypted1, decrypted2)
        self.assertEqual(decrypted1, plaintext)
    
    def test_confidentiality(self):
        """测试机密性（密文不应泄露明文信息）"""
        crypto = AESGCMCrypto()
        plaintext1 = b"sensitive information: password123456"
        plaintext2 = b"another sensitive information"
        
        ciphertext1, iv1 = crypto.encrypt(plaintext1)
        ciphertext2, iv2 = crypto.encrypt(plaintext2)
        
        # 验证密文不包含明文信息
        self.assertNotIn(b"password", ciphertext1)
        self.assertNotIn(b"sensitive", ciphertext1)
        self.assertNotIn(b"password", ciphertext2)
        self.assertNotIn(b"sensitive", ciphertext2)
    
    def test_integrity_protection(self):
        """测试完整性保护"""
        crypto = AESGCMCrypto()
        plaintext = b"important data cannot be tampered"
        
        ciphertext, iv = crypto.encrypt(plaintext)
        
        # 篡改密文的一个字节
        tampered_ciphertext = ciphertext[:-1] + bytes([ciphertext[-1] ^ 0x01])
        
        # 验证篡改被检测到
        with self.assertRaises(InvalidTag):
            crypto.decrypt(tampered_ciphertext, iv, b'')

if __name__ == '__main__':
    unittest.main()