<!-- SPEC-FUNCTION-001.md -->
- 规范名称: 函数规范
- 规范描述: 规定项目中函数的设计原则和实现规范，确保函数简洁、高效、可维护
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的函数实现
- 正向例子:
  ```python
  from typing import List, Optional
  import os
  
  
  def extract_text_from_pdf(file_path: str, pages: Optional[List[int]] = None) -> str:
      """
      从PDF文件中提取文本内容
      
      Args:
          file_path (str): PDF文件路径
          pages (Optional[List[int]]): 要提取的页码列表，默认为全部页面
          
      Returns:
          str: 提取的文本内容
          
      Raises:
          FileNotFoundError: 文件不存在时抛出
          ValueError: 文件格式不支持时抛出
      """
      # 参数验证
      if not os.path.exists(file_path):
          raise FileNotFoundError(f"文件不存在: {file_path}")
      
      if not file_path.lower().endswith('.pdf'):
          raise ValueError("仅支持PDF格式文件")
      
      # 核心逻辑
      text = _extract_text_content(file_path, pages)
      
      # 结果处理
      return text.strip()
  
  
  def _extract_text_content(file_path: str, pages: Optional[List[int]] = None) -> str:
      """内部方法：执行实际的文本提取"""
      # 实现细节...
      pass
  
  
  def process_large_pdf(file_path: str) -> dict:
      """
      处理大型PDF文件
      
      将复杂逻辑拆分为多个小函数，保持每个函数简洁
      """
      metadata = _extract_metadata(file_path)
      text = _extract_text(file_path)
      images = _extract_images(file_path)
      return _combine_results(metadata, text, images)
  
  
  async def fetch_pdf_data(url: str) -> bytes:
      """
      异步获取PDF数据
      
      统一错误处理，确保异常情况得到妥善处理
      """
      try:
          import aiohttp
          
          async with aiohttp.ClientSession() as session:
              async with session.get(url) as response:
                  if response.status != 200:
                      raise ValueError(f"HTTP {response.status}")
                  return await response.read()
                  
      except Exception as error:
          print(f"获取PDF数据失败: {error}")
          raise
  ```
  
  ```javascript
  /**
   * 从PDF文件中提取文本内容
   * 
   * @param {string} filePath - PDF文件路径
   * @param {number[]} [pages] - 要提取的页码列表，默认为全部页面
   * @returns {Promise<string>} 提取的文本内容
   * @throws {Error} 文件不存在或格式不支持时抛出
   */
  async function extractTextFromPdf(filePath, pages = []) {
    // 参数解构
    const options = { pages, ocrEnabled: false };
    
    // 参数验证
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('文件路径不能为空');
    }
    
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      throw new Error("仅支持PDF格式文件");
    }
    
    // 核心逻辑
    const text = await processPdfContent(filePath, options);
    
    return text.trim();
  }
  
  /**
   * 处理大型PDF文件
   * 
   * 将复杂逻辑拆分为多个小函数，保持每个函数简洁
   * 
   * @param {string} filePath - PDF文件路径
   * @returns {Promise<Object>} 处理结果
   */
  async function processLargePdf(filePath) {
    const metadata = await extractMetadata(filePath);
    const text = await extractText(filePath);
    const images = await extractImages(filePath);
    return combineResults(metadata, text, images);
  }
  
  /**
   * 加载PDF文档
   * 
   * 统一错误处理，确保异常情况得到妥善处理
   * 
   * @param {string} url - PDF文档URL
   * @returns {Promise<ArrayBuffer>} PDF文档数据
   */
  async function loadPdfDocument(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.arrayBuffer();
      
    } catch (error) {
      console.error('加载PDF失败:', error);
      throw error;
    }
  }
  ```
- 反向例子:
  ```python
  # 错误的函数实现示例
  
  # 函数过长，违反单一职责原则
  def process_pdf_file(file_path):
      # 50+行的复杂逻辑
      if not os.path.exists(file_path):
          raise FileNotFoundError(f"文件不存在: {file_path}")
      
      if not file_path.lower().endswith('.pdf'):
          raise ValueError("仅支持PDF格式文件")
      
      # 大量处理逻辑...
      # 提取元数据
      # 提取文本
      # 提取图像
      # 处理文本
      # 处理图像
      # 组合结果
      # 保存结果
      # 返回结果
      pass
  
  # 缺少类型注解
  def extract_text(file_path, pages=None):
      if not os.path.exists(file_path):
          raise FileNotFoundError(f"文件不存在: {file_path}")
      
      text = ""
      # 处理逻辑...
      return text
  
  # 参数过多，应使用参数对象
  def process_pdf(file_path, extract_text=True, extract_images=True, 
                  extract_metadata=True, ocr_enabled=False, 
                  language="eng", dpi=300):
      # 实现...
      pass
  
  # 缺少错误处理
  def read_pdf_file(file_path):
      with open(file_path, 'rb') as f:
          return f.read()
  ```
  
  ```javascript
  // 错误的函数实现示例
  
  // 函数过长，违反单一职责原则
  function processPdfFile(filePath) {
    // 50+行的复杂逻辑
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      throw new Error("仅支持PDF格式文件");
    }
    
    // 大量处理逻辑...
    // 提取元数据
    // 提取文本
    // 提取图像
    // 处理文本
    // 处理图像
    // 组合结果
    // 保存结果
    // 返回结果
  }
  
  // 缺少参数验证和类型检查
  function extractText(filePath, pages) {
    const text = "";
    // 处理逻辑...
    return text;
  }
  
  // 参数过多，应使用参数对象
  function processPdf(filePath, extractText = true, extractImages = true, 
                      extractMetadata = true, ocrEnabled = false, 
                      language = "eng", dpi = 300) {
    // 实现...
  }
  
  // 缺少错误处理
  async function readPdfFile(filePath) {
    const data = await fs.promises.readFile(filePath);
    return data;
  }
  
  // 同步函数应该用异步函数替代
  function loadPdfDocument(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);  // 同步请求
    xhr.send();
    return xhr.response;
  }