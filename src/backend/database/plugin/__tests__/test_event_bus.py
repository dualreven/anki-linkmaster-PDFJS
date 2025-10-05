"""
事件总线测试

测试 EventBus 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest

from ..event_bus import EventBus, TableEvents, EventStatus


class TestEventBus:
    """事件总线测试类"""

    def test_create_event_bus(self):
        """测试：创建事件总线"""
        bus = EventBus()
        assert bus is not None

    def test_subscribe_and_emit_event(self):
        """测试：订阅和发布事件"""
        bus = EventBus()
        received_data = []

        def handler(data):
            received_data.append(data)

        bus.on('table:pdf-info:create:completed', handler, 'test-plugin')
        bus.emit('table:pdf-info:create:completed', {'uuid': 'abc123'})

        assert len(received_data) == 1
        assert received_data[0] == {'uuid': 'abc123'}

    def test_multiple_handlers(self):
        """测试：多个处理函数"""
        bus = EventBus()
        results = []

        def handler1(data):
            results.append(('handler1', data))

        def handler2(data):
            results.append(('handler2', data))

        bus.on('table:pdf-info:create:completed', handler1, 'plugin1')
        bus.on('table:pdf-info:create:completed', handler2, 'plugin2')
        bus.emit('table:pdf-info:create:completed', 'test')

        assert len(results) == 2
        assert results[0] == ('handler1', 'test')
        assert results[1] == ('handler2', 'test')

    def test_once_handler(self):
        """测试：一次性订阅"""
        bus = EventBus()
        call_count = []

        def handler(data):
            call_count.append(1)

        bus.once('table:pdf-info:create:completed', handler, 'test-plugin')

        # 第一次发布
        bus.emit('table:pdf-info:create:completed', 'test1')
        assert len(call_count) == 1

        # 第二次发布（不应该触发）
        bus.emit('table:pdf-info:create:completed', 'test2')
        assert len(call_count) == 1

    def test_unsubscribe(self):
        """测试：取消订阅"""
        bus = EventBus()
        call_count = []

        def handler(data):
            call_count.append(1)

        bus.on('table:pdf-info:create:completed', handler, 'test-plugin')

        # 第一次发布
        bus.emit('table:pdf-info:create:completed', 'test1')
        assert len(call_count) == 1

        # 取消订阅
        bus.off('table:pdf-info:create:completed', handler, 'test-plugin')

        # 第二次发布（不应该触发）
        bus.emit('table:pdf-info:create:completed', 'test2')
        assert len(call_count) == 1

    def test_clear_specific_event(self):
        """测试：清除特定事件的监听器"""
        bus = EventBus()
        results = []

        def handler(data):
            results.append(data)

        bus.on('table:pdf-info:create:completed', handler, 'test-plugin')
        bus.on('table:pdf-info:update:completed', handler, 'test-plugin')

        # 清除 create 事件
        bus.clear('table:pdf-info:create:completed')

        bus.emit('table:pdf-info:create:completed', 'test1')
        bus.emit('table:pdf-info:update:completed', 'test2')

        assert len(results) == 1
        assert results[0] == 'test2'

    def test_clear_all_events(self):
        """测试：清除所有监听器"""
        bus = EventBus()
        results = []

        def handler(data):
            results.append(data)

        bus.on('table:pdf-info:create:completed', handler, 'test-plugin')
        bus.on('table:pdf-info:update:completed', handler, 'test-plugin')

        # 清除所有监听器
        bus.clear()

        bus.emit('table:pdf-info:create:completed', 'test1')
        bus.emit('table:pdf-info:update:completed', 'test2')

        assert len(results) == 0

    def test_valid_event_names(self):
        """测试：有效的事件名称"""
        bus = EventBus()

        valid_names = [
            'table:pdf-info:create:completed',
            'table:pdf-annotation:update:success',
            'table:pdf-bookmark:delete:failed',
            'table:search-condition:query:started',
        ]

        for name in valid_names:
            # 不应该抛出异常
            bus.on(name, lambda data: None, 'test-plugin')

    def test_invalid_event_names(self):
        """测试：无效的事件名称"""
        bus = EventBus()

        invalid_names = [
            'create:completed',  # 缺少 table: 前缀
            'table:pdfInfo:create:completed',  # 驼峰命名
            'table:pdf-info:created',  # 只有3段
            'table:pdf-info:create:completed:extra',  # 5段
            'table:Pdf-info:create:completed',  # 大写字母开头
            'table:pdf_info:create:completed',  # 使用下划线（应该用连字符）
        ]

        for name in invalid_names:
            with pytest.raises(ValueError) as exc_info:
                bus.on(name, lambda data: None, 'test-plugin')

            assert 'Invalid event name' in str(exc_info.value)

    def test_emit_invalid_event_name(self):
        """测试：发布无效事件名称"""
        bus = EventBus()

        with pytest.raises(ValueError):
            bus.emit('invalid-event-name', 'data')

    def test_handler_error_handling(self):
        """测试：处理函数异常处理"""
        bus = EventBus()

        def error_handler(data):
            raise RuntimeError("Handler error")

        def normal_handler(data):
            pass

        bus.on('table:pdf-info:create:completed', error_handler, 'error-plugin')
        bus.on('table:pdf-info:create:completed', normal_handler, 'normal-plugin')

        # 不应该抛出异常（异常应该被捕获）
        bus.emit('table:pdf-info:create:completed', 'test')

    def test_table_events_helpers(self):
        """测试：TableEvents 辅助函数"""
        assert TableEvents.create_event('pdf-info', 'completed') == 'table:pdf-info:create:completed'
        assert TableEvents.update_event('pdf-info', 'success') == 'table:pdf-info:update:success'
        assert TableEvents.delete_event('pdf-info', 'failed') == 'table:pdf-info:delete:failed'
        assert TableEvents.query_event('pdf-info', 'started') == 'table:pdf-info:query:started'
        assert TableEvents.batch_event('pdf-info', 'insert', 'completed') == 'table:pdf-info:insert:completed'

    def test_event_status_constants(self):
        """测试：EventStatus 常量"""
        assert EventStatus.REQUESTED == 'requested'
        assert EventStatus.STARTED == 'started'
        assert EventStatus.PROGRESS == 'progress'
        assert EventStatus.COMPLETED == 'completed'
        assert EventStatus.SUCCESS == 'success'
        assert EventStatus.FAILED == 'failed'
        assert EventStatus.ERROR == 'error'

    def test_emit_without_data(self):
        """测试：发布事件不带数据"""
        bus = EventBus()
        received_data = []

        def handler(data):
            received_data.append(data)

        bus.on('table:pdf-info:create:completed', handler, 'test-plugin')
        bus.emit('table:pdf-info:create:completed')

        assert len(received_data) == 1
        assert received_data[0] is None

    def test_multiple_once_handlers(self):
        """测试：多个一次性处理函数"""
        bus = EventBus()
        results = []

        def handler1(data):
            results.append('handler1')

        def handler2(data):
            results.append('handler2')

        bus.once('table:pdf-info:create:completed', handler1, 'plugin1')
        bus.once('table:pdf-info:create:completed', handler2, 'plugin2')

        bus.emit('table:pdf-info:create:completed', 'test')

        assert len(results) == 2
        assert 'handler1' in results
        assert 'handler2' in results

        # 第二次发布
        results.clear()
        bus.emit('table:pdf-info:create:completed', 'test')
        assert len(results) == 0

    def test_subscriber_id_required(self):
        """测试：订阅者ID必须提供"""
        bus = EventBus()

        def handler(data):
            pass

        # 空字符串
        with pytest.raises(ValueError) as exc_info:
            bus.on('table:pdf-info:create:completed', handler, '')
        assert 'subscriber_id must be a non-empty string' in str(exc_info.value)

        # None
        with pytest.raises(ValueError):
            bus.on('table:pdf-info:create:completed', handler, None)

    def test_subscriber_id_tracking(self):
        """测试：订阅者ID追踪"""
        bus = EventBus()
        results = []

        def handler1(data):
            results.append(('plugin1', data))

        def handler2(data):
            results.append(('plugin2', data))

        bus.on('table:pdf-info:create:completed', handler1, 'plugin1')
        bus.on('table:pdf-info:create:completed', handler2, 'plugin2')

        bus.emit('table:pdf-info:create:completed', 'test')

        assert len(results) == 2
        # 验证订阅者追踪
        assert results[0][0] == 'plugin1'
        assert results[1][0] == 'plugin2'
