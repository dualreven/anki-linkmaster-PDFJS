#!/usr/bin/env python3
"""
TestUI 手动测试脚本

用于验证测试UI的功能:
1. 启动BackendLauncher子进程模式（不显示UI）
2. 启动BackendLauncher子进程模式（显示UI）
3. 测试UI状态显示功能
4. 测试停止按钮功能
5. 测试窗口关闭自动停止服务器

使用方法:
    # 测试1: 不显示UI（默认）
    python src/backend/__tests__/manual_test_ui.py

    # 测试2: 显示UI（参数传递）
    python src/backend/__tests__/manual_test_ui.py --show-ui

    # 测试3: 独立UI
    python src/backend/__tests__/manual_test_ui.py --standalone

    # 交互式菜单（无参数）
    python src/backend/__tests__/manual_test_ui.py
"""

import sys
import os
import argparse
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))


def test_ui_without_env():
    """
    测试1: 不显示UI（默认模式）

    预期结果:
    - 服务器正常启动
    - 不显示UI窗口
    - 可以通过Ctrl+C停止
    """
    print("\n" + "=" * 60)
    print("测试1: 不显示UI（默认模式）")
    print("=" * 60)
    print("\n预期结果:")
    print("  ✓ WebSocket服务器启动成功")
    print("  ✓ HTTP文件服务器启动成功")
    print("  ✗ 不显示UI窗口")
    print("\n按 Ctrl+C 停止服务器...\n")

    from src.backend.launcher import BackendLauncher

    # 创建启动器（子进程模式，不显示UI）
    launcher = BackendLauncher(parent_app=None, show_ui=False)

    # 启动服务（会阻塞）
    launcher.start()


def test_ui_with_env():
    """
    测试2: 显示UI（参数传递模式）

    预期结果:
    - 服务器正常启动
    - 显示UI窗口，包含:
      * 服务器状态标签（绿色 - 运行中）
      * WebSocket服务器信息（端口、客户端数）
      * HTTP服务器信息（端口）
      * 刷新按钮
      * 停止服务器按钮
    - 可以通过UI按钮或关闭窗口停止
    """
    print("\n" + "=" * 60)
    print("测试2: 显示UI（参数传递 show_ui=True）")
    print("=" * 60)
    print("\n预期结果:")
    print("  ✓ WebSocket服务器启动成功")
    print("  ✓ HTTP文件服务器启动成功")
    print("  ✓ 显示UI窗口")
    print("\n测试UI功能:")
    print("  1. 状态标签显示'🟢 服务器运行中'")
    print("  2. WebSocket端口信息正确显示")
    print("  3. HTTP端口信息正确显示")
    print("  4. 客户端连接数为0")
    print("  5. 点击'刷新状态'按钮可更新状态")
    print("  6. 点击'停止服务器'按钮停止服务")
    print("  7. 关闭窗口时自动停止服务器")
    print("\n按 Ctrl+C 或关闭UI窗口停止服务器...\n")

    from src.backend.launcher import BackendLauncher

    # 创建启动器（子进程模式，显示UI）
    launcher = BackendLauncher(parent_app=None, show_ui=True)

    # 启动服务（会阻塞）
    launcher.start()


def test_ui_standalone():
    """
    测试3: 独立测试UI（不启动服务器）

    预期结果:
    - 显示UI窗口
    - 状态显示为"未运行"或空
    - 可以正常操作UI组件
    """
    print("\n" + "=" * 60)
    print("测试3: 独立测试UI（不启动服务器）")
    print("=" * 60)
    print("\n预期结果:")
    print("  ✓ UI窗口正常显示")
    print("  ✗ 状态显示为'未运行'或空")
    print("\n测试UI布局和样式:")
    print("  1. 标题居中显示")
    print("  2. 状态组正确布局")
    print("  3. WebSocket和HTTP信息组正确布局")
    print("  4. 按钮正确显示")
    print("\n关闭窗口退出...\n")

    from src.backend.test_ui import TestUI
    from PyQt6.QtWidgets import QApplication

    app = QApplication(sys.argv)

    # 创建UI（不传launcher）
    ui = TestUI()
    ui.show()

    sys.exit(app.exec())


def print_menu():
    """打印测试菜单"""
    print("\n" + "=" * 60)
    print("TestUI 手动测试脚本")
    print("=" * 60)
    print("\n选择测试项:")
    print("  1. 测试不显示UI（默认模式）")
    print("  2. 测试显示UI（参数传递 show_ui=True）")
    print("  3. 独立测试UI（不启动服务器）")
    print("  4. 退出")
    print()


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='TestUI 手动测试脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 交互式菜单（无参数）
  python src/backend/__tests__/manual_test_ui.py

  # 不显示UI（默认）
  python src/backend/__tests__/manual_test_ui.py --no-ui

  # 显示UI（参数传递）
  python src/backend/__tests__/manual_test_ui.py --show-ui

  # 独立UI测试
  python src/backend/__tests__/manual_test_ui.py --standalone
        """
    )

    parser.add_argument(
        '--show-ui',
        action='store_true',
        help='显示UI窗口（测试2）'
    )
    parser.add_argument(
        '--no-ui',
        action='store_true',
        help='不显示UI窗口（测试1）'
    )
    parser.add_argument(
        '--standalone',
        action='store_true',
        help='独立UI测试，不启动服务器（测试3）'
    )

    return parser.parse_args()


def main():
    """主函数"""
    args = parse_args()

    # 根据命令行参数决定运行哪个测试
    if args.standalone:
        # 独立UI测试
        test_ui_standalone()
    elif args.show_ui:
        # 显示UI
        test_ui_with_env()
    elif args.no_ui:
        # 不显示UI
        test_ui_without_env()
    else:
        # 无参数，显示交互式菜单
        while True:
            print_menu()
            choice = input("请选择 (1-4): ").strip()

            if choice == "1":
                test_ui_without_env()
                break
            elif choice == "2":
                test_ui_with_env()
                break
            elif choice == "3":
                test_ui_standalone()
                break
            elif choice == "4":
                print("\n退出测试")
                break
            else:
                print("\n❌ 无效选择，请重新输入")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✅ 用户中断测试")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
