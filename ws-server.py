#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立的WebSocket消息路由服务器
遵循项目的JSON消息格式规范和通信标准
负责在前端和后端模块之间转发消息，不处理具体业务逻辑
"""

import asyncio
import websockets
import json
import logging
import time
import uuid
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Set, Optional, Any
import traceback


class WebSocketMessageRouter:
    """
    WebSocket消息路由器
    遵循JSON-MESSAGE-FORMAT-001规范处理所有消息
    """

    def __init__(self, host="127.0.0.1", port=8765, log_file="logs/ws-server.log"):
        self.host = host
        self.port = port
        self.log_file = Path(log_file)

        # 连接管理
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.client_modules: Dict[websockets.WebSocketServerProtocol, str] = {}
        self.client_pdf_ids: Dict[websockets.WebSocketServerProtocol, Optional[str]] = {}

        # 日志设置
        self._setup_logging()

        # 启动标记
        self.running = False

    def _setup_logging(self):
        """设置日志系统"""
        # 确保日志目录存在
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        # 配置日志格式
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )

        self.logger = logging.getLogger("ws-server")

        # 清空日志文件并写入启动标记
        with open(self.log_file, 'w', encoding='utf-8') as f:
            timestamp = datetime.now(timezone.utc).isoformat()
            f.write(f'{timestamp} [INFO] ws-server: WebSocket消息路由服务器启动\n')

    def _validate_message_format(self, message: Dict[str, Any]) -> bool:
        """
        验证消息格式是否符合JSON-MESSAGE-FORMAT-001规范
        """
        required_fields = ['type', 'timestamp', 'request_id', 'data']

        for field in required_fields:
            if field not in message:
                return False

        # 验证字段类型
        if not isinstance(message['type'], str):
            return False
        if not isinstance(message['timestamp'], (int, float)):
            return False
        if not isinstance(message['request_id'], str):
            return False
        if not isinstance(message['data'], dict):
            return False

        return True

    def _create_response_message(self, request_id: str, status: str, code: int,
                               message: str = "", data: Dict = None,
                               error: Dict = None) -> Dict[str, Any]:
        """
        创建符合规范的响应消息
        """
        return {
            "type": "response",
            "timestamp": time.time(),
            "request_id": request_id,
            "status": status,
            "code": code,
            "message": message,
            "data": data or {},
            "error": error
        }

    def _log_message_route(self, direction: str, client_info: str, message_type: str,
                          module: str = None, pdf_id: str = None):
        """
        记录消息路由日志
        """
        module_info = f" module={module}" if module else ""
        pdf_info = f" pdf_id={pdf_id}" if pdf_id else ""

        self.logger.info(f"[ROUTE] {direction} {client_info}: {message_type}{module_info}{pdf_info}")

    async def register_client(self, websocket: websockets.WebSocketServerProtocol,
                            message: Dict[str, Any]):
        """
        注册客户端模块信息
        """
        module = message['data'].get('module', 'unknown')
        pdf_id = message['data'].get('pdf_id')

        self.client_modules[websocket] = module
        self.client_pdf_ids[websocket] = pdf_id

        # 记录客户端注册
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self._log_message_route("REGISTER", client_info, "client_register", module, pdf_id)

        # 发送注册确认
        response = self._create_response_message(
            message['request_id'],
            "success",
            200,
            "Client registered successfully",
            {"registered": True, "module": module, "pdf_id": pdf_id}
        )

        await websocket.send(json.dumps(response))

    async def route_message(self, sender: websockets.WebSocketServerProtocol,
                          message: Dict[str, Any]):
        """
        路由消息到目标客户端
        """
        target_module = message['data'].get('target_module')
        target_pdf_id = message['data'].get('target_pdf_id')

        # 查找目标客户端
        target_clients = []
        for client, client_module in self.client_modules.items():
            if client == sender:
                continue

            if target_module and client_module == target_module:
                # 如果指定了PDF ID，需要匹配
                if target_pdf_id:
                    if self.client_pdf_ids.get(client) == target_pdf_id:
                        target_clients.append(client)
                else:
                    target_clients.append(client)
            elif not target_module:
                # 广播到所有其他客户端
                target_clients.append(client)

        # 记录路由信息
        sender_info = f"{sender.remote_address[0]}:{sender.remote_address[1]}"
        sender_module = self.client_modules.get(sender, 'unknown')

        if target_clients:
            for target_client in target_clients:
                try:
                    await target_client.send(json.dumps(message))

                    target_info = f"{target_client.remote_address[0]}:{target_client.remote_address[1]}"
                    target_module_name = self.client_modules.get(target_client, 'unknown')

                    self._log_message_route(
                        f"{sender_info}({sender_module}) -> {target_info}({target_module_name})",
                        "route",
                        message['type'],
                        target_module,
                        target_pdf_id
                    )

                except websockets.exceptions.ConnectionClosed:
                    # 移除断开的客户端
                    await self.unregister_client(target_client)
        else:
            # 没有找到目标客户端
            self.logger.warning(f"[ROUTE] No target found for message from {sender_info}: "
                              f"target_module={target_module}, target_pdf_id={target_pdf_id}")

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """
        处理客户端连接
        """
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self.logger.info(f"[CONNECTION] Client connected: {client_info}")

        # 添加到客户端列表
        self.clients.add(websocket)

        try:
            async for message_raw in websocket:
                try:
                    # 解析JSON消息
                    message = json.loads(message_raw)

                    # 验证消息格式
                    if not self._validate_message_format(message):
                        error_response = self._create_response_message(
                            message.get('request_id', str(uuid.uuid4())),
                            "error",
                            400,
                            "Invalid message format",
                            error={"details": "Message does not conform to JSON-MESSAGE-FORMAT-001"}
                        )
                        await websocket.send(json.dumps(error_response))
                        continue

                    # 处理特殊消息类型
                    if message['type'] == 'client_register':
                        await self.register_client(websocket, message)
                    elif message['type'] == 'ping':
                        # 处理心跳
                        pong_response = self._create_response_message(
                            message['request_id'],
                            "success",
                            200,
                            "pong",
                            {"timestamp": time.time()}
                        )
                        await websocket.send(json.dumps(pong_response))
                    else:
                        # 路由其他消息
                        await self.route_message(websocket, message)

                except json.JSONDecodeError:
                    self.logger.error(f"[ERROR] Invalid JSON from {client_info}: {message_raw}")
                except Exception as e:
                    self.logger.error(f"[ERROR] Error handling message from {client_info}: {e}")
                    traceback.print_exc()

        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"[CONNECTION] Client disconnected: {client_info}")
        except Exception as e:
            self.logger.error(f"[ERROR] Connection error with {client_info}: {e}")
        finally:
            await self.unregister_client(websocket)

    async def unregister_client(self, websocket: websockets.WebSocketServerProtocol):
        """
        注销客户端
        """
        if websocket in self.clients:
            self.clients.remove(websocket)

        if websocket in self.client_modules:
            module = self.client_modules.pop(websocket)
            pdf_id = self.client_pdf_ids.pop(websocket, None)

            client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
            self._log_message_route("UNREGISTER", client_info, "client_unregister", module, pdf_id)

    async def start_server(self):
        """
        启动WebSocket服务器
        """
        self.logger.info(f"Starting WebSocket server on {self.host}:{self.port}")

        self.running = True

        async with websockets.serve(self.handle_client, self.host, self.port) as server:
            self.logger.info(f"WebSocket server started successfully on ws://{self.host}:{self.port}")

            # 等待服务器运行
            await asyncio.Future()  # 永远等待

    def stop_server(self):
        """
        停止服务器
        """
        self.running = False
        self.logger.info("WebSocket server stopping...")


async def main():
    """
    主函数
    """
    parser = argparse.ArgumentParser(description="WebSocket消息路由服务器")
    parser.add_argument("--host", default="127.0.0.1", help="服务器地址")
    parser.add_argument("--port", type=int, default=8765, help="服务器端口")
    parser.add_argument("--log-file", default="logs/ws-server.log", help="日志文件路径")

    args = parser.parse_args()

    # 创建并启动服务器
    router = WebSocketMessageRouter(args.host, args.port, args.log_file)

    try:
        await router.start_server()
    except KeyboardInterrupt:
        print("\n收到中断信号，正在停止服务器...")
        router.stop_server()
    except Exception as e:
        print(f"服务器启动失败: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))