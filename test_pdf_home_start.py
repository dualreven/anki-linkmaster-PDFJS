#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 PDF-Home 启动逻辑（不使用 GUI）
用于诊断启动失败的原因
"""

import sys
import subprocess
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

def test_start_pdf_home():
    """模拟 gui_launcher.py 的 _start_pdf_home 逻辑"""
    print("=" * 60)
    print("测试 PDF-Home 启动逻辑")
    print("=" * 60)

    try:
        # 读取后端实际使用的端口配置
        runtime_ports_file = PROJECT_ROOT / "logs" / "runtime-ports.json"
        actual_ports = {}

        print(f"\n1. 检查端口配置文件: {runtime_ports_file}")
        print(f"   文件存在: {runtime_ports_file.exists()}")

        if runtime_ports_file.exists():
            try:
                with open(runtime_ports_file, 'r', encoding='utf-8') as f:
                    actual_ports = json.load(f)
                print(f"   ✅ 读取成功: {actual_ports}")
            except Exception as e:
                print(f"   ⚠️ 读取失败: {e}")

        # 构建命令行参数（使用测试参数）
        print("\n2. 构建命令行参数")
        cmd = [sys.executable, "src/frontend/pdf-home/launcher.py"]

        # 模拟 GUI 参数
        gui_params = {
            "vite_port": 3000,
            "msgCenter_port": 8765,
            "pdfFile_port": 8080
        }

        # 优先使用后端实际端口，否则使用GUI配置
        vite_port = actual_ports.get("vite_port") or gui_params.get("vite_port")
        msgCenter_port = actual_ports.get("msgCenter_port") or gui_params.get("msgCenter_port")
        pdfFile_port = actual_ports.get("pdfFile_port") or gui_params.get("pdfFile_port")

        print(f"   Vite端口: {vite_port}")
        print(f"   WebSocket端口: {msgCenter_port}")
        print(f"   HTTP端口: {pdfFile_port}")

        if vite_port:
            cmd.extend(["--vite-port", str(vite_port)])
        if msgCenter_port:
            cmd.extend(["--msgCenter-port", str(msgCenter_port)])
        if pdfFile_port:
            cmd.extend(["--pdfFile-port", str(pdfFile_port)])

        print(f"\n3. 完整命令: {' '.join(cmd)}")

        # 检查 launcher.py 是否存在
        launcher_path = PROJECT_ROOT / "src" / "frontend" / "pdf-home" / "launcher.py"
        print(f"\n4. 检查 launcher.py: {launcher_path}")
        print(f"   文件存在: {launcher_path.exists()}")

        if not launcher_path.exists():
            print(f"   ❌ 错误：launcher.py 不存在！")
            return False

        # 测试启动（不实际运行，只检查命令）
        print("\n5. 测试命令构建")
        print(f"   ✅ 命令构建成功")
        print(f"   Python解释器: {sys.executable}")
        print(f"   工作目录: {PROJECT_ROOT}")

        # 尝试检查导入
        print("\n6. 检查 Python 路径和导入")
        print(f"   Python 版本: {sys.version}")
        print(f"   项目根目录: {PROJECT_ROOT}")

        # 检查是否能访问 launcher.py
        try:
            with open(launcher_path, 'r', encoding='utf-8') as f:
                first_line = f.readline()
                print(f"   launcher.py 首行: {first_line.strip()}")
        except Exception as e:
            print(f"   ⚠️ 无法读取 launcher.py: {e}")

        print("\n" + "=" * 60)
        print("✅ 诊断完成 - 未发现明显错误")
        print("=" * 60)
        return True

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ 发生异常: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_start_pdf_home()
    sys.exit(0 if success else 1)
