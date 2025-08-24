<!-- SPEC-CLASS-001.md -->
- 规范名称: 类规范
- 规范描述: 规定项目中类的设计原则和实现规范，确保类结构清晰、职责明确、易于维护
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的类实现
- 正向例子:
  ```python
  from typing import List, Dict, Optional
  from dataclasses import dataclass
  from datetime import datetime
  import logging
  
  
  @dataclass
  class PDFDocument:
      """PDF文档数据模型
      
      使用数据类简化数据对象的创建和管理
      """
      id: str
      file_name: str
      file_size: int
      page_count: int
      created_at: datetime
  
  
  class PDFDocumentProcessor:
      """PDF文档处理器
      
      负责PDF文件的读取、解析和内容提取。
      遵循单一职责原则，只处理PDF相关操作。
      """
      
      def __init__(self, config: Optional[Dict] = None):
          """初始化PDF文档处理器"""
          self.config = config or {}
          self.logger = logging.getLogger(__name__)
          # 使用组合而非继承
          self.text_extractor = TextExtractor()
          self.image_extractor = ImageExtractor()
      
      # 公共接口
      def extract_text(self, file_path: str) -> str:
          """提取文本内容"""
          self._validate_file(file_path)
          return self.text_extractor.extract(file_path)
      
      def extract_images(self, file_path: str) -> List[bytes]:
          """提取图片"""
          self._validate_file(file_path)
          return self.image_extractor.extract(file_path)
      
      # 私有方法
      def _validate_file(self, file_path: str) -> bool:
          """验证文件有效性"""
          if not os.path.exists(file_path):
              raise FileNotFoundError(f"文件不存在: {file_path}")
          return True
  
  
  class PDFService:
      """PDF业务服务
      
      协调各个组件完成PDF处理业务逻辑。
      使用依赖注入而非硬编码。
      """
      
      def __init__(self, repository: 'PDFRepository'):
          """初始化PDF服务"""
          self.repo = repository
      
      async def process_pdf(self, file_path: str) -> Dict:
          """处理PDF文件"""
          # 业务逻辑协调
          doc = await self.repo.save(file_path)
          text = await self.extract_text(doc.id)
          return {'document': doc, 'text': text}
  ```
  
  ```javascript
  /**
   * PDF文档数据模型
   * 
   * 使用类简化数据对象的创建和管理
   */
  class PDFDocument {
    /**
     * 创建PDF文档实例
     * @param {Object} data - 文档数据
     * @param {string} data.id - 文档ID
     * @param {string} data.fileName - 文件名
     * @param {number} data.fileSize - 文件大小
     * @param {number} data.pageCount - 页数
     * @param {Date} data.createdAt - 创建时间
     */
    constructor({ id, fileName, fileSize, pageCount, createdAt }) {
      this.id = id;
      this.fileName = fileName;
      this.fileSize = fileSize;
      this.pageCount = pageCount;
      this.createdAt = createdAt;
    }
  }
  
  /**
   * PDF文档处理器
   * 
   * 负责PDF文件的读取、解析和内容提取。
   * 遵循单一职责原则，只处理PDF相关操作。
   */
  class PdfDocumentProcessor {
    /**
     * 创建PDF文档处理器实例
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
      this.config = options;
      this.logger = getLogger();
      // 使用组合而非继承
      this.textExtractor = new TextExtractor();
      this.imageExtractor = new ImageExtractor();
      
      this.#initialize();
    }
    
    // 公共方法
    /**
     * 提取文本内容
     * @param {string} filePath - 文件路径
     * @returns {Promise<string>} 文本内容
     */
    async extractText(filePath) {
      this.#validateFile(filePath);
      return this.textExtractor.extract(filePath);
    }
    
    /**
     * 提取图片
     * @param {string} filePath - 文件路径
     * @returns {Promise<Buffer[]>} 图片数据数组
     */
    async extractImages(filePath) {
      this.#validateFile(filePath);
      return this.imageExtractor.extract(filePath);
    }
    
    // 私有方法
    /**
     * 初始化设置
     * @private
     */
    #initialize() {
      // 初始化逻辑
    }
    
    /**
     * 验证文件有效性
     * @private
     * @param {string} filePath - 文件路径
     * @returns {boolean} 是否有效
     */
    #validateFile(filePath) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      return true;
    }
  }
  
  /**
   * Vue组件类
   * 
   * 遵循Vue组件的最佳实践
   */
  export default {
    name: 'PdfUploader',
    
    props: {
      maxFileSize: {
        type: Number,
        default: 50 * 1024 * 1024
      },
      acceptedTypes: {
        type: Array,
        default: () => ['application/pdf']
      }
    },
    
    data() {
      return {
        uploadProgress: 0,
        selectedFile: null,
        isUploading: false
      };
    },
    
    computed: {
      isValidFile() {
        return this.selectedFile && 
               this.selectedFile.size <= this.maxFileSize &&
               this.acceptedTypes.includes(this.selectedFile.type);
      }
    },
    
    methods: {
      async uploadFile() {
        if (!this.isValidFile) return;
        
        this.isUploading = true;
        try {
          // 上传逻辑
        } finally {
          this.isUploading = false;
        }
      }
    }
  };
  ```
- 反向例子:
  ```python
  # 错误的类实现示例
  
  # 违反单一职责原则
  class PDFProcessor:
      def __init__(self):
          self.db_connection = None  # 数据库操作
          self.http_client = None   # HTTP请求
          self.file_system = None   # 文件系统操作
          self.logger = None       # 日志记录
      
      def process_pdf(self, file_path):
          # 处理PDF
          pass
      
      def save_to_database(self, data):
          # 数据库操作
          pass
      
      def send_notification(self, message):
          # 发送通知
          pass
      
      def write_log(self, message):
          # 日志记录
          pass
  
  # 硬编码依赖
  class PDFService:
      def __init__(self):
          self.repository = DatabaseRepository()  # 硬编码
      
      def process_pdf(self, file_path):
          # 使用硬编码的repository
          pass
  
  # 过度使用继承
  class BaseProcessor:
      def process(self, data):
          pass
  
  class TextProcessor(BaseProcessor):
      def process(self, data):
          # 文本处理逻辑
          pass
  
  class ImageProcessor(BaseProcessor):
      def process(self, data):
          # 图像处理逻辑
          pass
  
  class PDFProcessor(TextProcessor, ImageProcessor):  # 多重继承
      def process(self, data):
          # 复杂的继承关系
          pass
  ```
  
  ```javascript
  // 错误的类实现示例
  
  // 违反单一职责原则
  class PDFProcessor {
    constructor() {
      this.dbConnection = null;     // 数据库操作
      this.httpClient = null;      // HTTP请求
      this.fileSystem = null;      // 文件系统操作
      this.logger = null;          // 日志记录
    }
    
    processPdf(filePath) {
      // 处理PDF
    }
    
    saveToDatabase(data) {
      // 数据库操作
    }
    
    sendNotification(message) {
      // 发送通知
    }
    
    writeLog(message) {
      // 日志记录
    }
  }
  
  // 硬编码依赖
  class PDFService {
    constructor() {
      this.repository = new DatabaseRepository();  // 硬编码
    }
    
    async processPdf(filePath) {
      // 使用硬编码的repository
    }
  }
  
  // 过度使用继承
  class BaseProcessor {
    process(data) {
      // 基础处理逻辑
    }
  }
  
  class TextProcessor extends BaseProcessor {
    process(data) {
      // 文本处理逻辑
    }
  }
  
  class ImageProcessor extends BaseProcessor {
    process(data) {
      // 图像处理逻辑
    }
  }
  
  class PDFProcessor extends TextProcessor {  // 不必要的继承
    process(data) {
      // 复杂的继承关系
    }
  }
  
  // 错误的Vue组件实现
  export default {
    // 缺少组件名称
    props: ['maxFileSize'],  // 缺少类型定义
    
    data() {
      return {
        uploadProgress: 0,
        selectedFile: null
      };
    },
    
    methods: {
      uploadFile() {
        // 缺少错误处理
        // 缺少状态管理
        // 直接操作DOM
        document.getElementById('upload-button').disabled = true;
      }
    }
  };