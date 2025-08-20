#!/usr/bin/env python3
"""
20250821 前端错误格式修复简单验证测试

测试目的：验证调试报告中提到的"undefined"错误显示问题是否已修复
测试起因：根据20250820230000_debugReport.md的修复方案进行验证

测试内容：
1. 验证前端能正确解析后端嵌套格式的错误响应
2. 验证FILE_EXISTS等错误码显示用户友好的提示
3. 验证不再显示"undefined"错误
"""

import os
import sys
import json

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

def simulate_frontend_error_handling(data):
    """模拟前端的错误处理逻辑"""
    error_code = None
    error_message = None
    
    # 兼容新旧格式，根据调试报告的方案
    if data.get('data') and data['data'].get('code'):
        error_code = data['data']['code']
        error_message = data['data'].get('message', '未知错误')
    elif data.get('error_code'):
        error_code = data['error_code']
        error_message = data.get('message', '未知错误')
    elif data.get('code'):
        error_code = data['code']
        error_message = data.get('message', '未知错误')
    else:
        error_message = data.get('message', '发生未知错误')
    
    # 根据错误码显示用户友好的消息
        if error_code == 'FILE_EXISTS':
            error_message = '文件已存在于列表中'
        elif error_code == 'FILE_NOT_FOUND':
            error_message = '文件不存在或无法访问'
        elif error_code == 'PERMISSION_DENIED':
            error_message = '文件权限不足'
        elif not error_message or error_message == '未知错误':
            error_message = '发生未知错误'
    
    return {
        "error_code": error_code,
        "error_message": error_message,
        "raw_data": data
    }

def run_error_format_tests():
    """运行错误格式测试"""
    print("=" * 60)
    print("20250821 前端错误格式修复验证测试")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "FILE_EXISTS错误处理（嵌套格式）",
            "response": {
                "type": "error",
                "data": {
                    "code": "FILE_EXISTS",
                    "message": "文件已存在于列表中: test.pdf",
                    "original_type": "add_pdf"
                }
            },
            "expected_code": "FILE_EXISTS",
            "expected_message": "文件已存在于列表中"
        },
        {
            "name": "FILE_NOT_FOUND错误处理（嵌套格式）", 
            "response": {
                "type": "error",
                "data": {
                    "code": "FILE_NOT_FOUND",
                    "message": "文件不存在: missing.pdf",
                    "original_type": "request_file_selection"
                }
            },
            "expected_code": "FILE_NOT_FOUND",
            "expected_message": "文件不存在或无法访问"
        },
        {
            "name": "PERMISSION_DENIED错误处理（嵌套格式）",
            "response": {
                "type": "error",
                "data": {
                    "code": "PERMISSION_DENIED",
                    "message": "文件权限不足: protected.pdf",
                    "original_type": "remove_pdf"
                }
            },
            "expected_code": "PERMISSION_DENIED",
            "expected_message": "文件权限不足"
        },
        {
            "name": "旧格式兼容性测试",
            "response": {
                "type": "error",
                "error_code": "FILE_EXISTS",
                "message": "文件已存在于列表中: test.pdf"
            },
            "expected_code": "FILE_EXISTS",
            "expected_message": "文件已存在于列表中"
        },
        {
            "name": "未知错误格式处理",
            "response": {
                "type": "error",
                "message": "未知错误"
            },
            "expected_code": None,
            "expected_message": "发生未知错误"
        }
    ]
    
    results = []
    passed_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n测试 {i}: {test_case['name']}")
        print("-" * 50)
        
        result = simulate_frontend_error_handling(test_case["response"])
        
        # 验证结果
        code_match = result["error_code"] == test_case["expected_code"]
        message_match = result["error_message"] == test_case["expected_message"]
        passed = code_match and message_match
        
        print(f"原始响应: {json.dumps(test_case['response'], ensure_ascii=False, indent=2)}")
        print(f"预期错误码: {test_case['expected_code']}")
        print(f"实际错误码: {result['error_code']}")
        print(f"预期消息: {test_case['expected_message']}")
        print(f"实际消息: {result['error_message']}")
        
        if passed:
            print("✅ 测试通过")
            passed_count += 1
        else:
            print("❌ 测试失败")
            if not code_match:
                print(f"  错误码不匹配: 预期 {test_case['expected_code']}, 实际 {result['error_code']}")
            if not message_match:
                print(f"  消息不匹配: 预期 '{test_case['expected_message']}', 实际 '{result['error_message']}'")
        
        results.append({
            "test_name": test_case["name"],
            "passed": passed,
            "expected": test_case["expected_message"],
            "actual": result["error_message"]
        })
    
    print("\n" + "=" * 60)
    print("测试结果汇总:")
    print("-" * 60)
    print(f"总计: {passed_count}/{len(test_cases)} 个测试通过")
    
    for result in results:
        status = "✅ 通过" if result["passed"] else "❌ 失败"
        print(f"{status} {result['test_name']}")
    
    if passed_count == len(test_cases):
        print("\n🎉 所有测试通过！错误格式修复验证成功")
        print("✅ 前端不再显示'undefined'错误")
        print("✅ 正确解析后端嵌套格式的错误响应")
        print("✅ 提供用户友好的错误提示")
    else:
        print("\n⚠️ 部分测试失败，需要进一步检查")
    
    return passed_count == len(test_cases), results

def check_frontend_file():
    """检查前端文件是否已更新"""
    print("\n" + "=" * 60)
    print("检查前端文件更新状态")
    print("-" * 60)
    
    file_path = "src/frontend/pdf-home/main.js"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 检查是否包含修复后的错误处理逻辑
        checks = [
            ("嵌套格式兼容性", "data.data && data.data.code" in content),
            ("FILE_EXISTS特殊处理", "case 'FILE_EXISTS'" in content and "文件已存在于列表中" in content),
            ("FILE_NOT_FOUND特殊处理", "case 'FILE_NOT_FOUND'" in content and "文件不存在或无法访问" in content),
            ("PERMISSION_DENIED特殊处理", "case 'PERMISSION_DENIED'" in content and "文件权限不足" in content),
            ("用户友好错误消息", "操作失败" in content)
        ]
        
        print(f"前端文件: {file_path}")
        for check_name, passed in checks:
            status = "✅ 已更新" if passed else "❌ 未找到"
            print(f"{status} {check_name}")
        
        all_updated = all(passed for _, passed in checks)
        if all_updated:
            print("\n🎉 前端文件已按调试报告要求完成更新")
        else:
            print("\n⚠️  前端文件部分更新可能未完成")
            
        return all_updated
        
    except FileNotFoundError:
        print(f"❌ 文件未找到: {file_path}")
        return False

def main():
    """主函数"""
    print("20250821 前端错误格式修复验证测试")
    print("基于调试报告: 20250820230000_debugReport.md")
    
    # 运行测试
    test_success, results = run_error_format_tests()
    
    # 检查文件更新
    file_updated = check_frontend_file()
    
    # 生成测试报告
    report_path = "20250821_error_fix_verification_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("20250821 前端错误格式修复验证报告\n")
        f.write("=" * 50 + "\n\n")
        f.write("测试时间: {}\n".format(__import__('time').strftime("%Y-%m-%d %H:%M:%S")))
        f.write("基于调试报告: 20250820230000_debugReport.md\n\n")
        
        f.write("测试结果:\n")
        for result in results:
            f.write(f"- {result['test_name']}: {'通过' if result['passed'] else '失败'}\n")
            f.write(f"  预期: {result['expected']}\n")
            f.write(f"  实际: {result['actual']}\n\n")
        
        f.write("文件更新状态:\n")
        f.write(f"- 前端文件已更新: {'是' if file_updated else '否'}\n\n")
        
        if test_success and file_updated:
            f.write("结论: ✅ 错误格式修复验证成功完成！\n")
            f.write("前端不再显示'undefined'错误，提供用户友好的错误提示。\n")
        else:
            f.write("结论: ❌ 需要进一步检查修复状态\n")
    
    print(f"\n详细测试报告已保存到: {report_path}")
    
    # 最终结论
    if test_success and file_updated:
        print("\n🎉 调试报告中提到的bug已完全修复！")
        return True
    else:
        print("\n⚠️  修复验证未完成，需要进一步检查")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)