<!-- SPEC-NAMING-DATABASE-001.md -->
- 规范名称: 数据库命名规范
- 规范描述: 规定项目中数据库相关对象的命名规则，确保数据库结构的一致性和可读性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有数据库对象（表、字段、索引等）
- 正向例子:
  ```sql
  -- 表命名 - 复数形式，snake_case
  CREATE TABLE pdf_documents (
      id SERIAL PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT NOT NULL,
      page_count INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      user_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  CREATE TABLE anki_cards (
      id SERIAL PRIMARY KEY,
      pdf_document_id INTEGER REFERENCES pdf_documents(id),
      front_text TEXT NOT NULL,
      back_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  CREATE TABLE user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      session_token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  -- 字段命名 - snake_case，描述性名称
  -- 主键字段
  id SERIAL PRIMARY KEY,
  
  -- 外键字段 - {表名}_id
  pdf_document_id INTEGER REFERENCES pdf_documents(id),
  user_id INTEGER REFERENCES users(id),
  
  -- 时间戳字段
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  
  -- 布尔字段 - is_前缀
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- 索引命名 - idx_{表名}_{字段名}
  CREATE INDEX idx_pdf_documents_file_name ON pdf_documents(file_name);
  CREATE INDEX idx_users_email ON users(email);
  CREATE INDEX idx_anki_cards_pdf_document_id ON anki_cards(pdf_document_id);
  ```
- 反向例子:
  ```sql
  -- 错误的表命名
  CREATE TABLE PdfDocument (  -- 单数形式，大驼峰
      id SERIAL PRIMARY KEY,
      fileName VARCHAR(255),  -- camelCase
      fileSize BIGINT,        -- camelCase
      pageCount INTEGER,      -- camelCase
      createdAt TIMESTAMP,    -- camelCase
      updatedAt TIMESTAMP     -- camelCase
  );
  
  CREATE TABLE pdf_document (  -- 单数形式
      id SERIAL PRIMARY KEY,
      file_name VARCHAR(255),
      file_size BIGINT,
      page_count INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
  );
  
  CREATE TABLE PDFDocuments (  -- 混合大小写
      id SERIAL PRIMARY KEY,
      file_name VARCHAR(255),
      file_size BIGINT,
      page_count INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
  );
  
  -- 错误的字段命名
  CREATE TABLE pdf_documents (
      ID SERIAL PRIMARY KEY,  -- 大写
      FileName VARCHAR(255),  -- 大驼峰
      fileSize BIGINT,        -- camelCase
      PageCount INTEGER,      -- 大驼峰
      createdAt TIMESTAMP,    -- camelCase
      updatedAt TIMESTAMP     -- camelCase
  );
  
  -- 错误的外键命名
  CREATE TABLE anki_cards (
      id SERIAL PRIMARY KEY,
      pdfId INTEGER REFERENCES pdf_documents(id),  -- 非snake_case，无_id后缀
      userId INTEGER REFERENCES users(id),         -- 非snake_case，无_id后缀
      front_text TEXT NOT NULL,
      back_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  -- 错误的时间戳命名
  CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      user_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      creation_date TIMESTAMP,  -- 非标准命名
      modification_date TIMESTAMP  -- 非标准命名
  );
  
  -- 错误的布尔字段命名
  CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      user_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      active BOOLEAN,  -- 无is_前缀
      verified BOOLEAN,  -- 无is_前缀
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  -- 错误的索引命名
  CREATE INDEX pdf_documents_file_name ON pdf_documents(file_name);  -- 无idx_前缀
  CREATE INDEX email_index ON users(email);  -- 非标准命名
  CREATE INDEX anki_cards_pdf ON anki_cards(pdf_document_id);  -- 非标准命名