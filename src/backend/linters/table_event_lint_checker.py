"""
Pylint 自定义检查器：禁止在 EventBus 调用中使用字符串字面量

规则名称: table-event-string-literal
级别: error
消息: E9001

检查范围:
- event_bus.on(event_name, ...)
- event_bus.emit(event_name, ...)
- event_bus.once(event_name, ...)

要求:
- 必须使用 TableEventConstants.* 或 TableEvents.*_event() 方法
- 禁止使用字符串字面量（包括 f-string、模板字符串）

白名单:
- 测试文件（__tests__/ 或 test_*.py）可使用 # pylint: disable=table-event-string-literal
- event_bus.py 自身
- table_event_constants.py

创建日期: 2025-11-10
版本: v1.0
"""

try:
    import astroid
    from pylint.checkers import BaseChecker
    PYLINT_AVAILABLE = True
except ImportError:
    # Pylint 未安装，定义空实现
    PYLINT_AVAILABLE = False
    BaseChecker = object


if PYLINT_AVAILABLE:
    class TableEventStringLiteralChecker(BaseChecker):
        """
        检查 EventBus 调用中的事件名称参数，禁止使用字符串字面量

        兼容 Pylint 4.0+（移除了 IAstroidChecker 接口）
        """

        name = 'table-event-string-literal'
        priority = -1  # 高优先级

        msgs = {
            'E9001': (
                'EventBus 方法不得使用字符串字面量作为事件名，��使用 TableEventConstants.%s',
                'table-event-string-literal',
                '在 event_bus.on()/emit()/once() 调用中检测到字符串字面量。'
                '请使用 TableEventConstants 中的常量代替。\n'
                '示例：\n'
                '  ❌ event_bus.emit("table:pdf-info:create:completed", data)\n'
                '  ✅ from src.backend.database.plugin import TableEventConstants\n'
                '     event_bus.emit(TableEventConstants.PDFInfo.CREATE_COMPLETED, data)'
            ),
        }

        # 需要检查的方法名
        CHECKED_METHODS = {'on', 'emit', 'once'}

        # 白名单文件（不检查这些文件）
        WHITELIST_FILES = {
            'event_bus.py',
            'table_event_constants.py',
        }

        def visit_call(self, node):
            """
            访问函数调用节点，检查 event_bus 方法调用
            """
            # 检查是否是方法调用（obj.method()）
            if not isinstance(node.func, astroid.Attribute):
                return

            method_name = node.func.attrname

            # 检查是否是我们关心的方法
            if method_name not in self.CHECKED_METHODS:
                return

            # 检查调用者是否是 event_bus 或 self._event_bus
            if not self._is_event_bus_call(node.func):
                return

            # 检查第一个参数（event_name）
            if not node.args:
                return  # 没有参数，跳过

            first_arg = node.args[0]

            # 检查是否是字符串字面量
            if self._is_string_literal(first_arg):
                # 文件白名单检查
                if self._is_whitelisted_file(node):
                    return

                # 提取建议的常量名称
                suggested_constant = self._suggest_constant(first_arg)

                self.add_message(
                    'table-event-string-literal',
                    node=first_arg,
                    args=(suggested_constant,)
                )

        def _is_event_bus_call(self, func_node):
            """
            检查是否是 event_bus 的方法调用

            识别模式:
            - event_bus.on(...)
            - self._event_bus.emit(...)
            - self.event_bus.once(...)
            """
            if not isinstance(func_node.expr, (astroid.Name, astroid.Attribute)):
                return False

            # 简单名称检查（event_bus.xxx）
            if isinstance(func_node.expr, astroid.Name):
                return 'event_bus' in func_node.expr.name.lower()

            # 属性访问检查（self._event_bus.xxx）
            if isinstance(func_node.expr, astroid.Attribute):
                return 'event_bus' in func_node.expr.attrname.lower()

            return False

        def _is_string_literal(self, node):
            """
            检查节点是否是字符串字面量

            包括：
            - 普通字符串: 'table:pdf-info:create:completed'
            - f-string: f'table:{table_name}:create:completed'
            - 拼接字符串: 'table:' + table_name + ':create:completed'
            """
            # 普通字符串常量
            if isinstance(node, astroid.Const) and isinstance(node.value, str):
                # 检查是否是 table:xxx 格式
                if node.value.startswith('table:'):
                    return True

            # f-string (JoinedStr)
            if isinstance(node, astroid.JoinedStr):
                # 检查是否包含 table: 前缀
                for value in node.values:
                    if isinstance(value, astroid.Const) and 'table:' in str(value.value):
                        return True

            # 字符串拼接 (BinOp with +)
            if isinstance(node, astroid.BinOp) and node.op == '+':
                left_is_str = self._is_string_literal(node.left)
                right_is_str = self._is_string_literal(node.right)
                if left_is_str or right_is_str:
                    return True

            return False

        def _is_whitelisted_file(self, node):
            """
            检查当前文件是否在白名单中
            """
            file_path = node.root().file

            # 检查文件名白名单
            for whitelist_file in self.WHITELIST_FILES:
                if file_path.endswith(whitelist_file):
                    return True

            # 检查是否是测试文件（测试文件不在白名单，需要显式 disable）
            if '/__tests__/' in file_path or '/test_' in file_path:
                return False

            return False

        def _suggest_constant(self, node):
            """
            根据字符串字面量建议对应的常量名称

            Example:
                'table:pdf-info:create:completed' -> 'PDFInfo.CREATE_COMPLETED'
            """
            if isinstance(node, astroid.Const) and isinstance(node.value, str):
                event_name = node.value

                # 解析事件名称: table:{table-name}:{action}:{status}
                parts = event_name.split(':')
                if len(parts) == 4 and parts[0] == 'table':
                    table_name = parts[1]  # pdf-info
                    action = parts[2]       # create
                    status = parts[3]       # completed

                    # 转换为常量名称
                    # pdf-info -> PDFInfo
                    class_name = ''.join(word.capitalize() for word in table_name.split('-'))
                    # create + completed -> CREATE_COMPLETED
                    constant_name = f"{action.upper()}_{status.upper()}"

                    return f"{class_name}.{constant_name}"

            return '<TableName>.<ACTION>_<STATUS>'


def register(linter):
    """
    Pylint 注册函数
    """
    if PYLINT_AVAILABLE:
        linter.register_checker(TableEventStringLiteralChecker(linter))
    else:
        import warnings
        warnings.warn(
            "Pylint is not installed. TableEventStringLiteralChecker will not be available."
        )
