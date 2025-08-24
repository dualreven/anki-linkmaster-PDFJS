<!-- SPEC-NAMING-API-001.md -->
- 规范名称: API端点命名规范
- 规范描述: 规定项目中API端点的命名规则，确保API接口的一致性和可读性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有API端点定义
- 正向例子:
  ```
  # RESTful API端点 - kebab-case，复数资源
  GET /api/pdf-documents           # 获取PDF文档列表
  GET /api/pdf-documents/{id}      # 获取单个PDF文档
  POST /api/pdf-documents          # 创建PDF文档
  PUT /api/pdf-documents/{id}      # 更新PDF文档
  DELETE /api/pdf-documents/{id}   # 删除PDF文档
  
  # Anki相关API端点
  GET /api/anki-cards              # 获取Anki卡片列表
  POST /api/anki-cards             # 创建Anki卡片
  GET /api/anki-cards/{id}         # 获取单个Anki卡片
  DELETE /api/anki-cards/{id}      # 删除Anki卡片
  
  # 用户相关API端点
  GET /api/users                   # 获取用户列表
  POST /api/users                  # 创建用户
  GET /api/users/{id}              # 获取单个用户
  PUT /api/users/{id}              # 更新用户
  DELETE /api/users/{id}           # 删除用户
  
  # 特殊操作API端点
  POST /api/pdf-documents/{id}/extract-text   # 提取PDF文本
  POST /api/pdf-documents/{id}/convert        # 转换PDF格式
  GET /api/anki-cards/generate-from-pdf      # 从PDF生成Anki卡片
  ```
- 反向例子:
  ```
  # 错误的API端点命名
  GET /api/pdfDocuments           # camelCase而非kebab-case
  GET /api/pdf_documents          # snake_case而非kebab-case
  GET /api/pdfdocument            # 单数资源而非复数
  GET /api/PdfDocuments           # 混合大小写
  
  # 错误的Anki相关API端点
  GET /api/ankiCards             # camelCase而非kebab-case
  GET /api/anki_cards            # snake_case而非kebab-case
  GET /api/ankicard              # 单数资源而非复数
  POST /api/create-anki-card     # 动词开头而非名词
  
  # 错误的用户相关API端点
  GET /api/Users                 # 混合大小写
  GET /api/user                  # 单数资源而非复数
  POST /api/add-user             # 动词开头而非名词
  PUT /api/update-user/{id}      # 动词开头而非名词
  
  # 错误的特殊操作API端点
  POST /api/pdf-documents/{id}/extractText   # camelCase而非kebab-case
  POST /api/pdf-documents/{id}/extract_text  # snake_case而非kebab-case
  GET /api/generate-anki-cards-from-pdf      # 过于复杂
  POST /api/pdf-documents/convert-pdf        # 资源路径不一致