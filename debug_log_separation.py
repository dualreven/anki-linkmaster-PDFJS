#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试脚本：跟踪日志分离问题
监控所有日志文件变化，特别关注PDF特定日志文件的创建
"""

import os
import time
import glob
from pathlib import Path

def monitor_logs():
    """监控日志目录的所有变化"""
    logs_dir = Path("logs")

    print("🔍 开始监控日志分离功能...")
    print("请按以下步骤测试：")
    print("1. 启动应用: python ai-launcher.py start")
    print("2. 在 pdf-home 中双击任意PDF文件")
    print("3. 观察是否创建了PDF特定的日志文件")
    print("4. 按 Ctrl+C 停止监控")
    print("-" * 60)

    # 初始状态
    initial_files = set(logs_dir.glob("*.log"))
    print(f"初始日志文件 ({len(initial_files)} 个):")

    # 跟踪文件大小
    file_sizes = {}
    for f in sorted(initial_files):
        size = f.stat().st_size if f.exists() else 0
        file_sizes[str(f)] = size
        print(f"  📄 {f.name} ({size} bytes)")
    print()

    try:
        while True:
            time.sleep(1)  # 每秒检查一次

            # 获取当前所有日志文件
            current_files = set(logs_dir.glob("*.log"))

            # 检查新创建的文件
            new_files = current_files - initial_files
            if new_files:
                for new_file in new_files:
                    size = new_file.stat().st_size if new_file.exists() else 0
                    file_sizes[str(new_file)] = size
                    print(f"🆕 新创建: {new_file.name} ({size} bytes)")

                    # 特别关注PDF特定日志
                    if "pdf-viewer-" in new_file.name:
                        print(f"   🎯 PDF特定日志文件已创建！")

                initial_files = current_files

            # 检查文件大小变化（只检查更新的文件）
            for log_file in current_files:
                if log_file.exists():
                    current_size = log_file.stat().st_size
                    file_path_str = str(log_file)
                    if file_path_str in file_sizes:
                        if current_size > file_sizes[file_path_str]:
                            growth = current_size - file_sizes[file_path_str]
                            print(f"📈 {log_file.name}: +{growth} bytes (总计 {current_size} bytes)")
                    file_sizes[file_path_str] = current_size

    except KeyboardInterrupt:
        print("\n🛑 监控停止")

        # 最终报告
        print("\n📊 最终状态:")
        final_files = list(logs_dir.glob("*.log"))

        # 分类显示
        pdf_specific_logs = [f for f in final_files if "pdf-viewer-" in f.name]
        general_logs = [f for f in final_files if "pdf-viewer-" not in f.name]

        print(f"\n📁 通用日志文件 ({len(general_logs)} 个):")
        for f in sorted(general_logs):
            size = f.stat().st_size if f.exists() else 0
            print(f"  📄 {f.name} ({size} bytes)")

        if pdf_specific_logs:
            print(f"\n🎯 PDF特定日志文件 ({len(pdf_specific_logs)} 个):")
            for f in sorted(pdf_specific_logs):
                size = f.stat().st_size if f.exists() else 0
                # 从文件名提取PDF ID
                pdf_id = f.name.replace("pdf-viewer-", "").replace(".log", "")
                print(f"  🔸 {f.name} → PDF ID: {pdf_id} ({size} bytes)")
        else:
            print("\n❌ 没有发现PDF特定日志文件")
            print("   可能的原因:")
            print("   - PDF加载失败（检查是否有403错误）")
            print("   - 前端通知未发送（检查WebSocket连接）")
            print("   - 后端处理失败（检查app.log中的错误信息）")

if __name__ == "__main__":
    monitor_logs()