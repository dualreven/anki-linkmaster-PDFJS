<!-- SPEC-NAMING-001.md -->
- 规范名称: 命名规范
- 规范描述: 规定项目中文件、变量、函数、类等命名规则，确保代码可读性和一致性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件
- 正向例子:
  ```python
  # 文件命名: kebab-case
  pdf-processor.py
  user-service.py
  
  # 变量命名: snake_case
  pdf_file_path = "/path/to/file.pdf"
  max_size = 1024
  
  # 函数命名: 动词开头，snake_case
  def extract_text_from_pdf(file_path: str) -> str:
      pass
  
  # 类命名: 大驼峰
  class PdfDocumentProcessor:
      pass
  
  # 常量命名: 全大写，下划线分隔
  MAX_PDF_SIZE = 50 * 1024 * 1024
  ```
  
  ```javascript
  // 文件命名: kebab-case
  pdf-processor.js
  user-service.js
  
  // 变量命名: camelCase
  const pdfFilePath = "/path/to/file.pdf";
  const maxSize = 1024;
  
  // 函数命名: 动词开头，camelCase
  function extractTextFromPdf(filePath) {
    // ...
  }
  
  // 类命名: 大驼峰
  class PdfDocumentProcessor {
    // ...
  }
  
  // 常量命名: 全大写，下划线分隔
  const MAX_PDF_SIZE = 50 * 1024 * 1024;
  ```
- 反向例子:
  ```python
  # 错误的文件命名
  PdfProcessor.py  # 混合大小写
  pdf_processor.py  # 下划线而非kebab-case
  
  # 错误的变量命名
  pdfFilePath = "/path/to/file.pdf"  # camelCase而非snake_case
  maxsize = 1024  # 缺少分隔符
  
  # 错误的函数命名
  def PdfTextExtract(file_path: str) -> str:  # 非动词开头，大驼峰
      pass
  
  # 错误的类命名
  class pdfDocumentProcessor:  # 小驼峰
      pass
  
  # 错误的常量命名
  max_pdf_size = 50 * 1024 * 1024  # 非全大写
  ```
  
  ```javascript
  // 错误的文件命名
  PdfProcessor.js  // 混合大小写
  pdf_processor.js  // 下划线而非kebab-case
  
  // 错误的变量命名
  pdf_file_path = "/path/to/file.pdf";  // snake_case而非camelCase
  maxsize = 1024;  // 缺少分隔符
  
  // 错误的函数命名
  function pdfTextExtract(filePath) {  // 非动词开头，小驼峰
    // ...
  }
  
  // 错误的类命名
  class pdfDocumentProcessor {  // 小驼峰
    // ...
  }
  
  // 错误的常量命名
  maxPdfSize = 50 * 1024 * 1024;  // 非全大写