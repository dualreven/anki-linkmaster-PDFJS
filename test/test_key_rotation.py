"""
24小时密钥轮换机制测试用例
测试密钥自动轮换功能和安全属性
"""

import unittest
import time
import threading
from unittest.mock import patch, MagicMock
from src.backend.websocket.crypto import CryptoKeyManager, key_manager, AESGCMCrypto

class TestKeyRotation(unittest.TestCase):
    """密钥轮换功能测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.manager = CryptoKeyManager()
        self.session_id = "test_session_rotation_123"
        
    def test_key_rotation_basic(self):
        """测试基本密钥轮换功能"""
        # 生成初始密钥
        initial_key = self.manager.generate_session_key(self.session_id)
        
        # 轮换密钥
        new_key = self.manager.rotate_session_key(self.session_id)
        
        # 验证密钥已更新
        self.assertNotEqual(initial_key, new_key)
        
        # 验证存储的是新密钥
        stored_key = self.manager.get_session_key(self.session_id)
        self.assertEqual(new_key, stored_key)
    
    def test_key_age_tracking(self):
        """测试密钥年龄跟踪"""
        # 生成密钥
        self.manager.generate_session_key(self.session_id)
        
        # 获取密钥年龄
        age = self.manager.get_key_age(self.session_id)
        self.assertIsNotNone(age)
        self.assertGreaterEqual(age, 0)
        
        # 等待一段时间后再次检查
        time.sleep(0.1)
        new_age = self.manager.get_key_age(self.session_id)
        self.assertGreater(new_age, age)
    
    def test_auto_rotation_thread(self):
        """测试自动轮换线程"""
        # 创建测试管理器（使用较短的轮换间隔）
        test_manager = CryptoKeyManager(rotation_interval=2)  # 2秒用于测试
        
        # 生成密钥
        session_id = "auto_rotation_test"
        initial_key = test_manager.generate_session_key(session_id)
        
        # 启动轮换线程
        test_manager.start_rotation()
        
        # 等待密钥过期
        time.sleep(3)
        
        # 检查密钥是否已轮换
        current_key = test_manager.get_session_key(session_id)
        self.assertNotEqual(initial_key, current_key)
        
        # 停止线程
        test_manager.stop_rotation()
    
    def test_encryption_after_rotation(self):
        """测试密钥轮换后的加密功能"""
        # 创建加密器
        crypto = AESGCMCrypto()
        test_data = b"test message for rotation"
        
        # 生成会话密钥
        key1 = self.manager.generate_session_key(self.session_id)
        crypto1 = AESGCMCrypto(key1)
        
        # 加密数据
        ciphertext, iv = crypto1.encrypt(test_data)
        
        # 轮换密钥
        key2 = self.manager.rotate_session_key(self.session_id)
        crypto2 = AESGCMCrypto(key2)
        
        # 使用新密钥加密应该成功
        ciphertext2, iv2 = crypto2.encrypt(test_data)
        
        # 使用旧密钥解密应该失败（模拟密钥轮换后的安全机制）
        with self.assertRaises(Exception):  # 应该抛出InvalidTag异常
            crypto1.decrypt(ciphertext2, iv2, b'')
        
        # 使用新密钥解密应该成功
        decrypted = crypto2.decrypt(ciphertext2, iv2, b'')
        self.assertEqual(decrypted, test_data)
    
    def test_multiple_sessions_rotation(self):
        """测试多会话密钥轮换"""
        session_ids = ["session1", "session2", "session3"]
        initial_keys = {}
        
        # 为每个会话生成密钥
        for session_id in session_ids:
            key = self.manager.generate_session_key(session_id)
            initial_keys[session_id] = key
        
        # 轮换所有会话密钥
        for session_id in session_ids:
            new_key = self.manager.rotate_session_key(session_id)
            self.assertNotEqual(initial_keys[session_id], new_key)
            
            # 验证存储的是新密钥
            stored_key = self.manager.get_session_key(session_id)
            self.assertEqual(new_key, stored_key)
    
    def test_key_persistence(self):
        """测试密钥持久化功能"""
        import tempfile
        import os
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.json') as f:
            temp_file = f.name
        
        try:
            # 生成测试密钥
            session_id = "persistence_test"
            self.manager.generate_session_key(session_id)
            
            # 保存密钥到文件
            self.manager.save_keys_to_file(temp_file)
            
            # 创建新管理器并加载密钥
            new_manager = CryptoKeyManager()
            new_manager.load_keys_from_file(temp_file)
            
            # 验证密钥已加载
            loaded_key = new_manager.get_session_key(session_id)
            original_key = self.manager.get_session_key(session_id)
            self.assertEqual(loaded_key, original_key)
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_file):
                os.unlink(temp_file)
    
    def test_rotation_with_encrypted_messages(self):
        """测试密钥轮换对加密消息的影响"""
        # 创建加密器和密钥管理器
        crypto = AESGCMCrypto()
        session_id = "encryption_rotation_test"
        
        # 生成初始密钥
        key1 = self.manager.generate_session_key(session_id)
        crypto1 = AESGCMCrypto(key1)
        
        # 加密测试消息
        test_message = {"type": "test", "data": "important information"}
        encrypted_msg = crypto1.encrypt_message(test_message)
        
        # 轮换密钥
        key2 = self.manager.rotate_session_key(session_id)
        crypto2 = AESGCMCrypto(key2)
        
        # 使用新密钥加密新消息
        new_test_message = {"type": "test", "data": "new important information"}
        new_encrypted_msg = crypto2.encrypt_message(new_test_message)
        
        # 使用旧密钥解密旧消息应该成功
        decrypted_old = crypto1.decrypt_message(encrypted_msg)
        self.assertEqual(decrypted_old, test_message)
        
        # 使用新密钥解密新消息应该成功
        decrypted_new = crypto2.decrypt_message(new_encrypted_msg)
        self.assertEqual(decrypted_new, new_test_message)
        
        # 使用旧密钥解密新消息应该失败
        with self.assertRaises(Exception):
            crypto1.decrypt_message(new_encrypted_msg)
        
        # 使用新密钥解密旧消息应该失败
        with self.assertRaises(Exception):
            crypto2.decrypt_message(encrypted_msg)

class TestKeyRotationSecurity(unittest.TestCase):
    """密钥轮换安全性测试类"""
    
    def setUp(self):
        self.manager = CryptoKeyManager()
        self.session_id = "security_test_123"
    
    def test_forward_secrecy(self):
        """测试前向安全性（密钥轮换后旧密钥不能解密新数据）"""
        # 生成初始密钥
        key1 = self.manager.generate_session_key(self.session_id)
        crypto1 = AESGCMCrypto(key1)
        
        # 轮换密钥
        key2 = self.manager.rotate_session_key(self.session_id)
        crypto2 = AESGCMCrypto(key2)
        
        # 使用新密钥加密数据
        test_data = b"sensitive data after rotation"
        ciphertext, iv = crypto2.encrypt(test_data)
        
        # 使用旧密钥解密应该失败（确保前向安全性）
        with self.assertRaises(Exception):
            crypto1.decrypt(ciphertext, iv, b'')
    
    def test_backward_secrecy(self):
        """测试后向安全性（新密钥不能解密旧数据）"""
        # 生成初始密钥
        key1 = self.manager.generate_session_key(self.session_id)
        crypto1 = AESGCMCrypto(key1)
        
        # 使用旧密钥加密数据
        test_data = b"sensitive data before rotation"
        ciphertext, iv = crypto1.encrypt(test_data)
        
        # 轮换密钥
        key2 = self.manager.rotate_session_key(self.session_id)
        crypto2 = AESGCMCrypto(key2)
        
        # 使用新密钥解密应该失败（确保后向安全性）
        with self.assertRaises(Exception):
            crypto2.decrypt(ciphertext, iv, b'')
    
    def test_key_isolation(self):
        """测试密钥隔离（不同会话的密钥互不影响）"""
        session1 = "session_a"
        session2 = "session_b"
        
        # 为两个会话生成密钥
        key1 = self.manager.generate_session_key(session1)
        key2 = self.manager.generate_session_key(session2)
        
        # 验证密钥不同
        self.assertNotEqual(key1, key2)
        
        # 轮换一个会话的密钥
        new_key1 = self.manager.rotate_session_key(session1)
        
        # 验证另一个会话的密钥未受影响
        unchanged_key2 = self.manager.get_session_key(session2)
        self.assertEqual(key2, unchanged_key2)

def run_periodic_rotation_test():
    """运行周期性轮换测试"""
    print("=" * 60)
    print("运行24小时密钥轮换周期测试")
    print("=" * 60)
    
    # 创建测试管理器（使用较短的轮换间隔）
    test_manager = CryptoKeyManager(rotation_interval=5)  # 5秒用于测试
    session_id = "periodic_test_session"
    
    # 记录初始密钥
    initial_key = test_manager.generate_session_key(session_id)
    print(f"初始密钥: {initial_key.hex()[:16]}...")
    print(f"初始密钥年龄: {test_manager.get_key_age(session_id):.2f}秒")
    
    # 启动自动轮换
    test_manager.start_rotation()
    print("自动轮换线程已启动")
    
    # 监控密钥变化
    key_changes = 0
    last_key = initial_key
    
    for i in range(3):  # 监控3个轮换周期
        time.sleep(6)  # 等待超过轮换间隔
        
        current_key = test_manager.get_session_key(session_id)
        current_age = test_manager.get_key_age(session_id)
        
        if current_key != last_key:
            key_changes += 1
            print(f"周期 {i+1}: 密钥已轮换 → {current_key.hex()[:16]}... (年龄: {current_age:.2f}秒)")
            last_key = current_key
        else:
            print(f"周期 {i+1}: 密钥未变化 → {current_key.hex()[:16]}... (年龄: {current_age:.2f}秒)")
    
    # 停止轮换
    test_manager.stop_rotation()
    
    # 验证轮换发生
    assert key_changes >= 2, f"预期至少2次轮换，实际发生{key_changes}次"
    print(f"✓ 周期性轮换测试通过 - 发生{key_changes}次密钥轮换")

if __name__ == "__main__":
    # 运行单元测试
    unittest.main(exit=False)
    
    # 运行周期性测试
    run_periodic_rotation_test()
    
    print("\n" + "=" * 60)
    print("所有密钥轮换测试完成！✓")
    print("=" * 60)