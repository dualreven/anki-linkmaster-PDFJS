#!/usr/bin/env python3
"""
WebSocket模块README文档质量测试脚本

测试内容：
1. UTF-8编码读取
2. 关键段落标题完整性
3. 换行符格式检查（确保使用\\n）
4. 内容完整性验证
"""

import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

def test_msgcenter_readme():
    """测试WebSocket模块README文档"""

    readme_path = project_root / 'src' / 'backend' / 'msgCenter_server' / 'README.md'

    print(f"测试文件: {readme_path}")

    # 测试1: 检查文件是否存在
    if not readme_path.exists():
        print("❌ 文件不存在")
        return False

    # 测试2: UTF-8编码读取
    try:
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print("✅ UTF-8编码读取成功")
    except UnicodeDecodeError as e:
        print(f"❌ UTF-8编码读取失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 文件读取失败: {e}")
        return False

    # 测试3: 检查换行符格式（确保使用\\n而不是\\r\\n）
    if '\\r' in content:
        print("❌ 发现\\r字符，应使用\\n换行")
        return False
    else:
        print("✅ 换行符格式正确（使用\\n）")

    # 测试4: 检查必需的段落标题
    required_sections = [
        '# WebSocket通信中心模块 (msgCenter_server)',
        '## 模块概述',
        '## 架构设计',
        '## 核心功能',
        '## API接口',
        '## 使用方法',
        '## 安全特性',
        '## 配置说明',
        '## 故障排除'
    ]

    missing_sections = []
    for section in required_sections:
        if section not in content:
            missing_sections.append(section)

    if missing_sections:
        print(f"❌ 缺少必需段落: {missing_sections}")
        return False
    else:
        print("✅ 所有必需段落都存在")

    # 测试5: 检查关键内容
    key_content_checks = {
        'StandardWebSocketServer': 'StandardWebSocketServer' in content,
        'StandardMessageHandler': 'StandardMessageHandler' in content,
        'AESGCMCrypto': 'AESGCMCrypto' in content,
        'MessageType': 'MessageType' in content,
        'JSON通信标准': 'JSON通信标准' in content or 'JSON' in content,
        '端口配置': '端口' in content,
        '加密': '加密' in content or 'AES' in content,
        '消息类型': '消息类型' in content or 'message_type' in content
    }

    failed_content_checks = []
    for check_name, result in key_content_checks.items():
        if not result:
            failed_content_checks.append(check_name)

    if failed_content_checks:
        print(f"❌ 缺少关键内容: {failed_content_checks}")
        return False
    else:
        print("✅ 所有关键内容都存在")

    # 测试6: 检查文档长度（应该是一个相当详细的文档）
    word_count = len(content.split())
    if word_count < 500:
        print(f"❌ 文档内容过少，词数: {word_count}")
        return False
    else:
        print(f"✅ 文档内容充实，词数: {word_count}")

    # 测试7: 检查代码示例
    code_blocks = content.count('```')
    if code_blocks < 10:  # 应该有足够的代码示例
        print(f"❌ 代码示例过少，代码块数量: {code_blocks // 2}")
        return False
    else:
        print(f"✅ 包含充足的代码示例，代码块数量: {code_blocks // 2}")

    # 测试8: 检查架构图（ASCII艺术）
    if '┌─' in content and '└─' in content:
        print("✅ 包含架构图")
    else:
        print("❌ 缺少架构图")
        return False

    print("\\n🎉 所有测试通过！WebSocket模块README文档质量良好")
    return True

def main():
    """主函数"""
    print("WebSocket模块README文档质量测试")
    print("=" * 50)

    success = test_msgcenter_readme()

    if success:
        print("\\n✅ 测试结果: 通过")
        sys.exit(0)
    else:
        print("\\n❌ 测试结果: 失败")
        sys.exit(1)

if __name__ == "__main__":
    main()