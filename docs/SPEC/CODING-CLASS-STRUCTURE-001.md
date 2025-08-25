<![CDATA[<!-- CODING-CLASS-STRUCTURE-001.md -->
- **规范名称**: 类结构规范
- **规范描述**: 定义类的基本结构要求，包括构造函数、公共方法、私有方法的组织方式，以及不同语言（Python、JavaScript、Vue）的类结构约定。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: Python、JavaScript、Vue组件的类定义
- **详细内容**:
  1. 类应包含清晰的构造函数初始化逻辑
  2. 公共方法应提供明确的接口定义
  3. 私有方法应使用语言特定的标识符（如Python的下划线、JavaScript的#）
  4. 类应有适当的文档字符串描述用途
  5. Vue组件应遵循标准的选项式API结构

- **正向例子**:
  ```python
  class PDFDocumentProcessor:
      """PDF文档处理器
      
      负责PDF文件的读取、解析、内容提取
      """
      
      def __init__(self, config: Dict = None):
          self.config = config or {}
          self.logger = get_logger(__name__)
      
      # 公共接口
      def extract_text(self, file_path: str) -> str:
          """提取文本内容"""
          pass
      
      # 私有方法
      def _validate_file(self, file_path: str) -> bool:
          """验证文件有效性"""
          pass
  ```

  ```javascript
  /**
   * PDF文档查看器
   */
  class PdfDocumentViewer {
    constructor(options) {
      this.container = options.container;
      this.pdfUrl = options.pdfUrl;
      this.scale = options.scale || 1.0;
      
      this.#initialize();
    }
    
    // 公共方法
    async render() {
      // 渲染PDF
    }
    
    // 私有方法
    #initialize() {
      // 初始化设置
    }
  }
  ```

  ```javascript
  // Vue组件
  export default {
    name: 'PdfUploader',
    
    props: {
      maxFileSize: {
        type: Number,
        default: 50 * 1024 * 1024
      }
    },
    
    data() {
      return {
        uploadProgress: 0,
        selectedFile: null
      };
    },
    
    computed: {
      isValidFile() {
        return this.selectedFile && 
               this.selectedFile.size <= this.maxFileSize;
      }
    },
    
    methods: {
      async uploadFile() {
        // 上传逻辑
      }
    }
  };
  ```

- **反向例子**:
  ```python
  # 缺少文档字符串
  class PDFProcessor:
      def __init__(self):
          pass  # 缺少必要的初始化
      
      def process(self):  # 方法用途不明确
          pass
      
      def internal_logic(self):  # 私有方法未使用下划线前缀
          pass
  ```

  ```javascript
  // 结构混乱的类
  class PdfViewer {
    constructor() {
      this.init(); // 构造函数中调用复杂逻辑
    }
    
    init() {
      // 复杂的初始化逻辑
    }
    
    publicMethod() {
      // 公共方法
    }
    
    _privateMethod() { // JavaScript中不应使用下划线表示私有
      // 私有逻辑
    }
  }
  ```
]]>