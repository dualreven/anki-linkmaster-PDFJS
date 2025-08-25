- **规范名称**: 数据验证规则规范
- **规范描述**: 定义JSON通信消息的数据验证规则，包括必填字段检查、类型验证、格式验证和业务规则验证，确保数据的完整性和正确性。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: 所有JSON通信消息的发送和接收端
- **详细内容**: 
  - 必须验证所有必需字段的存在性
  - 必须验证字段的数据类型是否符合预期
  - 必须验证特定格式的字段（如UUID、时间戳、邮箱等）
  - 必须验证业务规则和约束条件
  - 验证失败必须返回清晰的错误信息
  - 验证应该在消息处理的早期阶段进行

- **正向例子**:
  ```javascript
  // 消息验证函数示例
  function validateMessage(message) {
    // 必填字段检查
    const requiredFields = ['type', 'timestamp', 'request_id', 'data'];
    for (const field of requiredFields) {
      if (!(field in message)) {
        throw new Error(`缺少必需字段: ${field}`);
      }
    }

    // 类型验证
    if (typeof message.timestamp !== 'number') {
      throw new Error('timestamp必须是数字');
    }

    // 格式验证（UUID）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(message.request_id)) {
      throw new Error('request_id必须是有效的UUID格式');
    }

    // 业务规则验证
    if (message.type === 'add_pdf' && !message.data.filename) {
      throw new Error('添加PDF必须提供filename');
    }

    return true;
  }

  // 使用验证
  try {
    validateMessage(incomingMessage);
    // 处理消息
  } catch (error) {
    // 返回验证错误
    sendErrorResponse(error.message);
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：缺少验证
  function handleMessage(message) {
    // 直接使用消息，没有验证
    processData(message.data); // 可能包含无效数据
  }

  // 错误：验证不完整
  function validateMessage(message) {
    if (!message.type) {
      throw new Error('缺少type字段');
    }
    // 缺少对其他必需字段的验证
  }

  // 错误：验证错误信息不清晰
  function validateMessage(message) {
    if (!message.timestamp) {
      throw new Error('无效'); // 没有具体说明问题
    }
  }

  // 错误：验证时机过晚
  function handleMessage(message) {
    // 先处理业务逻辑
    const result = processBusinessLogic(message.data);
    
    // 最后才验证
    if (!isValid(result)) {
      throw new Error('数据无效');
    }
  }
  ```

- **验证规则参考表**:
  | 验证类型 | 检查内容 | 示例 |
  |----------|----------|------|
  | 必填字段 | 字段是否存在 | type, timestamp, request_id |
  | 类型验证 | 字段数据类型 | timestamp: number, type: string |
  | 格式验证 | 特定格式要求 | UUID格式、时间戳格式 |
  | 业务规则 | 业务逻辑约束 | 文件大小限制、权限检查 |