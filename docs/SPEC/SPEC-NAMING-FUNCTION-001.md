<!-- SPEC-NAMING-FUNCTION-001.md -->
- 规范名称: 函数命名规范
- 规范描述: 规定项目中函数的命名规则，确保函数名清晰表达其功能和行为
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的函数声明
- 正向例子:
  ```python
  # Python函数命名 - snake_case，动词开头
  def extract_text_from_pdf(file_path: str) -> str:
      """从PDF文件中提取文本"""
      pass
  
  def validate_input(data: dict) -> bool:
      """验证输入数据"""
      pass
  
  def is_valid_pdf(file_path: str) -> bool:
      """检查是否为有效的PDF文件"""
      pass
  
  def has_permission(user_id: str, resource: str) -> bool:
      """检查用户是否有权限访问资源"""
      pass
  
  async def fetch_pdf_data(url: str) -> bytes:
      """异步获取PDF数据"""
      pass
  ```
  
  ```javascript
  // JavaScript函数命名 - camelCase，动词开头
  function extractTextFromPdf(filePath) {
    // 从PDF文件中提取文本
  }
  
  function validateInput(data) {
    // 验证输入数据
  }
  
  function isValidPdf(filePath) {
    // 检查是否为有效的PDF文件
  }
  
  function hasPermission(userId, resource) {
    // 检查用户是否有权限访问资源
  }
  
  async function fetchPdfData(url) {
    // 异步获取PDF数据
  }
  ```
- 反向例子:
  ```python
  # 错误的Python函数命名
  def ExtractTextFromPdf(file_path: str) -> str:  # 大驼峰
      pass
  
  def extractTextFromPdf(file_path: str) -> str:  # camelCase
      pass
  
  def text_extract(file_path: str) -> str:  # 非动词开头
      pass
  
  def pdf_text(file_path: str) -> str:  # 不清晰的功能描述
      pass
  
  def get_data(file_path: str) -> str:  # 过于通用
      pass
  ```
  
  ```javascript
  // 错误的JavaScript函数命名
  function ExtractTextFromPdf(filePath) {  // 大驼峰
    // ...
  }
  
  function extract_text_from_pdf(filePath) {  // snake_case
    // ...
  }
  
  function textExtract(filePath) {  // 非动词开头
    // ...
  }
  
  function pdfText(filePath) {  // 不清晰的功能描述
    // ...
  }
  
  function getData(filePath) {  // 过于通用
    // ...
  }