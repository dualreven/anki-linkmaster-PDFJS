<![CDATA[<!-- PYTHON-CLASS-STRUCTURE-001.md -->
- **规范名称**: Python类结构规范
- **规范描述**: 定义Python类的基本结构要求，包括文档字符串、类型注解、访问控制等Python特有的约定，确保Python代码的规范性和可读性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: Python类的定义和结构
- **详细内容**:
  1. 类必须有文档字符串（docstring）说明用途
  2. 所有方法和参数必须有类型注解
  3. 公共方法提供清晰的接口定义
  4. 私有方法使用单下划线 `_` 前缀
  5. 构造函数应进行必要的初始化
  6. 遵循PEP 8代码风格规范

- **正向例子**:
  ```python
  class PDFDocumentProcessor:
      """PDF文档处理器
      
      负责PDF文件的读取、解析、内容提取等操作
      """
      
      def __init__(self, config: Dict[str, Any] = None) -> None:
          """初始化PDF处理器
        
          Args:
              config: 配置字典，可选
          """
          self.config = config or {}
          self.logger = get_logger(__name__)
      
      def extract_text(self, file_path: str) -> str:
          """从PDF文件提取文本内容
        
          Args:
              file_path: PDF文件路径
        
          Returns:
              提取的文本内容
        
          Raises:
              FileNotFoundError: 当文件不存在时
          """
          if not os.path.exists(file_path):
              raise FileNotFoundError(f"文件不存在: {file_path}")
          return self._extract_text_content(file_path)
      
      def _validate_file(self, file_path: str) -> bool:
          """验证PDF文件有效性（私有方法）"""
          return file_path.endswith('.pdf') and os.path.exists(file_path)
  ```

- **反向例子**:
  ```python
  # 缺少文档字符串
  class PDFProcessor:
      def __init__(self):
          pass
      
      def process(self):  # 缺少类型注解和文档
          pass
      
      def internal_logic(self):  # 私有方法未使用下划线
          pass

  # 类型注解缺失
  class DataHandler:
      def __init__(self, config):
          self.config = config
      
      def handle_data(data):  # 缺少参数和返回类型
          return data * 2

  # 访问控制不明确
  class Utility:
      def public_method(self):  # 应该是私有方法
          pass
      
      def _should_be_public(self):  # 应该是公共方法
          pass
  ```
]]>