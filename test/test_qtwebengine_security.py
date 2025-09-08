"""
QtWebEngine安全配置测试用例
测试QtWebEngine的安全选项配置是否正确
"""

import pytest
import re
from pathlib import Path


class TestQtWebEngineSecurity:
    """QtWebEngine安全配置测试类"""
    
    def test_main_window_security_configuration(self):
        """测试主窗口的安全配置"""
        main_window_path = Path("src/backend/ui/main_window.py")
        
        # 读取文件内容
        content = main_window_path.read_text(encoding='utf-8')
        
        # 检查安全配置项
        security_configs = {
            'WebSecurityEnabled': ('WebSecurityEnabled.*True', "Web安全未启用"),
            'AllowRunningInsecureContent': ('AllowRunningInsecureContent.*False', "允许运行不安全内容未禁用"),
            'LocalContentCanAccessRemoteUrls': ('LocalContentCanAccessRemoteUrls.*False', "本地内容可访问远程URL未禁用"),
            'LocalContentCanAccessFileUrls': ('LocalContentCanAccessFileUrls.*False', "本地内容可访问文件URL未禁用"),
            'JavascriptCanAccessClipboard': ('JavascriptCanAccessClipboard.*False', "JavaScript访问剪贴板未禁用"),
            'XSSAuditingEnabled': ('XSSAuditingEnabled.*True', "XSS审计未启用")
        }
        
        # 验证每个安全配置
        failed_checks = []
        for config_name, (pattern, error_msg) in security_configs.items():
            if not re.search(pattern, content):
                failed_checks.append(f"{config_name}: {error_msg}")
        
        # 如果有失败的检查，抛出断言错误
        assert len(failed_checks) == 0, f"安全配置检查失败:\n" + "\n".join(failed_checks)
    
    def test_webengine_imports_present(self):
        """测试必要的WebEngine导入存在"""
        main_window_path = Path("src/backend/ui/main_window.py")
        content = main_window_path.read_text(encoding='utf-8')
        
        required_imports = [
            'QWebEngineView',
            'QWebEnginePage', 
            'QWebEngineSettings'
        ]
        
        missing_imports = []
        for import_name in required_imports:
            if import_name not in content:
                missing_imports.append(import_name)
        
        assert len(missing_imports) == 0, f"缺少必要的导入: {', '.join(missing_imports)}"
    
    def test_remote_debugging_enabled(self):
        """测试远程调试已启用"""
        main_window_path = Path("src/backend/ui/main_window.py")
        content = main_window_path.read_text(encoding='utf-8')
        
        # 检查远程调试环境变量设置
        assert re.search(r"QTWEBENGINE_REMOTE_DEBUGGING.*=.*['\"]9222['\"]", content), \
            "远程调试端口未设置为9222"
    
    def test_javascript_enabled(self):
        """测试JavaScript已启用"""
        main_window_path = Path("src/backend/ui/main_window.py")
        content = main_window_path.read_text(encoding='utf-8')
        
        assert re.search(r"JavascriptEnabled.*True", content), \
            "JavaScript未启用"
    
    def test_local_storage_enabled(self):
        """测试本地存储已启用"""
        main_window_path = Path("src/backend/ui/main_window.py")
        content = main_window_path.read_text(encoding='utf-8')
        
        assert re.search(r"LocalStorageEnabled.*True", content), \
            "本地存储未启用"


if __name__ == "__main__":
    # 运行测试
    test_instance = TestQtWebEngineSecurity()
    
    print("运行QtWebEngine安全配置测试...")
    print("=" * 50)
    
    tests = [
        test_instance.test_main_window_security_configuration,
        test_instance.test_webengine_imports_present,
        test_instance.test_remote_debugging_enabled,
        test_instance.test_javascript_enabled,
        test_instance.test_local_storage_enabled
    ]
    
    passed = 0
    failed = 0
    
    for test_method in tests:
        try:
            test_method()
            print(f"✅ {test_method.__name__} - 通过")
            passed += 1
        except AssertionError as e:
            print(f"❌ {test_method.__name__} - 失败: {str(e)}")
            failed += 1
        except Exception as e:
            print(f"⚠️ {test_method.__name__} - 错误: {str(e)}")
            failed += 1
    
    print("=" * 50)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    
    if failed == 0:
        print("🎉 所有安全配置测试通过!")
    else:
        print("❌ 存在安全配置问题，请检查!")
        exit(1)