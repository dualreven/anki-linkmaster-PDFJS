<!-- SPEC-NAMING-VARIABLE-001.md -->
- 规范名称: 变量命名规范
- 规范描述: 规定项目中变量的命名规则，确保变量名清晰表达其用途和类型
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的变量声明
- 正向例子:
  ```python
  # Python变量命名 - snake_case
  pdf_file_path = "/path/to/file.pdf"
  max_size = 1024
  user_name = "John Doe"
  is_active = True
  page_count = 10
  file_size_bytes = 2048
  ```
  
  ```javascript
  // JavaScript变量命名 - camelCase
  const pdfFilePath = "/path/to/file.pdf";
  const maxSize = 1024;
  const userName = "John Doe";
  const isActive = true;
  const pageCount = 10;
  const fileSizeBytes = 2048;
  ```
  
  ```sql
  -- SQL变量命名 - snake_case
  SELECT user_id, created_at, file_size 
  FROM pdf_documents 
  WHERE is_active = true;
  ```
- 反向例子:
  ```python
  # 错误的Python变量命名
  pdfFilePath = "/path/to/file.pdf"  # camelCase而非snake_case
  maxsize = 1024  # 缺少分隔符
  UserName = "John Doe"  # 大驼峰
  isActive = True  # camelCase而非snake_case
  pagecount = 10  # 缺少分隔符
  fileSizeBytes = 2048  # camelCase而非snake_case
  ```
  
  ```javascript
  // 错误的JavaScript变量命名
  pdf_file_path = "/path/to/file.pdf";  // snake_case而非camelCase
  maxsize = 1024;  // 缺少分隔符
  user_name = "John Doe";  // snake_case而非camelCase
  is_active = true;  // snake_case而非camelCase
  page_count = 10;  // snake_case而非camelCase
  file_size_bytes = 2048;  // snake_case而非camelCase
  ```
  
  ```sql
  -- 错误的SQL变量命名
  SELECT userId, createdAt, fileSize 
  FROM pdfDocuments 
  WHERE isActive = true;  -- camelCase而非snake_case