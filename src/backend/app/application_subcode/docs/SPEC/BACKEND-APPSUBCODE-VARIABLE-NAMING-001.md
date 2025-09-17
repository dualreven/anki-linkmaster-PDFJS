**规范名称**: 变量常量使用规范
**规范描述**: 定义application_subcode模块中变量、常量、类属性的命名规则，确保代码风格统一，改善可读性和维护性
**当前版本**: 1.0
**所属范畴**: 后端命名规范
**适用范围**: src/backend/app/application_subcode 目录下的所有Python文件

**详细内容**:
- 变量命名：使用snake_case格式，全小写字母，单词间用下划线分隔，如 `pdf_manager`, `response_data`
- 常量命名：使用ALL_CAPS格式，大写字母加下划线分隔，如 `DEFAULT_PORT`, `ERROR_MAPPING`
- 实例变量：以self开头，使用snake_case，如 `self.websocket_server`, `self.error_mapping`
- 谜下划线：私有方法或变量使用单下划线前缀，如 `_internal_method`
- 布尔变量：使用 `is_`, `has_`, `can_` 前缀，如 `is_connected`, `has_error`
- 列表/字典：变量名使用复数形式，如 `selected_files`, `error_mapping`
- 模块级常量：定义在模块顶部的常量，使用ALL_CAPS

**验证方法**:
- 使用pylint或flake8检查命名风格违规
- 通过AST分析检查变量命名是否符合snake_case
- 审查常量定义是否使用了ALL_CAPS格式
- 检查布尔变量是否使用了适当的前缀
- 运行代码检查是否有运行时命名相关错误

**正向例子**:
```python
# 正确示例
DEFAULT_PORT = 3000
MILLISECONDS_PER_SECOND = 1000

class WebSocketHandlers:
    def __init__(self, app_instance, response_handlers):
        self.app_instance = app_instance
        self.response_handlers = response_handlers
        self.is_connected = False
        self._internal_config = {}

    def send_response(self, websocket_client, response_data, request_id=None):
        message_data = {
            'type': 'response',
            'timestamp': time.time(),
            'request_id': request_id,
            'data': response_data
        }
        # 发送逻辑...
```

**反向例子**:
```python
# 错误示例
defaultport = 3000                    # 变量名错误，应使用下划线分隔
ErrorMapping = {}                     # 常量错误，应全大写
default_port = 3000                   # 常量命名错误，不应该使用小写

class BadExample:
    def __init__(self):
        self.AppInstance = None         # 实例变量错误，应使用snake_case
        self.response_handlers = None   # 正确
        self.isconnected = False       # 布尔变量错误，缺少下划线
        self._InternalConfig = {}      # 私有变量错误，使用Pascal命名

    def SendResponse(self, client, data):  # 方法命名错误，应snake_case
        # 方法实现
```

**规范要点**:
- 变量使用snake_case，单词间严格使用下划线
- 常量必须ALL_CAPS格式，不得混用大小写
- 实例变量始终使用self.前缀
- 布尔变量使用is_/has_/can_前缀
- 私有成员使用单下划线前缀