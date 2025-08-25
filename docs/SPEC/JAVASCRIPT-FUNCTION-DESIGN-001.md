<![CDATA[<!-- JAVASCRIPT-FUNCTION-DESIGN-001.md -->
- **规范名称**: JavaScript函数设计规范
- **规范描述**: 定义JavaScript函数的设计原则和结构要求，包括异步处理、错误处理、参数设计等JavaScript特有的约定，确保JavaScript函数的可靠性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: JavaScript函数的定义和使用
- **详细内容**:
  1. 函数不超过50行，保持短小精悍
  2. 使用JSDoc注释说明函数用途和参数
  3. 异步函数使用async/await语法
  4. 错误处理使用try/catch和明确的错误类型
  5. 参数使用解构和默认值
  6. 遵循单一职责原则

- **正向例子**:
  ```javascript
  /**
   * 从PDF数据提取文本内容
   * @param {ArrayBuffer} pdfData - PDF文件数据
   * @param {Object} [options={}] - 配置选项
   * @param {number[]} [options.pages=[]] - 要提取的页面
   * @param {boolean} [options.ocrEnabled=false] - 是否启用OCR
   * @returns {Promise<string>} 提取的文本内容
   * @throws {Error} 当PDF数据无效时
   */
  async function extractTextFromPdf(pdfData, options = {}) {
    // 参数解构和默认值
    const { pages = [], ocrEnabled = false } = options;
    
    // 参数验证
    if (!pdfData || pdfData.byteLength === 0) {
      throw new Error('PDF数据不能为空');
    }
    
    if (!Array.isArray(pages)) {
      throw new Error('pages参数必须是数组');
    }
    
    try {
      // 核心逻辑
      const text = await processPdfContent(pdfData, pages, ocrEnabled);
      return text.trim();
    } catch (error) {
      console.error('提取PDF文本失败:', error);
      throw new Error(`提取失败: ${error.message}`);
    }
  }
  
  /**
   * 加载PDF文档
   * @param {string} url - PDF文件URL
   * @returns {Promise<ArrayBuffer>} PDF文件数据
   */
  async function loadPdfDocument(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error('加载PDF失败:', error);
      throw new Error(`加载失败: ${error.message}`);
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 函数过长，职责过多
  function processPdfData(pdfData, options) {
    // 50+行的复杂逻辑，包含数据处理、文本提取、错误处理等
  }
  
  // 缺少注释和错误处理
  function extractText(pdfData, pages, ocr) {
    // 缺少JSDoc注释和参数验证
    return processData(pdfData);
  }
  
  // 回调地狱和错误处理不当
  function loadPdf(url, callback) {
    fetch(url)
      .then(response => response.arrayBuffer())
      .then(data => callback(null, data))
      .catch(error => {
        console.log(error); // 只是打印，没有处理
        callback(error);
      });
  }
  
  // 参数设计不合理
  function processData(data, page, ocr, format, quality) {
    // 参数过多，应该使用选项对象
    // 缺少参数验证和默认值
  }
  
  // 混合使用async/await和回调
  async function confusingFunction(url, callback) {
    try {
      const data = await fetch(url);
      callback(null, data); // 混合模式
    } catch (error) {
      callback(error);
    }
  }
  ```
]]>