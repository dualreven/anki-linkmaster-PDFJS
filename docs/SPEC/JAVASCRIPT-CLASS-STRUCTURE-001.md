<![CDATA[<!-- JAVASCRIPT-CLASS-STRUCTURE-001.md -->
- **规范名称**: JavaScript类结构规范
- **规范描述**: 定义JavaScript/TypeScript类的基本结构要求，包括JSDoc注释、访问控制、现代JavaScript特性等，确保JavaScript代码的规范性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: JavaScript/TypeScript类的定义和结构
- **详细内容**:
  1. 类必须有JSDoc注释说明用途
  2. 使用ES6+的类语法和特性
  3. 私有字段和方法使用 `#` 前缀（现代JavaScript）
  4. 公共方法提供清晰的接口定义
  5. 构造函数应进行必要的初始化
  6. 遵循一致的代码风格（如Airbnb风格指南）

- **正向例子**:
  ```javascript
  /**
   * PDF文档查看器类
   * 负责PDF文件的渲染、缩放等操作
   */
  class PdfDocumentViewer {
    /**
     * 创建PDF查看器实例
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.container - 容器元素
     * @param {string} options.pdfUrl - PDF文件URL
     * @param {number} [options.scale=1.0] - 初始缩放比例
     */
    constructor(options) {
      this.container = options.container;
      this.pdfUrl = options.pdfUrl;
      this.scale = options.scale || 1.0;
      
      // 私有字段
      this.#isInitialized = false;
      this.#pdfDocument = null;
      
      this.#initialize();
    }
    
    /**
     * 渲染PDF文档
     * @returns {Promise<void>}
     */
    async render() {
      if (!this.#isInitialized) {
        throw new Error('Viewer not initialized');
      }
      // 渲染逻辑
    }
    
    /**
     * 放大文档
     */
    zoomIn() {
      this.scale *= 1.2;
      this.render();
    }
    
    /**
     * 初始化查看器（私有方法）
     */
    #initialize() {
      // 初始化逻辑
      this.#isInitialized = true;
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 缺少JSDoc注释
  class PdfViewer {
    constructor(options) {
      this.container = options.container;
      // 缺少必要的初始化
    }
    
    render() { // 缺少注释和类型信息
      // 渲染逻辑
    }
  }

  // 使用旧的私有方法约定
  class OldViewer {
    constructor() {
      this._privateField = ''; // 应该使用 # 前缀
    }
    
    _privateMethod() { // 应该使用 # 前缀
      // 私有逻辑
    }
  }

  // 结构混乱的类
  class BadViewer {
    constructor() {
      this.init(); // 构造函数中调用复杂逻辑
    }
    
    init() {
      // 复杂的初始化逻辑
    }
    
    // 公共和私有方法混合
    publicMethod() {
      // 公共逻辑
    }
    
    #privateMethod() {
      // 私有逻辑
    }
  }
  ```
]]>