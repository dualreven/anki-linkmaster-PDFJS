import pytest
from unittest.mock import Mock

from ...plugin.event_bus import EventBus
from ..pdf_info_plugin import PDFInfoTablePlugin
from ..pdf_bookanchor_plugin import PDFBookanchorTablePlugin


def test_pdf_info_create_table_emits_kebab_event():
    # 准备
    executor = Mock()
    event_bus = EventBus()
    received = []

    def handler(data):
        received.append(data)

    # 订阅符合规范的事件名
    event_bus.on('table:pdf-info:create:completed', handler, 'test-subscriber')

    plugin = PDFInfoTablePlugin(executor, event_bus)

    # 动作：创建表将触发事件
    plugin.create_table()

    # 断言：收到一次事件
    assert len(received) == 1
    # data 可能为 None（仅验证路由是否成功）


def test_pdf_bookanchor_create_table_emits_kebab_event():
    # 准备
    executor = Mock()
    event_bus = EventBus()
    received = []

    def handler(data):
        received.append(data)

    # 订阅符合规范的事件名
    event_bus.on('table:pdf-bookanchor:create:completed', handler, 'test-subscriber')

    plugin = PDFBookanchorTablePlugin(executor, event_bus)

    # 动作：创建表将触发事件
    plugin.create_table()

    # 断言：收到一次事件
    assert len(received) == 1

