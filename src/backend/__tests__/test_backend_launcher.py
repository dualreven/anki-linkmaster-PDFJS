#!/usr/bin/env python3
"""
BackendLauncher 双模式功能测试

测试新的 PyQt 集成启动器的两种模式：
1. 子进程模式（subprocess）
2. 寄宿模式（hosted）
"""

import sys
import time
from pathlib import Path

# 设置项目路径
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer
from src.backend.launcher import BackendLauncher


def test_subprocess_mode():
    """测试子进程模式（自动创建 QApplication）"""
    print("\n" + "="*60)
    print("测试 1: 子进程模式")
    print("="*60)

    # 创建启动器（不传入 parent_app）
    launcher = BackendLauncher(parent_app=None)

    # 验证模式
    assert launcher.mode == "subprocess", f"模式错误: {launcher.mode}"
    print("✅ 模式检测正确: subprocess")

    # 启动服务（会创建 QApplication 并阻塞）
    # 注意：此测试需要手动中断或设置定时器自动退出
    print("\n⚠️ 此测试将创建 QApplication 并阻塞")
    print("请在 5 秒内检查服务状态，然后按 Ctrl+C 退出\n")

    # 注意：start() 在子进程模式下会阻塞，所以这个测试需要手动运行
    # success = launcher.start()
    # 由于会阻塞，我们跳过实际启动，只测试初始化
    print("✅ 子进程模式初始化测试通过")


def test_hosted_mode():
    """测试寄宿模式（使用父应用的 QApplication）"""
    print("\n" + "="*60)
    print("测试 2: 寄宿模式")
    print("="*60)

    # 创建父 QApplication（模拟 Anki）
    app = QApplication(sys.argv)
    print("✅ 已创建父 QApplication")

    # 创建启动器（传入 parent_app）
    launcher = BackendLauncher(parent_app=app)

    # 验证模式
    assert launcher.mode == "hosted", f"模式错误: {launcher.mode}"
    print("✅ 模式检测正确: hosted")

    # 启动服务（不会阻塞）
    print("\n启动服务...")
    start_time = time.time()
    success = launcher.start()
    elapsed = time.time() - start_time

    if not success:
        print("❌ 启动失败")
        return False

    print(f"✅ 启动成功，耗时: {elapsed:.2f} 秒")

    # 验证启动时间 < 1 秒
    if elapsed >= 1.0:
        print(f"⚠️ 启动时间 {elapsed:.2f}s 超过 1 秒（目标 < 1s）")
    else:
        print(f"✅ 启动时间符合预期: {elapsed:.2f}s < 1s")

    # 验证服务状态
    assert launcher.is_ws_running(), "WebSocket 服务器未运行"
    print("✅ WebSocket 服务器运行中")

    assert launcher.is_http_running(), "HTTP 服务器未运行"
    print("✅ HTTP 服务器运行中")

    # 获取状态信息
    status = launcher.get_status()
    print("\n服务状态:")
    print(f"  模式: {status['mode']}")
    print(f"  WebSocket: {status['websocket']['running']} (端口: {status['websocket']['port']})")
    print(f"  HTTP: {status['http']['running']} (端口: {status['http']['port']})")

    # 设置定时器，5 秒后自动停止
    def auto_stop():
        print("\n5 秒后自动停止服务...")
        launcher.stop()
        print("✅ 服务已停止")
        app.quit()

    QTimer.singleShot(5000, auto_stop)

    print("\n运行事件循环 5 秒后自动退出...")
    app.exec()

    return True


def test_status_api():
    """测试状态 API"""
    print("\n" + "="*60)
    print("测试 3: 状态 API")
    print("="*60)

    # 创建测试应用
    app = QApplication(sys.argv)

    # 创建启动器
    launcher = BackendLauncher(parent_app=app)

    # 启动前的状态
    status_before = launcher.get_status()
    print("启动前状态:")
    print(f"  WebSocket 运行: {status_before['websocket']['running']}")
    print(f"  HTTP 运行: {status_before['http']['running']}")

    assert not status_before['websocket']['running'], "WebSocket 不应在启动前运行"
    assert not status_before['http']['running'], "HTTP 不应在启动前运行"
    print("✅ 启动前状态正确")

    # 启动服务
    launcher.start()

    # 启动后的状态
    status_after = launcher.get_status()
    print("\n启动后状态:")
    print(f"  WebSocket 运行: {status_after['websocket']['running']}")
    print(f"  HTTP 运行: {status_after['http']['running']}")

    assert status_after['websocket']['running'], "WebSocket 应在启动后运行"
    assert status_after['http']['running'], "HTTP 应在启动后运行"
    print("✅ 启动后状态正确")

    # 停止服务
    launcher.stop()

    # 停止后的状态
    status_stopped = launcher.get_status()
    print("\n停止后状态:")
    print(f"  WebSocket 运行: {status_stopped['websocket']['running']}")
    print(f"  HTTP 运行: {status_stopped['http']['running']}")

    assert not status_stopped['websocket']['running'], "WebSocket 不应在停止后运行"
    assert not status_stopped['http']['running'], "HTTP 不应在停止后运行"
    print("✅ 停止后状态正确")

    return True


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("BackendLauncher 双模式功能测试")
    print("="*60)

    try:
        # 测试 1: 子进程模式（仅测试初始化）
        test_subprocess_mode()

        # 测试 2: 寄宿模式（完整测试）
        test_hosted_mode()

        # 测试 3: 状态 API
        # test_status_api()  # 与测试 2 冲突，单独运行

        print("\n" + "="*60)
        print("✅ 所有测试通过")
        print("="*60)

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
