# 类规范

## 设计原则
- **单一职责**：一个类只负责一个功能领域
- **高内聚**：相关方法和属性组织在一起
- **低耦合**：减少类之间的依赖

## 类结构

### Python类
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
    
    def extract_images(self, file_path: str) -> List[bytes]:
        """提取图片"""
        pass
    
    # 私有方法
    def _validate_file(self, file_path: str) -> bool:
        """验证文件有效性"""
        pass
```

### JavaScript类
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
  
  zoomIn() {
    this.scale *= 1.2;
    this.render();
  }
  
  // 私有方法
  #initialize() {
    // 初始化设置
  }
}
```

## Vue组件类
```javascript
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

## 继承与组合
```python
# 组合优于继承
class PDFProcessor:
    def __init__(self):
        self.text_extractor = TextExtractor()
        self.image_extractor = ImageExtractor()
    
    def process(self, file_path):
        text = self.text_extractor.extract(file_path)
        images = self.image_extractor.extract(file_path)
        return {'text': text, 'images': images}
```

## 数据类
```python
from dataclasses import dataclass

@dataclass
class PDFDocument:
    """PDF文档数据模型"""
    id: str
    file_name: str
    file_size: int
    page_count: int
    created_at: datetime
```

## 服务类
```python
class PDFService:
    """PDF业务服务"""
    
    def __init__(self, repository: PDFRepository):
        self.repo = repository
    
    async def process_pdf(self, file_path: str) -> Dict:
        """处理PDF文件"""
        # 业务逻辑协调
        doc = await self.repo.save(file_path)
        text = await self.extract_text(doc.id)
        return {'document': doc, 'text': text}
```

## 检查清单
- [ ] 类名使用大驼峰命名
- [ ] 单一职责原则
- [ ] 公共接口清晰
- [ ] 私有方法以下划线开头
- [ ] 依赖注入而非硬编码
- [ ] 有适当的文档字符串