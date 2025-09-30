"""
测试launcher的异常处理功能

模拟导入错误和运行时错误，验证异常是否被正确捕获和显示
"""

import sys
import subprocess
from pathlib import Path

project_root = Path(__file__).parent


def test_import_error():
    """测试导入错误的捕获"""
    print("=== 测试1: 模拟导入错误 ===")
    print("临时修改 compat.py，移除 QSizePolicy 导出...")

    compat_file = project_root / "src" / "qt" / "compat.py"
    backup_file = project_root / "src" / "qt" / "compat.py.bak"

    # 备份原文件
    import shutil
    shutil.copy(compat_file, backup_file)

    try:
        # 读取并修改 compat.py
        content = compat_file.read_text(encoding='utf-8')
        modified_content = content.replace("QSizePolicy", "")
        compat_file.write_text(modified_content, encoding='utf-8')

        # 尝试运行 launcher
        print("运行 pdf-viewer launcher...")
        result = subprocess.run(
            [sys.executable, "src/frontend/pdf-viewer/launcher.py", "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=str(project_root)
        )

        if result.returncode != 0:
            print("✓ 捕获到错误!")
            print("\nStderr输出:")
            print(result.stderr)
            print("\nStdout输出:")
            print(result.stdout)
        else:
            print("✗ 未捕获到预期的错误")

    finally:
        # 恢复原文件
        print("\n恢复 compat.py...")
        shutil.move(backup_file, compat_file)
        print("✓ 文件已恢复")


def test_normal_startup():
    """测试正常启动（使用--diagnose-only跳过GUI）"""
    print("\n=== 测试2: 正常启动测试 ===")
    print("运行 pdf-viewer launcher (diagnose模式)...")

    result = subprocess.run(
        [sys.executable, "src/frontend/pdf-viewer/launcher.py", "--diagnose-only"],
        capture_output=True,
        text=True,
        timeout=10,
        cwd=str(project_root)
    )

    if result.returncode == 0:
        print("✓ 正常启动成功!")
        print("\n诊断输出:")
        print(result.stdout[:500])  # 只显示前500字符
    else:
        print("✗ 启动失败")
        print("\nStderr:")
        print(result.stderr)


def test_pdf_home_launcher():
    """测试 pdf-home launcher 的异常处理"""
    print("\n=== 测试3: pdf-home launcher 异常处理 ===")
    print("运行 pdf-home launcher --help...")

    result = subprocess.run(
        [sys.executable, "src/frontend/pdf-home/launcher.py", "--help"],
        capture_output=True,
        text=True,
        timeout=5,
        cwd=str(project_root)
    )

    if result.returncode == 0:
        print("✓ pdf-home launcher 正常运行!")
    else:
        print("✗ pdf-home launcher 运行失败")
        print("\nStderr:")
        print(result.stderr)


if __name__ == "__main__":
    print("开始测试launcher异常处理功能\n")
    print("=" * 60)

    # 测试2和3不会破坏文件，先运行
    test_normal_startup()
    test_pdf_home_launcher()

    # 测试1会临时修改文件，需要用户确认
    print("\n" + "=" * 60)
    response = input("\n是否执行导入错误测试? (会临时修改compat.py) [y/N]: ")
    if response.lower() == 'y':
        test_import_error()
    else:
        print("跳过导入错误测试")

    print("\n" + "=" * 60)
    print("测试完成!")