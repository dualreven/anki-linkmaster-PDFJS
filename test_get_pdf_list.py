#!/usr/bin/env python3
"""
测试get_pdf_list消息的发送和处理
"""
import asyncio
import websockets
import json
import time

async def test_get_pdf_list():
    """发送get_pdf_list消息测试"""
    uri = "ws://localhost:8765"

    try:
        async with websockets.connect(uri) as websocket:
            print("WebSocket连接成功")

            # 发送get_pdf_list消息（没有request_id）
            message = {
                "type": "get_pdf_list",
                "data": {},
                "timestamp": int(time.time() * 1000)
            }

            print(f"发送消息: {json.dumps(message, ensure_ascii=False)}")
            await websocket.send(json.dumps(message))

            # 等待响应
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"收到响应: {response}")
            except asyncio.TimeoutError:
                print("等待响应超时")

    except Exception as e:
        print(f"连接失败: {e}")

if __name__ == "__main__":
    asyncio.run(test_get_pdf_list())