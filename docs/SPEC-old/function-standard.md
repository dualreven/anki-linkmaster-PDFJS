# 函数规范

## 设计原则
- **单一职责**：一个函数只做一件事
- **短小精悍**：不超过50行
- **清晰命名**：动词开头，语义明确

## 函数结构

### Python
```python
def extract_text_from_pdf(file_path: str, pages: List[int] = None) -> str:
    """从PDF提取文本"""
    # 参数验证
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    # 核心逻辑
    text = _extract_text_content(file_path, pages)
    
    # 结果处理
    return text.strip()
```

### JavaScript
```javascript
/**
 * 从PDF提取文本
 */
async function extractTextFromPdf(pdfData, options = {}) {
  // 参数解构
  const { pages = [], ocrEnabled = false } = options;
  
  // 参数验证
  if (!pdfData || pdfData.length === 0) {
    throw new Error('PDF数据不能为空');
  }
  
  // 核心逻辑
  const text = await processPdfContent(pdfData, pages, ocrEnabled);
  
  return text.trim();
}
```

## 参数设计
- **类型注解**：所有参数必须有类型
- **默认值**：可选参数提供默认值
- **参数对象**：超过3个参数使用对象

## 错误处理
```python
def read_pdf_file(file_path: str) -> bytes:
    """读取PDF文件"""
    try:
        with open(file_path, 'rb') as f:
            return f.read()
    except FileNotFoundError:
        raise ValueError(f"PDF文件不存在: {file_path}")
    except IOError as e:
        raise RuntimeError(f"读取失败: {e}")
```

## 异步函数
```javascript
// 统一错误处理
async function loadPdfDocument(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error('加载PDF失败:', error);
    throw error;
  }
}
```

## 函数拆分
```python
# 拆分前：复杂函数
def process_large_pdf(file_path):
    # 50+行的复杂逻辑
    pass

# 拆分后：清晰简洁
def process_large_pdf(file_path):
    """处理大型PDF"""
    metadata = _extract_metadata(file_path)
    text = _extract_text(file_path)
    images = _extract_images(file_path)
    return _combine_results(metadata, text, images)
```

## 检查清单
- [ ] 函数不超过50行
- [ ] 参数有类型注解
- [ ] 错误处理完善
- [ ] 命名清晰表达用途
- [ ] 单一职责原则