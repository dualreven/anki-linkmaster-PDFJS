<!-- SPEC-NAMING-CONSTANT-001.md -->
- 规范名称: 常量命名规范
- 规范描述: 规定项目中常量的命名规则，确保常量名清晰表达其不变的特性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有代码文件中的常量声明
- 正向例子:
  ```python
  # Python常量命名 - 全大写，下划线分隔
  MAX_PDF_SIZE = 50 * 1024 * 1024  # 最大PDF文件大小
  API_TIMEOUT = 30  # API超时时间（秒）
  SUPPORTED_TYPES = ['pdf', 'docx', 'txt']  # 支持的文件类型
  DEFAULT_VALUE = 100  # 默认值
  DATABASE_URL = "postgresql://localhost:5432/mydb"  # 数据库连接URL
  JWT_SECRET = "your-secret-key"  # JWT密钥
  ```
  
  ```javascript
  // JavaScript常量命名 - 全大写，下划线分隔
  const MAX_PDF_SIZE = 50 * 1024 * 1024;  // 最大PDF文件大小
  const API_TIMEOUT = 30;  // API超时时间（秒）
  const SUPPORTED_TYPES = ['pdf', 'docx', 'txt'];  // 支持的文件类型
  const DEFAULT_VALUE = 100;  // 默认值
  const DATABASE_URL = "postgresql://localhost:5432/mydb";  // 数据库连接URL
  const JWT_SECRET = "your-secret-key";  // JWT密钥
  ```
  
  ```javascript
  // 环境变量常量命名 - 全大写，下划线分隔，前缀分组
  const VITE_API_URL = "http://localhost:3000/api";  // Vite环境变量
  const VITE_APP_TITLE = "PDF Viewer";  // Vite环境变量
  const PYTHON_ENV = "development";  # Python环境变量
  const NODE_ENV = "development";  # Node.js环境变量
  ```
- 反向例子:
  ```python
  # 错误的Python常量命名
  max_pdf_size = 50 * 1024 * 1024  # 非全大写
  apiTimeout = 30  # camelCase
  supportedTypes = ['pdf', 'docx', 'txt']  # camelCase
  DefaultValue = 100  # 大驼峰
  database_url = "postgresql://localhost:5432/mydb"  # 非全大写
  jwtSecret = "your-secret-key"  # camelCase
  ```
  
  ```javascript
  // 错误的JavaScript常量命名
  const max_pdf_size = 50 * 1024 * 1024;  // 非全大写
  const apiTimeout = 30;  // camelCase
  const supportedTypes = ['pdf', 'docx', 'txt'];  // camelCase
  const DefaultValue = 100;  // 大驼峰
  const database_url = "postgresql://localhost:5432/mydb";  // 非全大写
  const jwtSecret = "your-secret-key";  // camelCase
  ```
  
  ```javascript
  // 错误的环境变量常量命名
  const viteApiUrl = "http://localhost:3000/api";  // 非全大写，无前缀
  const VITEAPIURL = "http://localhost:3000/api";  // 无下划线分隔
  const app_title = "PDF Viewer";  // 非全大写，无前缀
  const pythonEnv = "development";  # 非全大写
  const node_env = "development";  # 非全大写