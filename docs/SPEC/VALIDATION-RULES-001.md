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

---

## 实施位置与统一形式（重要）

- 入站消息（WebSocket）契约：
  - 契约样例位于 `todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/**`；
  - 服务器 `src/backend/msgCenter_server/standard_server.py` 会在“能力描述”中引用这些 schema 路径（用于对外说明与工具联动）；
  - 运行时强校验（新增）：标准服务器在路由前对 `*:requested` 消息按上述目录的 schema 做统一校验；找不到 schema 的消息将跳过校验但记录日志；若校验失败，直接返回 `*:failed` 错误响应并阻断后续处理。

- 后端数据层（统一入口）：
  - 所有写数据库的数据格式校验统一放在 `src/backend/database/plugins/*_plugin.py` 中；
  - 入口为 `TablePlugin.validate_data()` 及其各类型的 `_validate_*_payload()`；
  - 本层校验为“权威校验”，任何不满足约束的数据会以 `DatabaseValidationError` 直接拒绝。

- 前端模型（早期失败）：
  - 关键模型会在构造时做轻量校验（如 `src/frontend/pdf-viewer/features/annotation/models/annotation.js`）；
  - 目的在于尽早暴露问题，避免不合规数据进入交互链路。

## 域内特例（当前约束快照）

- Annotation（截图，2025-10-26 严格模式）
  - 前端与后端均要求：截图标注必须提供 `data.rectPercent{xPercent,yPercent,widthPercent,heightPercent}`，范围 [0,100]；
  - 必须包含 `imagePath`（非空字符串）与 `imageHash`（32位十六进制）；
  - 不再支持仅凭 `rect{x,y,width,height}` 入库或渲染；也不做任何像素/包围盒的换算回退；
  - 后端校验位置：`src/backend/database/plugins/pdf_annotation_plugin.py::_validate_screenshot_payload`；
  - 前端校验位置：`src/frontend/pdf-viewer/features/annotation/models/annotation.js::#validateTypeSpecificData`。
