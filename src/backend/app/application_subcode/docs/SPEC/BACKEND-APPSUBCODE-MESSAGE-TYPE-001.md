**规范名称**: 消息类型命名规范
**规范描述**: 定义WebSocket消息类型的命名规则和分类，确保消息命名清晰、一致，支持协议扩展和维护
**当前版本**: 1.0
**所属范畴**: 后端通信规范
**适用范围**: WebSocket消息处理相关的所有Python文件

**详细内容**:
- 基础消息类型：使用snake_case格式，如 `get_pdf_list`, `add_pdf`, `remove_pdf`
- 消息前缀模式：使用说明性前缀区分操作类型，如 `pdf_` 前缀用于PDF操作，`websocket_`用于通信操作
- 操作后缀：使用完整英文单词表示操作，如 `request`, `selection`, `detail`
- 响应消息类型：统一使用 `response_success`, `response_error` 格式
- 事件类型：使用 `event_` 前缀的复合命名，如 `event_pdf_added`, `event_connection_lost`
- 命令类型：使用 `command_` 前缀，如 `command_batch_process`, `command_system_shutdown`
- 常量化定义：所有消息类型必须在常量类中定义，使用常量化组管理

**验证方法**:
- 检查消息处理分支是否使用常量而非硬编码字符串
- 使用grep搜索未定义的消息类型字居住
- 验证消息解析器是否能识别所有定义的消息类型
- 检查WebSocket协议文档是否与代码定义同步
- 运行集成测试验证消息收发正常

**正向例子**:
```python
# 消息类型常量定义
class MESSAGE_TYPES:
    # 请求消息
    REQUEST_FILE_SELECTION = 'request_file_selection'
    REQUEST_PDF_LIST = 'get_pdf_list'
    REQUEST_PDF_DETAIL = 'pdf_detail_request'

    # 操作消息
    ADD_PDF_FILE = 'add_pdf'
    REMOVE_PDF_FILE = 'remove_pdf'
    BATCH_REMOVE_PDF = 'batch_remove_pdf'

    # 系统消息
    HEARTBEAT = 'heartbeat'
    CONNECTION_STATUS = 'connection_status'

    # 响应消息
    RESPONSE_SUCCESS = 'response_success'
    RESPONSE_ERROR = 'response_error'

# 使用示例
def handle_message(message):
    msg_type = message.get('type')
    if msg_type == MESSAGE_TYPES.REQUEST_PDF_LIST:
        return self.handle_pdf_list_request(message)
    elif msg_type == MESSAGE_TYPES.ADD_PDF_FILE:
        return self.handle_pdf_add(message)
```

**反向例子**:
```python
# 错误做法：不规范的命名
message_types = {
    'req_fs': 'req_fs',              # 缩写不清
    'addpdf': 'addpdf',              # 无下划线分隔
    'removepdffile': 'removepdffile', # 单词粘连
    'GET_PDF_DETAILS': 'GET_PDF_DETAILS'  # 大写格式不一致
}

# 硬编码判断示例
def bad_process_message(msg):
    if msg['type'] == 'req_fs':  # 命名不清，无法理解意图
        pass
    elif msg['type'] == 'addpdf':  # 缺乏结构化命名
        pass
```

**规范要点**:
- 消息类型必须使用snake_case命名格式
- 单词间使用下划线分隔，不使用空格或连字符
- 使用描述性前缀区分消息功能分类
- 避免缩写，使用完整英文单词
- 所有消息类型必须在常量类中定义和引用