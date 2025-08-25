<![CDATA[<!-- PYTHON-NAMING-CONVENTION-001.md -->
- **规范名称**: Python命名规范
- **规范描述**: 定义Python项目中变量、函数、类、常量等的命名约定，遵循PEP 8标准和Python社区的命名惯例，确保代码的一致性和可读性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: Python项目的所有命名
- **详细内容**:
  1. 变量和函数使用 snake_case 命名（小写字母，下划线分隔）
  2. 类使用 PascalCase 命名（大驼峰式）
  3. 常量使用 UPPER_CASE 命名（全大写，下划线分隔）
  4. 私有成员使用单下划线 `_` 前缀
  5. 避免使用缩写，命名应语义清晰
  6. 布尔变量和函数使用 is_、has_、can_ 等前缀

- **正向例子**:
  ```python
  # 变量命名
  pdf_file_path = "/documents/sample.pdf"
  max_file_size = 50 * 1024 * 1024
  user_data_list = []
  
  # 函数命名
  def extract_text_from_pdf(file_path: str) -> str:
      pass
  
  def validate_user_input(input_data: dict) -> bool:
      pass
  
  def is_valid_file(file_path: str) -> bool:
      pass
  
  # 类命名
  class PdfDocumentProcessor:
      pass
  
  class UserAuthenticationService:
      pass
  
  # 常量命名
  MAX_PDF_SIZE = 100 * 1024 * 1024  # 100MB
  SUPPORTED_FILE_TYPES = ['.pdf', '.doc', '.docx']
  DEFAULT_TIMEOUT = 30
  
  # 私有成员
  class DataProcessor:
      def __init__(self):
          self._internal_cache = {}  # 私有属性
      
      def _validate_data(self, data):  # 私有方法
          pass
  ```

- **反向例子**:
  ```python
  # 不一致的命名风格
  pdfFilePath = ""  # 驼峰命名，应为 snake_case
  MaxFileSize = 0   # 大驼峰，应为 snake_case
  user_data_list = []  # 正确
  
  # 函数命名问题
  def extractText(file):  # 驼峰命名，应为 snake_case
      pass
  
  def valid_file(file):  # 缺少动词，应为 is_valid_file
      pass
  
  # 类命名问题
  class pdf_processor:  # 蛇形命名，应为 PascalCase
      pass
  
  class PDFProcessor:   # 全大写缩写，应为 PdfProcessor
      pass
  
  # 常量命名问题
  maxPdfSize = 0       # 驼峰命名，应为 UPPER_CASE
  supported_types = []  # 小写命名，应为 UPPER_CASE
  
  # 私有成员问题
  class Processor:
      def __init__(self):
          self.internalCache = {}  # 缺少下划线前缀
      
      def private_method(self):  # 缺少下划线前缀
          pass
  ```
]]>