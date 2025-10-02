"""
调试WebSocket消息 - 查看实际发送给前端的数据
"""
import json
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.backend.pdf_manager.manager import PDFManager
from src.backend.msgCenter_server.standard_protocol import PDFMessageBuilder

def debug_websocket_message():
    """调试WebSocket消息格式"""

    print("\n" + "="*70)
    print("调试 WebSocket 消息格式")
    print("="*70 + "\n")

    # 创建管理器
    manager = PDFManager(data_dir="data")

    # 获取文件列表
    files = manager.get_files()
    print(f"📊 PDFManager.get_files() 返回 {len(files)} 条记录\n")

    if files:
        # 显示第一条记录
        first = files[0]
        print("="*70)
        print("第一条记录的字段:")
        print("="*70)
        for key, value in first.items():
            print(f"{key:25s} = {value}")

        print("\n" + "="*70)
        print("检查扩展字段:")
        print("="*70)

        extended_fields = {
            'last_accessed_at': '上次访问时间',
            'review_count': '复习次数',
            'rating': '评分',
            'tags': '标签',
            'is_visible': '可见性',
            'total_reading_time': '学习时长',
            'due_date': '截止日期'
        }

        for field, name in extended_fields.items():
            exists = field in first
            value = first.get(field, 'MISSING')
            status = "✓" if exists else "✗"
            print(f"{status} {name:12s} ({field:20s}) = {value}")

        # 构建WebSocket消息（模拟后端发送）
        print("\n" + "="*70)
        print("WebSocket 消息格式 (pdf:list:updated):")
        print("="*70)

        ws_message = PDFMessageBuilder.build_pdf_list_response("test-request-id", files)
        print(json.dumps(ws_message, indent=2, ensure_ascii=False))

        # 检查消息中的第一条记录
        if ws_message.get('data') and ws_message['data'].get('files'):
            ws_first = ws_message['data']['files'][0]
            print("\n" + "="*70)
            print("WebSocket消息中第一条记录的扩展字段:")
            print("="*70)

            for field, name in extended_fields.items():
                exists = field in ws_first
                value = ws_first.get(field, 'MISSING')
                status = "✓" if exists else "✗"
                print(f"{status} {name:12s} ({field:20s}) = {value}")

            if all(field in ws_first for field in extended_fields.keys()):
                print("\n✅ WebSocket消息包含所有扩展字段！")
            else:
                missing = [f for f in extended_fields.keys() if f not in ws_first]
                print(f"\n❌ WebSocket消息缺少以下字段: {missing}")


if __name__ == '__main__':
    debug_websocket_message()
