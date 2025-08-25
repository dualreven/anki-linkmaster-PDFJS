<![CDATA[<!-- API-DATABASE-NAMING-001.md -->
- **规范名称**: API和数据库命名规范
- **规范描述**: 定义API端点和数据库表、字段的命名约定，遵循RESTful原则和数据库命名惯例，确保接口和数据结构的一致性和可读性。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: REST API端点和数据库设计
- **详细内容**:
  1. API端点使用kebab-case命名（小写字母，连字符分隔）
  2. 资源使用复数形式
  3. 数据库表使用snake_case命名（小写字母，下划线分隔）
  4. 数据库字段使用snake_case命名
  5. 主键使用`id`或`{table}_id`格式
  6. 时间字段使用`created_at`、`updated_at`等标准命名

- **正向例子**:
  ```javascript
  // REST API端点命名
  // 获取PDF文档列表
  GET /api/pdf-documents
  
  // 获取单个PDF文档
  GET /api/pdf-documents/{id}
  
  // 创建PDF文档
  POST /api/pdf-documents
  
  // 更新PDF文档
  PUT /api/pdf-documents/{id}
  
  // 删除PDF文档
  DELETE /api/pdf-documents/{id}
  
  // 嵌套资源
  GET /api/pdf-documents/{id}/pages
  GET /api/pdf-documents/{id}/pages/{pageId}
  
  // 操作端点
  POST /api/pdf-documents/{id}/extract-text
  POST /api/pdf-documents/{id}/generate-anki-cards
  ```

  ```sql
  -- 数据库表命名
  CREATE TABLE pdf_documents (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE user_sessions (
    user_id INTEGER REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  -- 关联表
  CREATE TABLE document_tags (
    document_id INTEGER REFERENCES pdf_documents(id),
    tag_id INTEGER REFERENCES tags(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, tag_id)
  );
  ```

- **反向例子**:
  ```javascript
  // API端点命名问题
  GET /api/pdfDocuments        // 驼峰命名，应为 kebab-case
  GET /api/pdf-document        // 单数形式，应为复数
  GET /api/getPdfDocuments     // 动词开头，应为名词资源
  POST /api/pdf-documents/create // 冗余动词
  
  // 不一致的命名风格
  GET /api/pdf_documents       // 蛇形命名，应为 kebab-case
  GET /api/PDF-DOCUMENTS       // 全大写，应为小写
  ```

  ```sql
  -- 数据库命名问题
  CREATE TABLE PdfDocuments (    -- 大驼峰，应为 snake_case
    ID SERIAL PRIMARY KEY,       -- 全大写，应为小写
    FileName VARCHAR(255),       -- 大驼峰，应为 snake_case
    fileSize INTEGER,            -- 驼峰，应为 snake_case
    createAt TIMESTAMP           -- 命名不一致
  );
  
  CREATE TABLE userSession (     -- 单数形式，应为复数
    userId INTEGER,              -- 驼峰，应为 snake_case
    sessionToken VARCHAR(255)    -- 驼峰，应为 snake_case
  );
  ```
]]>