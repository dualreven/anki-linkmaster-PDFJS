- **规范名称**: PDF.js集成规范
- **规范描述**: 规定PDF.js库的标准集成和使用方法，包括初始化配置、资源加载和性能优化，确保PDF查看功能的稳定性和一致性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: PDF查看器模块中所有使用PDF.js的代码
- **详细内容**: 
  - 必须使用统一的PDF.js初始化配置
  - 必须处理PDF文档加载的各个生命周期
  - 必须实现内存管理和资源释放
  - 必须提供清晰的错误处理和重试机制
  - 必须优化PDF渲染性能和内存使用
  - 必须支持多种PDF源（URL、Blob、ArrayBuffer）

- **正向例子**:
  ```javascript
  // PDF.js配置和初始化
  const PDFJS_CONFIG = {
    workerSrc: '/path/to/pdf.worker.js',
    cMapUrl: '/path/to/cmaps/',
    cMapPacked: true,
    disableAutoFetch: false,
    disableStream: false
  };

  // PDF文档加载器
  class PdfDocumentLoader {
    constructor() {
      this.pdfDoc = null;
      this.currentPage = 1;
      this.isLoading = false;
    }

    async loadDocument(source, password = '') {
      if (this.isLoading) {
        throw new Error('已有文档正在加载中');
      }

      this.isLoading = true;
      eventBus.emit(PDF_EVENTS.LOAD_START, { source });

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: source,
          ...PDFJS_CONFIG
        });

        this.pdfDoc = await loadingTask.promise;
        const numPages = this.pdfDoc.numPages;

        eventBus.emit(PDF_EVENTS.LOAD_SUCCESS, {
          source,
          numPages,
          metadata: await this.pdfDoc.getMetadata()
        });

        return this.pdfDoc;
      } catch (error) {
        console.error('PDF加载失败:', error);
        eventBus.emit(PDF_EVENTS.LOAD_ERROR, {
          source,
          error: error.message,
          retryable: this.isRetryableError(error)
        });
        throw error;
      } finally {
        this.isLoading = false;
      }
    }

    isRetryableError(error) {
      // 判断错误是否可重试
      return error.name === 'PasswordException' || 
             error.name === 'InvalidPDFException';
    }

    destroy() {
      if (this.pdfDoc) {
        this.pdfDoc.destroy();
        this.pdfDoc = null;
      }
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：硬编码配置
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'some/path'; // 应该使用统一配置
  
  // 错误：缺乏错误处理
  pdfjsLib.getDocument(url).promise.then(doc => {
    // 没有catch错误处理
  });
  
  // 错误：缺乏资源释放
  let pdfDoc = await pdfjsLib.getDocument(url).promise;
  // 使用后没有调用destroy()，可能导致内存泄漏
  
  // 错误：缺乏加载状态管理
  async function loadPdf() {
    // 没有检查是否正在加载
    // 没有发出加载开始事件
  }
  
  // 错误：不支持多种PDF源
  function loadPdfOnlyFromUrl(url) {
    // 只支持URL，不支持Blob或ArrayBuffer
  }
  ```