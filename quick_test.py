#!/usr/bin/env python3
"""
快速测试脚本 - 简化版

用法:
    python quick_test.py              # 默认端口 8765
    python quick_test.py 8790         # 指定端口
"""

import asyncio
import websockets
import json
import sys


async def quick_test(port=8765):
    """快速测试前后端连通性"""
    ws_url = f"ws://localhost:{port}/"

    print(f"🔌 连接到 {ws_url}...")

    try:
        async with websockets.connect(ws_url) as ws:
            print("✅ 连接成功!\n")

            # 测试1: PDF列表
            print("📋 测试1: 获取PDF列表")
            request = {"type": "pdf-library:list:records", "data": {}}
            await ws.send(json.dumps(request))
            print(f"  发送: {request}")

            response = await ws.recv()
            data = json.loads(response)
            print(f"  收到: {data['type']}")

            # 简单验证
            issues = []

            # 检查消息结构
            if 'type' not in data:
                issues.append("❌ 缺少 'type' 字段")
            if 'data' not in data:
                issues.append("❌ 缺少 'data' 字段")

            # 检查记录格式
            if 'records' in data.get('data', {}):
                records = data['data']['records']
                print(f"  📊 找到 {len(records)} 条记录\n")

                if records:
                    first_record = records[0]
                    print("  检查第一条记录格式:")

                    # 检查必需字段
                    required_fields = [
                        'id', 'filename', 'file_path', 'file_size',
                        'page_count', 'created_at'
                    ]

                    for field in required_fields:
                        if field in first_record:
                            value = first_record[field]
                            print(f"    ✅ {field}: {type(value).__name__} = {value}")
                        else:
                            print(f"    ❌ 缺少字段: {field}")
                            issues.append(f"缺少字段: {field}")

                    # 检查命名规范
                    for field in first_record.keys():
                        if not field.islower() or ('_' not in field and len(field) > 2):
                            # 简单检查：全小写且包含下划线（除了id等短字段）
                            if field not in ['id']:  # 例外列表
                                if any(c.isupper() for c in field):
                                    issues.append(f"字段命名不规范（应为snake_case）: {field}")
                                    print(f"    ⚠️  命名警告: {field}")

            print("\n" + "="*60)
            if issues:
                print("⚠️  发现问题:")
                for issue in issues:
                    print(f"  - {issue}")
            else:
                print("✅ 所有检查通过!")
            print("="*60)

    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket错误: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析错误: {e}")
    except Exception as e:
        print(f"❌ 未知错误: {e}")


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    asyncio.run(quick_test(port))
