<![CDATA[<!-- VUE-COMPONENT-STRUCTURE-001.md -->
- **规范名称**: Vue组件结构规范
- **规范描述**: 定义Vue组件的标准结构要求，包括选项式API的组织顺序、Props定义、生命周期钩子等Vue特有的约定，确保Vue组件代码的规范性和一致性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: Vue 2.x/3.x组件的定义和结构
- **详细内容**:
  1. 组件必须有name属性定义组件名称
  2. Props定义使用对象形式并提供类型和默认值
  3. 选项按照固定顺序组织：name > props > data > computed > watch > lifecycle > methods
  4. 数据属性在data中初始化
  5. 计算属性用于派生数据
  6. 方法使用动词命名并处理用户交互

- **正向例子**:
  ```javascript
  export default {
    name: 'PdfUploader',
    
    props: {
      maxFileSize: {
        type: Number,
        default: 50 * 1024 * 1024, // 50MB
        validator: (value) => value > 0
      },
      allowedTypes: {
        type: Array,
        default: () => ['.pdf', '.doc', '.docx']
      }
    },
    
    data() {
      return {
        uploadProgress: 0,
        selectedFile: null,
        errorMessage: ''
      };
    },
    
    computed: {
      isValidFile() {
        return this.selectedFile && 
               this.selectedFile.size <= this.maxFileSize &&
               this.allowedTypes.some(type => this.selectedFile.name.endsWith(type));
      },
      
      uploadButtonText() {
        return this.uploadProgress > 0 ? 
               `上传中... ${this.uploadProgress}%` : 
               '选择文件上传';
      }
    },
    
    watch: {
      selectedFile(newFile) {
        if (newFile) {
          this.validateFile(newFile);
        }
      }
    },
    
    mounted() {
      console.log('PdfUploader component mounted');
    },
    
    methods: {
      async uploadFile() {
        if (!this.isValidFile) {
          this.errorMessage = '文件格式或大小不符合要求';
          return;
        }
        
        try {
          await this.$api.uploadPdf(this.selectedFile, this.onProgressUpdate);
          this.$emit('upload-success', this.selectedFile);
        } catch (error) {
          this.errorMessage = '上传失败: ' + error.message;
        }
      },
      
      onProgressUpdate(progress) {
        this.uploadProgress = progress;
      },
      
      validateFile(file) {
        // 文件验证逻辑
      }
    }
  };
  ```

- **反向例子**:
  ```javascript
  // 选项顺序混乱
  export default {
    methods: {
      uploadFile() {
        // 方法定义在前面
      }
    },
    
    data() { // data在methods后面
      return {
        progress: 0
      };
    },
    
    props: { // props在最后面
      maxSize: Number
    }
  };

  // Props定义不规范
  export default {
    props: ['maxSize', 'allowedTypes'], // 使用数组形式，缺少类型信息
    
    data() {
      return {
        file: null
      };
    },
    
    computed: {
      valid() { // 计算属性命名不清晰
        return this.file && this.file.size < this.maxSize;
      }
    }
  };

  // 生命周期钩子使用错误
  export default {
    created() {
      this.loadData(); // 在created中执行异步操作
    },
    
    methods: {
      async loadData() {
        // 异步数据加载
      }
    }
  };
  ```
]]>