<![CDATA[<!-- PYTHON-FUNCTION-DESIGN-001.md -->
- **规范名称**: Python函数设计规范
- **规范描述**: 定义Python函数的设计原则和结构要求，包括单一职责、类型注解、错误处理等Python特有的约定，确保Python函数的可读性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: Python函数的定义和使用
- **详细内容**:
  1. 函数不超过50行，保持短小精悍
  2. 所有参数和返回值必须有类型注解
  3. 函数必须有文档字符串说明用途
  4. 错误处理使用明确的异常类型
  5. 可选参数提供合理的默认值
  6. 遵循单一职责原则

- **正向例子**:
  ```python
  def extract_text_from_pdf(file_path: str, pages: list[int] = None) -> str:
      """从PDF文件提取指定页面的文本内容
      
      Args:
          file_path: PDF文件路径
          pages: 要提取的页面列表，None表示所有页面
          
      Returns:
          提取的文本内容
          
      Raises:
          FileNotFoundError: 当文件不存在时
          ValueError: 当文件格式不支持时
      """
      # 参数验证
      if not os.path.exists(file_path):
          raise FileNotFoundError(f"文件不存在: {file_path}")
      
      if not file_path.endswith('.pdf'):
          raise ValueError("只支持PDF文件格式")
      
      # 核心逻辑
      text = _extract_text_content(file_path, pages)
      
      # 结果处理
      return text.strip()
  
  def read_pdf_file(file_path: str) -> bytes:
      """读取PDF文件内容
      
      Args:
          file_path: PDF文件路径
          
      Returns:
          文件内容的字节数据
          
      Raises:
          FileNotFoundError: 当文件不存在时
          IOError: 当读取失败时
      """
      try:
          with open(file_path, 'rb') as f:
              return f.read()
      except FileNotFoundError:
          raise FileNotFoundError(f"PDF文件不存在: {file_path}")
      except IOError as e:
          raise IOError(f"读取PDF文件失败: {e}")
  ```

- **反向例子**:
  ```python
  # 函数过长，职责过多
  def process_pdf_file(file_path):
      """处理PDF文件（函数过长，职责过多）"""
      # 50+行的复杂逻辑，包含文件读取、文本提取、图像提取、结果保存等
      pass
  
  # 缺少类型注解和文档
  def extract_text(file_path, pages=None):
      # 缺少类型注解和文档字符串
      return some_text
  
  # 错误处理不明确
  def read_file(file_path):
      try:
          with open(file_path, 'r') as f:
              return f.read()
      except:
          return None  # 捕获所有异常，错误信息丢失
  
  # 参数设计不合理
  def process_data(a, b, c, d, e, f):  # 参数过多
      # 应该使用参数对象或字典
      pass
  ```
]]>