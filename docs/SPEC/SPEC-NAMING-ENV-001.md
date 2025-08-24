<!-- SPEC-NAMING-ENV-001.md -->
- 规范名称: 环境变量命名规范
- 规范描述: 规定项目中环境变量的命名规则，确保环境变量的组织性和可读性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有环境变量定义
- 正向例子:
  ```bash
  # 环境变量命名 - 全大写，下划线分隔，前缀分组
  
  # 数据库相关环境变量
  DATABASE_URL="postgresql://localhost:5432/mydb"
  DATABASE_HOST="localhost"
  DATABASE_PORT="5432"
  DATABASE_NAME="mydb"
  DATABASE_USER="postgres"
  DATABASE_PASSWORD="password"
  
  # API相关环境变量
  API_URL="http://localhost:3000/api"
  API_TIMEOUT="30"
  API_VERSION="v1"
  
  # JWT相关环境变量
  JWT_SECRET="your-secret-key"
  JWT_EXPIRES_IN="3600"
  JWT_REFRESH_EXPIRES_IN="86400"
  
  # Vite前端环境变量 - VITE_前缀
  VITE_API_URL="http://localhost:3000/api"
  VITE_APP_TITLE="PDF Viewer"
  VITE_APP_VERSION="1.0.0"
  VITE_PUBLIC_PATH="/"
  
  # Python环境变量 - PYTHON_前缀
  PYTHON_ENV="development"
  PYTHON_PATH="/usr/local/bin/python"
  PYTHONBUFFERED="1"
  
  # Node.js环境变量 - NODE_前缀
  NODE_ENV="development"
  NODE_PATH="./src"
  NODE_TLS_REJECT_UNAUTHORIZED="0"
  
  # 应用配置环境变量 - APP_前缀
  APP_DEBUG="true"
  APP_LOG_LEVEL="info"
  APP_MAX_FILE_SIZE="52428800"
  
  # 文件存储环境变量 - FILE_前缀
  FILE_UPLOAD_PATH="./uploads"
  FILE_MAX_SIZE="52428800"
  FILE_ALLOWED_TYPES="pdf,docx,txt"
  ```
- 反向例子:
  ```bash
  # 错误的环境变量命名
  database_url="postgresql://localhost:5432/mydb"  # 非全大写
  DatabaseUrl="postgresql://localhost:5432/mydb"  # 大驼峰
  databaseUrl="postgresql://localhost:5432/mydb"  # 小驼峰
  
  # 缺少分组前缀的环境变量
  API_URL="http://localhost:3000/api"  # 应该有API_前缀
  SECRET_KEY="your-secret-key"  # 应该有JWT_前缀
  DEBUG="true"  # 应该有APP_前缀
  
  # 不一致的命名风格
  DATABASE_URL="postgresql://localhost:5432/mydb"  # 正确
  api_url="http://localhost:3000/api"  # 错误：与DATABASE_URL风格不一致
  jwtSecret="your-secret-key"  # 错误：camelCase
  
  # 过于通用的环境变量名
  URL="http://localhost:3000/api"  # 过于通用，应该有API_前缀
  SECRET="your-secret-key"  # 过于通用，应该有JWT_前缀
  PATH="./uploads"  # 过于通用，应该有FILE_前缀
  TIMEOUT="30"  # 过于通用，应该有API_前缀
  
  # 混合使用分隔符
  DATABASE_URL="postgresql://localhost:5432/mydb"  # 正确：下划线
  API-URL="http://localhost:3000/api"  # 错误：连字符
  JWT SECRET="your-secret-key"  # 错误：空格
  
  # 不必要的缩写
  DB_URL="postgresql://localhost:5432/mydb"  # 应该使用DATABASE_URL
  API_TMOUT="30"  # 应该使用API_TIMEOUT
  JWT_SEC="your-secret-key"  # 应该使用JWT_SECRET