<![CDATA[<!-- CODING-CLASS-PRINCIPLES-001.md -->
- **规范名称**: 类设计原则规范
- **规范描述**: 定义类设计时应遵循的核心原则，包括单一职责、高内聚和低耦合，以确保代码的可维护性和可扩展性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有面向对象编程语言（Python、JavaScript等）的类设计
- **详细内容**:
  1. 单一职责原则：一个类只负责一个功能领域或业务逻辑
  2. 高内聚原则：相关的方法和属性应该组织在一起
  3. 低耦合原则：减少类之间的依赖关系，提高模块独立性

- **正向例子**:
  ```python
  # 单一职责：只负责PDF文本提取
  class PDFTextExtractor:
      def extract_text(self, file_path):
          # 只处理文本提取逻辑
          pass

  # 高内聚：相关方法组织在一起
  class PDFProcessor:
      def __init__(self):
          self.logger = get_logger(__name__)
      
      def validate_file(self, file_path):
          pass
      
      def extract_content(self, file_path):
          pass

  # 低耦合：通过接口依赖而非具体实现
  class PDFService:
      def __init__(self, repository: PDFRepositoryInterface):
          self.repo = repository
  ```

- **反向例子**:
  ```python
  # 违反单一职责：一个类做太多事情
  class PDFHandler:
      def extract_text(self, file_path):
          pass
      
      def extract_images(self, file_path):
          pass
      
      def save_to_database(self, data):
          pass  # 不应该包含数据持久化逻辑
      
      def send_email_notification(self):
          pass  # 不应该包含通知逻辑

  # 低内聚：不相关的方法放在一起
  class Utility:
      def parse_pdf(self, file_path):
          pass
      
      def calculate_tax(self, amount):
          pass  # 完全不相关的功能
      
      def format_date(self, date):
          pass

  # 高耦合：直接依赖具体实现
  class PDFService:
      def __init__(self):
          self.repo = PostgreSQLRepository()  # 硬编码具体实现
  ```
]]>