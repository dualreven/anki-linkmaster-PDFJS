<!-- SPEC-COMMENT-001.md -->
- 规范名称: 注释规范
- 规范描述: 规定项目中代码注释的编写规则，确保注释清晰、准确、有用
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的注释
- 正向例子:
  ```python
  """
  PDF文档处理模块
  
  提供PDF文件的读取、解析和内容提取功能。
  支持文本提取、图像提取和元数据获取。
  """
  
  import os
  from typing import List, Dict, Optional
  
  
  class PdfDocumentProcessor:
      """
      PDF文档处理器
      
      负责PDF文件的读取、解析和内容提取。
      支持批量处理和错误恢复。
      
      Attributes:
          config (Dict): 处理器配置参数
          logger (Logger): 日志记录器
      """
      
      def __init__(self, config: Dict = None):
          """初始化PDF文档处理器"""
          self.config = config or {}
          self.logger = get_logger(__name__)
      
      def extract_text(self, file_path: str, pages: List[int] = None) -> str:
          """
          从PDF文件中提取文本内容
          
          Args:
              file_path (str): PDF文件路径
              pages (List[int], optional): 要提取的页码列表，默认为全部页面
              
          Returns:
              str: 提取的文本内容
              
          Raises:
              FileNotFoundError: 文件不存在时抛出
              ValueError: 文件格式不支持时抛出
          """
          if not os.path.exists(file_path):
              raise FileNotFoundError(f"文件不存在: {file_path}")
          
          # 检查文件是否为PDF格式
          if not file_path.lower().endswith('.pdf'):
              raise ValueError("仅支持PDF格式文件")
          
          # 核心提取逻辑
          text_content = self._extract_text_content(file_path, pages)
          
          return text_content.strip()
      
      def _extract_text_content(self, file_path: str, pages: List[int] = None) -> str:
          """
          内部方法：执行实际的文本提取
          
          注意：此方法不应直接调用，应通过extract_text方法调用
          """
          # 实现细节...
          pass
  ```
  
  ```javascript
  /**
   * PDF文档处理模块
   * 
   * 提供PDF文件的读取、解析和内容提取功能。
   * 支持文本提取、图像提取和元数据获取。
   */
  
  import os from 'os';
  
  /**
   * PDF文档处理器
   * 
   * 负责PDF文件的读取、解析和内容提取。
   * 支持批量处理和错误恢复。
   * 
   * @class
   */
  class PdfDocumentProcessor {
    /**
     * 创建PDF文档处理器实例
     * @param {Object} config - 处理器配置参数
     */
    constructor(config = {}) {
      this.config = config;
      this.logger = getLogger();
    }
    
    /**
     * 从PDF文件中提取文本内容
     * 
     * @param {string} filePath - PDF文件路径
     * @param {number[]} [pages] - 要提取的页码列表，默认为全部页面
     * @returns {string} 提取的文本内容
     * @throws {Error} 文件不存在或格式不支持时抛出
     */
    extractText(filePath, pages = []) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      // 检查文件是否为PDF格式
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        throw new Error("仅支持PDF格式文件");
      }
      
      // 核心提取逻辑
      const textContent = this._extractTextContent(filePath, pages);
      
      return textContent.trim();
    }
    
    /**
     * 内部方法：执行实际的文本提取
     * 
     * @private
     * @param {string} filePath - PDF文件路径
     * @param {number[]} pages - 要提取的页码列表
     * @returns {string} 提取的文本内容
     * 
     * 注意：此方法不应直接调用，应通过extractText方法调用
     */
    _extractTextContent(filePath, pages) {
      // 实现细节...
    }
  }
  ```
- 反向例子:
  ```python
  # 错误的注释示例
  
  # 这个类是用来处理PDF的
  class PdfProcessor:
      def __init__(self, config):
          # 初始化
          self.config = config
          self.logger = get_logger(__name__)
      
      # 提取文本
      def extract_text(self, file_path, pages=None):
          # 检查文件是否存在
          if not os.path.exists(file_path):
              raise FileNotFoundError(f"文件不存在: {file_path}")
          
          # 检查文件格式
          if not file_path.lower().endswith('.pdf'):
              raise ValueError("仅支持PDF格式文件")
          
          # 提取文本
          text = self._extract_text(file_path, pages)
          
          return text.strip()
      
      # 内部方法
      def _extract_text(self, file_path, pages):
          # 实现...
          pass
  ```
  
  ```javascript
  // 错误的注释示例
  
  // PDF处理类
  class PdfProcessor {
    constructor(config) {
      // 初始化
      this.config = config;
      this.logger = getLogger();
    }
    
    // 提取文本方法
    extractText(filePath, pages = []) {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      // 检查文件格式
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        throw new Error("仅支持PDF格式文件");
      }
      
      // 提取文本
      const text = this._extractText(filePath, pages);
      
      return text.trim();
    }
    
    // 内部方法
    _extractText(filePath, pages) {
      // 实现...
    }
  }