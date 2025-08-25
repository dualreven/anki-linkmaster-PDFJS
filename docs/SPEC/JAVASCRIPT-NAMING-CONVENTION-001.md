<![CDATA[<!-- JAVASCRIPT-NAMING-CONVENTION-001.md -->
- **规范名称**: JavaScript命名规范
- **规范描述**: 定义JavaScript项目中变量、函数、类、常量等的命名约定，遵循JavaScript社区的命名惯例和主流风格指南，确保代码的一致性和可读性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: JavaScript项目的所有命名
- **详细内容**:
  1. 变量和函数使用 camelCase 命名（小驼峰式）
  2. 类使用 PascalCase 命名（大驼峰式）
  3. 常量使用 UPPER_CASE 命名（全大写，下划线分隔）
  4. 私有成员使用 `#` 前缀（现代JavaScript）
  5. 布尔变量和函数使用 is、has、can 等前缀
  6. 避免使用缩写，命名应语义清晰

- **正向例子**:
  ```javascript
  // 变量命名
  const pdfFilePath = "/documents/sample.pdf";
  let maxFileSize = 50 * 1024 * 1024;
  const userDataList = [];
  
  // 函数命名
  function extractTextFromPdf(pdfData) {
    // 函数逻辑
  }
  
  function validateUserInput(inputData) {
    return true;
  }
  
  function isValidFile(file) {
    return file && file.size > 0;
  }
  
  // 类命名
  class PdfDocumentViewer {
    constructor(options) {
      this.container = options.container;
      this.#isInitialized = false; // 私有字段
    }
    
    async render() {
      // 渲染逻辑
    }
    
    #initialize() { // 私有方法
      // 初始化逻辑
    }
  }
  
  class UserAuthenticationService {
    // 服务类
  }
  
  // 常量命名
  const MAX_PDF_SIZE = 100 * 1024 * 1024;  // 100MB
  const SUPPORTED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
  const DEFAULT_TIMEOUT = 30;
  
  // 组件命名（Vue）
  export default {
    name: 'PdfUploader', // PascalCase
    // 组件选项
  };
  ```

- **反向例子**:
  ```javascript
  // 不一致的命名风格
  const pdf_file_path = "";  // 蛇形命名，应为 camelCase
  let MaxFileSize = 0;       // 大驼峰，应为 camelCase
  const userDataList = [];   // 正确
  
  // 函数命名问题
  function extract_text(file) {  // 蛇形命名，应为 camelCase
  }
  
  function ValidFile(file) {     // 大驼峰，应为 camelCase
  }
  
  // 类命名问题
  class pdf_viewer {          // 蛇形命名，应为 PascalCase
  }
  
  class PDFViewer {           // 全大写缩写，应为 PdfViewer
  }
  
  // 常量命名问题
  const maxPdfSize = 0;       // 驼峰命名，应为 UPPER_CASE
  const supportedTypes = [];  // 小写命名，应为 UPPER_CASE
  
  // 私有成员问题
  class Processor {
    constructor() {
      this._privateField = ''; // 使用旧的下划线约定
    }
    
    _privateMethod() {        // 使用旧的下划线约定
    }
  }
  
  // Vue组件命名问题
  export default {
    name: 'pdf-uploader',     // kebab-case，应为 PascalCase
  };
  ```
]]>