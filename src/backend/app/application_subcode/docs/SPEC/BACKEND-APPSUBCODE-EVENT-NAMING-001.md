- **规范名称**: 后端事件消息命名规范
- **规范描述**: 定义后端事件、消息、信号的标准命名格式，确保事件命名的一致性和可读性，便于事件管理和维护
- **当前版本**: 1.0
- **所属范畴**: 后端编码规范
- **适用范围**: 所有后端Python代码中的事件消息命名
- **详细内容**:
  - 消息类型必须使用snake_case格式，如 `get_pdf_list`, `add_pdf`, `remove_pdf`
  - 禁止使用PascalCase、CamelCase或全部大写作为消息类型名称
  - 消息类型名称应使用完整英文单词，避免缩写（如使用 `remove_pdf` 而不是 `rm_pdf`）
  - 消息类型应该通过常量定义，不能直接在代码中使用字符串字面量
  - 消息类型分组应按功能模块组织，使用嵌套的常量类结构

- **正向例子**:
  ```python
  # 消息类型常量定义
  class WEBSOCKET_MESSAGE_TYPES:
      # 基础操作
      GET_PDF_LIST = 'get_pdf_list'
      ADD_PDF = 'add_pdf'
      REMOVE_PDF = 'remove_pdf'
      BATCH_REMOVE_PDF = 'batch_remove_pdf'
      
      # 请求操作
      PDF_DETAIL_REQUEST = 'pdf_detail_request'
      REQUEST_FILE_SELECTION = 'request_file_selection'
      
      # 系统消息
      HEARTBEAT = 'heartbeat'
      PDFJS_INIT_LOG = 'pdfjs_init_log'

  # 正确使用常量
  def handle_websocket_message(self, client, message):
      message_type = message.get('type')
      if message_type == WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST:
          self.handle_get_pdf_list(client, message)
      elif message_type == WEBSOCKET_MESSAGE_TYPES.ADD_PDF:
          self.handle_add_pdf(client, message)
      else:
          logger.warning(f"未知的消息类型: {message_type}")
  ```

- **反向例子**:
  ```python
  # 错误：硬编码字符串
  def handle_websocket_message(self, client, message):
      if message.get('type') == 'get_pdf_list':  # 直接使用字符串
          self.handle_get_pdf_list(client, message)
      elif message.get('type') == 'rm_pdf':  # 使用缩写
      
  # 错误：不规范命名格式
  GET_PDF_LIST = 'GetPDFList'  # 错误使用CamelCase
  PDF_REQUEST = 'pdf_dtl_req'  # 错误使用缩写
  
  # 错误：消息类型散落定义
  # 没有集中定义，所有地方都硬编码
  if msg_type == 'batch_delete':
  ```

- **验证方法**:
  - 通过静态代码分析工具检查所有的字符串比较操作
  - 搜索代码中的直接字符串字面量作为消息类型
  - 验证所有消息类型都在常量类中定义
  - 并检查命名格式是否符合snake_case规范
  - 进行场景测试确保重命名前后功能一致
  - 审查新添加代码是否遵循命名规范