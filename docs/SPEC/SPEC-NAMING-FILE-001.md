<!-- SPEC-NAMING-FILE-001.md -->
- 规范名称: 文件命名规范
- 规范描述: 规定项目中文件和目录的命名规则，确保文件组织的一致性和可读性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有文件和目录
- 正向例子:
  ```
  # 源代码文件
  pdf-processor.js
  user-service.py
  pdf-viewer.vue
  
  # 目录
  pdf-viewer/
  api-services/
  test-modules/
  
  # 测试文件
  pdf-parser.spec.js
  test_pdf_parser.py
  
  # 配置文件
  .env
  vite.config.js
  requirements.txt
  ```
- 反向例子:
  ```
  # 错误的文件命名
  PdfProcessor.js  # 混合大小写
  pdf_processor.js  # 下划线而非kebab-case
  pdfprocessor.js  # 缺少分隔符
  
  # 错误的目录命名
  PdfViewer/  # 混合大小写
  pdf_viewer/  # 下划线而非kebab-case
  pdfviewer/  # 缺少分隔符
  
  # 错误的测试文件命名
  pdfParser.test.js  # 混合大小写
  pdf_parser_test.py  # 下划线而非kebab-case