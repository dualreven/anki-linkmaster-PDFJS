#!/usr/bin/env python3
"""
前后端集成测试脚本

用法:
    python test_frontend_backend_integration.py --host localhost --port 8765

功能:
    1. WebSocket 连接测试
    2. 消息格式验证
    3. 字段命名一致性检查
    4. 数据类型验证
    5. 业务流程测试
"""

import asyncio
import websockets
import json
import re
from typing import Dict, Any, List, Tuple
from datetime import datetime
import argparse
from test_message_schemas import (
    PDF_RECORD_SCHEMA,
    WEBSOCKET_MESSAGE_SCHEMA,
    FRONTEND_TO_BACKEND_MESSAGES,
    BACKEND_TO_FRONTEND_MESSAGES,
    NAMING_RULES,
    TIMESTAMP_FORMAT
)


class MessageValidator:
    """消息验证器"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_naming(self, field_name: str, expected_style: str = 'snake_case') -> bool:
        """验证字段命名风格"""
        if expected_style == 'snake_case':
            pattern = r'^[a-z][a-z0-9_]*$'
            if not re.match(pattern, field_name):
                self.errors.append(f"字段 '{field_name}' 不符合 snake_case 规范")
                return False
        elif expected_style == 'camelCase':
            pattern = r'^[a-z][a-zA-Z0-9]*$'
            if not re.match(pattern, field_name):
                self.errors.append(f"字段 '{field_name}' 不符合 camelCase 规范")
                return False
        return True

    def validate_type(self, value: Any, expected_type: type, field_name: str) -> bool:
        """验证数据类型"""
        if not isinstance(value, expected_type):
            self.errors.append(
                f"字段 '{field_name}' 类型错误: 期望 {expected_type.__name__}, "
                f"实际 {type(value).__name__}"
            )
            return False
        return True

    def validate_timestamp(self, timestamp: int, field_name: str) -> bool:
        """验证时间戳格式（Unix秒）"""
        min_ts, max_ts = TIMESTAMP_FORMAT['range']
        if not (min_ts <= timestamp <= max_ts):
            self.errors.append(
                f"字段 '{field_name}' 时间戳超出合理范围: {timestamp}"
            )
            return False
        return True

    def validate_pdf_record(self, record: Dict[str, Any]) -> bool:
        """验证 PDF 记录格式"""
        valid = True

        for field_name, expected_type in PDF_RECORD_SCHEMA.items():
            # 检查字段是否存在
            if field_name not in record:
                self.errors.append(f"PDF 记录缺少字段: {field_name}")
                valid = False
                continue

            # 验证命名规范
            if not self.validate_naming(field_name, 'snake_case'):
                valid = False

            # 验证数据类型
            value = record[field_name]
            if not self.validate_type(value, expected_type, field_name):
                valid = False

            # 验证时间戳字段
            if field_name.endswith('_at') or field_name == 'due_date':
                if isinstance(value, int) and value > 0:
                    if not self.validate_timestamp(value, field_name):
                        valid = False

        return valid

    def validate_message_structure(self, message: Dict[str, Any]) -> bool:
        """验证消息基本结构"""
        valid = True

        # 验证必需字段
        if 'type' not in message:
            self.errors.append("消息缺少 'type' 字段")
            valid = False

        if 'data' not in message:
            self.errors.append("消息缺少 'data' 字段")
            valid = False

        # 验证类型
        if 'type' in message:
            if not self.validate_type(message['type'], str, 'type'):
                valid = False

        if 'data' in message:
            if not self.validate_type(message['data'], dict, 'data'):
                valid = False

        return valid

    def get_report(self) -> str:
        """生成验证报告"""
        report = []
        report.append("=" * 80)
        report.append("消息验证报告")
        report.append("=" * 80)

        if self.errors:
            report.append(f"\n❌ 错误 ({len(self.errors)} 个):")
            for i, error in enumerate(self.errors, 1):
                report.append(f"  {i}. {error}")
        else:
            report.append("\n✅ 无错误")

        if self.warnings:
            report.append(f"\n⚠️  警告 ({len(self.warnings)} 个):")
            for i, warning in enumerate(self.warnings, 1):
                report.append(f"  {i}. {warning}")

        report.append("\n" + "=" * 80)
        return "\n".join(report)


class IntegrationTester:
    """集成测试器"""

    def __init__(self, host: str = 'localhost', port: int = 8765):
        self.ws_url = f"ws://{host}:{port}/"
        self.validator = MessageValidator()
        self.test_results = []

    async def connect(self) -> websockets.WebSocketClientProtocol:
        """连接到 WebSocket 服务器"""
        try:
            websocket = await websockets.connect(self.ws_url)
            print(f"✅ 成功连接到 {self.ws_url}")
            return websocket
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            raise

    async def send_and_receive(
        self,
        websocket: websockets.WebSocketClientProtocol,
        message: Dict[str, Any],
        timeout: float = 5.0
    ) -> Dict[str, Any]:
        """发送消息并接收响应"""
        # 发送消息
        message_str = json.dumps(message)
        print(f"\n📤 发送: {message_str}")
        await websocket.send(message_str)

        # 接收响应
        try:
            response_str = await asyncio.wait_for(
                websocket.recv(),
                timeout=timeout
            )
            response = json.loads(response_str)
            print(f"📥 接收: {json.dumps(response, ensure_ascii=False)}")
            return response
        except asyncio.TimeoutError:
            print(f"⏱️  超时: 等待响应超过 {timeout} 秒")
            raise

    async def test_pdf_list(self, websocket):
        """测试 PDF 列表获取"""
        print("\n" + "="*80)
        print("测试: PDF 列表获取 (pdf/list)")
        print("="*80)

        # 发送请求
        request = {
            'type': 'pdf/list',
            'data': {}
        }

        response = await self.send_and_receive(websocket, request)

        # 验证响应结构
        self.validator.validate_message_structure(response)

        # 验证响应类型
        if response.get('type') == 'pdf/list':
            # 验证 records 字段
            if 'records' in response.get('data', {}):
                records = response['data']['records']
                print(f"\n📊 收到 {len(records)} 条 PDF 记录")

                # 验证每条记录
                for i, record in enumerate(records):
                    print(f"\n验证记录 #{i+1}: {record.get('filename', 'unknown')}")
                    self.validator.validate_pdf_record(record)
            else:
                self.validator.errors.append("响应缺少 'records' 字段")
        else:
            self.validator.errors.append(
                f"响应类型错误: 期望 'pdf/list', 实际 '{response.get('type')}'"
            )

    async def test_pdf_open(self, websocket, pdf_id: str = None, filename: str = None):
        """测试 PDF 打开"""
        print("\n" + "="*80)
        print("测试: PDF 打开 (pdf/open)")
        print("="*80)

        request = {
            'type': 'pdf/open',
            'data': {}
        }

        if pdf_id:
            request['data']['id'] = pdf_id
        if filename:
            request['data']['filename'] = filename

        try:
            response = await self.send_and_receive(websocket, request)
            self.validator.validate_message_structure(response)
        except Exception as e:
            print(f"⚠️  测试跳过: {e}")

    async def run_all_tests(self):
        """运行所有测试"""
        try:
            websocket = await self.connect()

            # 测试 PDF 列表
            await self.test_pdf_list(websocket)

            # 可以添加更多测试...
            # await self.test_pdf_open(websocket, filename="test.pdf")

            await websocket.close()

        except Exception as e:
            print(f"\n❌ 测试失败: {e}")

        # 打印报告
        print(self.validator.get_report())


async def main():
    parser = argparse.ArgumentParser(description='前后端集成测试')
    parser.add_argument('--host', default='localhost', help='WebSocket 服务器地址')
    parser.add_argument('--port', type=int, default=8765, help='WebSocket 服务器端口')

    args = parser.parse_args()

    tester = IntegrationTester(host=args.host, port=args.port)
    await tester.run_all_tests()


if __name__ == '__main__':
    asyncio.run(main())
