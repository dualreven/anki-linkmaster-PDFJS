<![CDATA[<!-- ENV-VARIABLE-NAMING-001.md -->
- **规范名称**: 环境变量命名规范
- **规范描述**: 定义环境变量的命名约定，确保环境变量命名一致、语义清晰，便于配置管理和跨环境部署。
- **当前版本**: 1.0
- **所属范畴**: 部署规范
- **适用范围**: 所有环境变量配置
- **详细内容**:
  1. 环境变量使用UPPER_CASE命名（全大写，下划线分隔）
  2. 使用前缀分组相关配置
  3. 布尔值使用明确的true/false或1/0
  4. 敏感信息如密码、密钥使用_SECRET或_KEY后缀
  5. URL和连接字符串使用_URL或_CONNECTION后缀
  6. 数值配置使用明确的单位后缀

- **正向例子**:
  ```bash
  # 数据库配置
  DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
  DATABASE_MAX_CONNECTIONS=20
  DATABASE_TIMEOUT_MS=30000
  
  # 应用配置
  APP_PORT=3000
  APP_ENV=production
  APP_DEBUG=false
  APP_LOG_LEVEL=info
  
  # API配置
  API_BASE_URL=https://api.example.com
  API_TIMEOUT_MS=5000
  API_MAX_RETRIES=3
  
  # 安全配置
  JWT_SECRET=your-secret-key-here
  ENCRYPTION_KEY=your-encryption-key
  ADMIN_PASSWORD_SECRET=admin-pass
  
  # 第三方服务
  AWS_ACCESS_KEY_ID=your-aws-key
  AWS_SECRET_ACCESS_KEY=your-aws-secret
  S3_BUCKET_NAME=my-app-bucket
  
  # 功能开关
  FEATURE_OCR_ENABLED=true
  FEATURE_ANKI_EXPORT_ENABLED=false
  MAINTENANCE_MODE=false
  ```

- **反向例子**:
  ```bash
  # 命名不一致
  databaseUrl=postgresql://...          # 驼峰命名，应为 UPPER_CASE
  app-port=3000                        # kebab-case，应为 UPPER_CASE
  DB_MAX_CONNECTIONS=20                # 混合前缀
  
  # 语义不清晰
  DB=postgresql://...                  # 过于简略
  URL=https://api.example.com          # 缺少上下文
  KEY=secret-value                     # 用途不明确
  
  # 布尔值不明确
  DEBUG=1                              # 应该使用 true/false
  MAINTENANCE=yes                      # 应该使用 true/false
  
  # 缺少分组前缀
  PORT=3000                            # 缺少APP_前缀
  ENV=production                       # 缺少APP_前缀
  LOG_LEVEL=info                       # 缺少APP_前缀
  
  # 安全风险
  PASSWORD=plaintext-password          # 明文密码，应使用_SECRET后缀
  SECRET_KEY=value                     # 密钥命名不明确
  ```
]]>