<![CDATA[<!-- CODING-COMMENT-PRINCIPLES-001.md -->
- **规范名称**: 注释原则规范
- **规范描述**: 定义代码注释的核心原则，强调注释应解释代码的目的和原因，而不是重复代码本身，确保注释的时效性和准确性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有编程语言的代码注释
- **详细内容**:
  1. 解释为什么：注释应解释代码的目的、设计决策和业务逻辑，而不是描述代码在做什么
  2. 保持同步：注释必须与代码保持同步更新，避免过时或误导性的注释
  3. 简洁准确：注释应简洁明了，避免冗余和无关信息
  4. 避免过度注释：清晰的代码通常不需要过多注释，优先考虑代码自文档化

- **正向例子**:
  ```python
  # 解释为什么：说明业务逻辑的原因
  # 使用哈希映射提高查找效率，因为需要频繁查询用户状态
  user_status_map = {user.id: user.status for user in users}
  
  def calculate_tax(amount):
      """计算税费
      
      使用当前税率政策，包括基本税和附加税
      这是为了符合最新的税务法规要求
      """
      base_tax = amount * 0.1  # 基本税率10%
      additional_tax = amount * 0.05  # 附加税率5%
      return base_tax + additional_tax
  ```

  ```javascript
  // 保持同步：注释与代码逻辑一致
  /**
   * 验证用户输入格式
   * 遵循RFC 5322电子邮件格式标准
   */
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // 简洁准确：提供必要上下文
  const MAX_RETRY = 3; // 最大重试次数，基于API服务商的限制
  ```

- **反向例子**:
  ```python
  # 冗余注释：重复代码功能
  x = x + 1  # 给x加1
  
  # 过时注释：与代码逻辑不符
  # 这里使用旧算法（实际代码已更新）
  result = new_algorithm(data)  # 实际使用的是新算法
  
  # 无关信息：添加不必要的细节
  # 今天天气真好，我写了这个函数
  def process_data(data):
      # 这里处理数据...（注释没有提供有用信息）
      return data * 2
  ```

  ```javascript
  // 误导性注释
  /**
   * 计算折扣（注释说计算折扣，但函数实际计算税费）
   */
   function calculateDiscount(amount) {
     return amount * 0.15; // 这实际上是税率，不是折扣
   }
   
   // 过度注释
   let count = 0; // 初始化count为0
   count++; // count增加1
   console.log(count); // 打印count的值
  ```
]]>