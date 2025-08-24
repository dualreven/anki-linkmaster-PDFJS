<!-- SPEC-NAMING-CLASS-001.md -->
- 规范名称: 类命名规范
- 规范描述: 规定项目中类的命名规则，确保类名清晰表达其职责和用途
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的类声明
- 正向例子:
  ```python
  # Python类命名 - 大驼峰，名词优先
  class PdfDocumentProcessor:
      """PDF文档处理器"""
      pass
  
  class AnkiCardGenerator:
      """Anki卡片生成器"""
      pass
  
  class UserService:
      """用户服务"""
      pass
  
  class PdfViewer:
      """PDF查看器"""
      pass
  
  class FileValidator:
      """文件验证器"""
      pass
  ```
  
  ```javascript
  // JavaScript类命名 - 大驼峰，名词优先
  class PdfDocumentProcessor {
    // PDF文档处理器
  }
  
  class AnkiCardGenerator {
    // Anki卡片生成器
  }
  
  class UserService {
    // 用户服务
  }
  
  class PdfViewer {
    // PDF查看器
  }
  
  class FileValidator {
    // 文件验证器
  }
  ```
  
  ```javascript
  // Vue组件命名 - 大驼峰，与文件名一致
  export default {
    name: 'PdfUploader',
    // ...
  }
  
  export default {
    name: 'PdfViewer',
    // ...
  }
  ```
- 反向例子:
  ```python
  # 错误的Python类命名
  class pdfDocumentProcessor:  # 小驼峰
      pass
  
  class Pdf_document_processor:  # snake_case
      pass
  
  class ProcessDocument:  # 动词开头
      pass
  
  class PdfManager:  # 使用通用词Manager
      pass
  
  class PdfHandler:  # 使用通用词Handler
      pass
  ```
  
  ```javascript
  // 错误的JavaScript类命名
  class pdfDocumentProcessor {  // 小驼峰
    // ...
  }
  
  class Pdf_document_processor {  // snake_case
    // ...
  }
  
  class ProcessDocument {  // 动词开头
    // ...
  }
  
  class PdfManager {  // 使用通用词Manager
    // ...
  }
  
  class PdfHandler {  // 使用通用词Handler
    // ...
  }
  ```
  
  ```javascript
  // 错误的Vue组件命名
  export default {
    name: 'pdfUploader',  // 小驼峰
    // ...
  }
  
  export default {
    name: 'pdf_uploader',  // snake_case
    // ...
  }
  
  export default {
    name: 'UploadPdf',  # 动词开头
    // ...
  }