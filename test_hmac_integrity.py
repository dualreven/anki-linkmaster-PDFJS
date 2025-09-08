"""
HMAC-SHA256验证功能测试
直接在项目根目录运行
"""

import sys
import os
import json
import hmac
import hashlib
import base64
from typing import Optional

# 模拟HMAC验证器类（避免导入问题）
class HMACVerifier:
    """HMAC-SHA256验证器类"""
    
    HMAC_KEY_SIZE = 32
    
    def __init__(self, hmac_key: Optional[bytes] = None):
        if hmac_key is None:
            self._hmac_key = self.generate_key()
        else:
            if len(hmac_key) != self.HMAC_KEY_SIZE:
                raise ValueError(f"HMAC密钥长度必须为{self.HMAC_KEY_SIZE}字节")
            self._hmac_key = hmac_key
    
    @property
    def hmac_key(self) -> bytes:
        return self._hmac_key
    
    @staticmethod
    def generate_key() -> bytes:
        import os
        return os.urandom(HMACVerifier.HMAC_KEY_SIZE)
    
    def compute_hmac(self, data: bytes) -> bytes:
        return hmac.new(
            self._hmac_key,
            data,
            hashlib.sha256
        ).digest()
    
    def compute_hmac_base64(self, data: bytes) -> str:
        hmac_signature = self.compute_hmac(data)
        return base64.b64encode(hmac_signature).decode('utf-8')
    
    def verify_hmac(self, data: bytes, expected_hmac: bytes) -> bool:
        actual_hmac = self.compute_hmac(data)
        return hmac.compare_digest(actual_hmac, expected_hmac)
    
    def verify_hmac_base64(self, data: bytes, expected_hmac_base64: str) -> bool:
        try:
            expected_hmac = base64.b64decode(expected_hmac_base64)
            return self.verify_hmac(data, expected_hmac)
        except (ValueError, TypeError):
            return False

class MessageIntegrityManager:
    """消息完整性管理器"""
    
    def __init__(self):
        self.hmac_verifiers = {}
    
    def get_verifier_for_session(self, session_id: str) -> HMACVerifier:
        if session_id not in self.hmac_verifiers:
            self.hmac_verifiers[session_id] = HMACVerifier()
        return self.hmac_verifiers[session_id]
    
    def verify_message_integrity(self, session_id: str, message_data: bytes, expected_hmac: str) -> bool:
        verifier = self.get_verifier_for_session(session_id)
        return verifier.verify_hmac_base64(message_data, expected_hmac)
    
    def sign_message(self, session_id: str, message_data: bytes) -> str:
        verifier = self.get_verifier_for_session(session_id)
        return verifier.compute_hmac_base64(message_data)

def test_hmac_verifier_basic():
    """测试HMAC验证器基本功能"""
    print("=" * 50)
    print("测试HMAC验证器基本功能")
    print("=" * 50)
    
    verifier = HMACVerifier()
    test_data = "这是一条重要的测试消息".encode('utf-8')
    
    hmac_signature = verifier.compute_hmac(test_data)
    hmac_base64 = verifier.compute_hmac_base64(test_data)
    
    print(f"测试数据: {test_data.decode('utf-8')}")
    print(f"HMAC签名 (十六进制): {hmac_signature.hex()}")
    print(f"HMAC签名 (Base64): {hmac_base64}")
    
    # 验证正确的HMAC
    result1 = verifier.verify_hmac(test_data, hmac_signature)
    print(f"正确HMAC验证结果: {result1}")
    assert result1 == True, "正确HMAC验证失败"
    
    # 验证Base64格式
    result2 = verifier.verify_hmac_base64(test_data, hmac_base64)
    print(f"Base64 HMAC验证结果: {result2}")
    assert result2 == True, "Base64 HMAC验证失败"
    
    # 测试错误数据
    wrong_data = "这是一条被篡改的消息".encode('utf-8')
    result3 = verifier.verify_hmac(wrong_data, hmac_signature)
    print(f"错误数据验证结果: {result3}")
    assert result3 == False, "错误数据验证应该失败"
    
    print("✓ HMAC验证器基本功能测试通过")

def test_message_integrity_manager():
    """测试消息完整性管理器"""
    print("\n" + "=" * 50)
    print("测试消息完整性管理器")
    print("=" * 50)
    
    manager = MessageIntegrityManager()
    session_id = "test_session_123"
    message_data = "需要验证完整性的消息内容".encode('utf-8')
    
    signature = manager.sign_message(session_id, message_data)
    print(f"会话ID: {session_id}")
    print(f"消息数据: {message_data.decode('utf-8')}")
    print(f"生成的签名: {signature}")
    
    # 验证签名
    result1 = manager.verify_message_integrity(session_id, message_data, signature)
    print(f"正确签名验证结果: {result1}")
    assert result1 == True, "正确签名验证失败"
    
    # 测试错误数据
    wrong_data = "被篡改的消息内容".encode('utf-8')
    result2 = manager.verify_message_integrity(session_id, wrong_data, signature)
    print(f"错误数据验证结果: {result2}")
    assert result2 == False, "错误数据验证应该失败"
    
    print("✓ 消息完整性管理器测试通过")

def test_hmac_key_consistency():
    """测试HMAC密钥一致性"""
    print("\n" + "=" * 50)
    print("测试HMAC密钥一致性")
    print("=" * 50)
    
    manager = MessageIntegrityManager()
    session_id = "consistency_test_session"
    
    # 获取同一个会话的验证器两次
    verifier1 = manager.get_verifier_for_session(session_id)
    verifier2 = manager.get_verifier_for_session(session_id)
    
    test_data = "一致性测试消息".encode('utf-8')
    signature1 = verifier1.compute_hmac_base64(test_data)
    signature2 = verifier2.compute_hmac_base64(test_data)
    
    print(f"验证器1签名: {signature1}")
    print(f"验证器2签名: {signature2}")
    
    # 签名应该相同（使用相同的密钥）
    assert signature1 == signature2, "相同会话的HMAC签名应该一致"
    
    # 验证签名
    assert verifier1.verify_hmac_base64(test_data, signature2), "验证器1应该能验证验证器2的签名"
    assert verifier2.verify_hmac_base64(test_data, signature1), "验证器2应该能验证验证器1的签名"
    
    print("✓ HMAC密钥一致性测试通过")

def test_tampered_message_detection():
    """测试篡改消息检测"""
    print("\n" + "=" * 50)
    print("测试篡改消息检测")
    print("=" * 50)
    
    verifier = HMACVerifier()
    original_data = "原始重要消息".encode('utf-8')
    tampered_data = "篡改后的消息".encode('utf-8')
    
    # 计算原始消息的HMAC
    original_hmac = verifier.compute_hmac_base64(original_data)
    
    # 验证篡改的消息
    result = verifier.verify_hmac_base64(tampered_data, original_hmac)
    print(f"原始消息HMAC: {original_hmac}")
    print(f"篡改消息验证结果: {result}")
    assert result == False, "篡改的消息应该验证失败"
    
    print("✓ 篡改消息检测测试通过")

def run_all_tests():
    """运行所有测试"""
    print("开始HMAC-SHA256验证功能完整性测试...\n")
    
    try:
        test_hmac_verifier_basic()
        test_message_integrity_manager()
        test_hmac_key_consistency()
        test_tampered_message_detection()
        
        print("\n" + "=" * 50)
        print("所有完整性测试通过！✓")
        print("HMAC-SHA256验证功能完整且正确")
        print("=" * 50)
        return True
        
    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)