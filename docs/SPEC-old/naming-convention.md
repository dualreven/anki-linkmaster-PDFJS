# 命名规范

## 核心原则
- **语义清晰**：见名知意
- **统一风格**：全项目一致
- **简洁明确**：避免冗余

## 文件命名
| 类型 | 格式 | 示例 |
|---|---|---|
| 文件 | kebab-case | `pdf-processor.js`, `user-service.py` |
| 目录 | kebab-case | `pdf-viewer/`, `api-services/` |
| 测试 | `.spec.js` `.test.py` | `pdf-parser.spec.js`, `test_pdf_parser.py` |
| 配置 | 点开头 | `.env`, `vite.config.js` |

## 变量命名
| 语言 | 格式 | 示例 |
|---|---|---|
| Python | snake_case | `pdf_file_path`, `max_size` |
| JavaScript | camelCase | `pdfFilePath`, `maxSize` |
| SQL | snake_case | `user_id`, `created_at` |

## 函数命名
- **动词开头**：`getUserData()`, `validateInput()`
- **布尔返回**：`isValid()`, `hasPermission()`
- **异步标识**：`async fetchData()`

## 类命名
- **大驼峰**：`PdfDocumentProcessor`, `AnkiCardGenerator`
- **名词优先**：避免`Manager`, `Handler`等通用词
- **Vue组件**：文件名与组件名一致

## 常量命名
- **全大写**：`MAX_PDF_SIZE`, `API_TIMEOUT`
- **下划线分隔**：`SUPPORTED_TYPES`, `DEFAULT_VALUE`

## API端点
- **RESTful**：`GET /api/pdf-documents/{id}`
- **kebab-case**：`/anki-cards/generate`
- **复数资源**：`/pdf-documents`, `/users`

## 数据库
- **表**：复数`pdf_documents`, `user_sessions`
- **字段**：snake_case `created_at`, `file_size`
- **主键**：`id` 或 `{table}_id`

## 环境变量
- **全大写**：`DATABASE_URL`, `JWT_SECRET`
- **前缀分组**：`VITE_API_URL`, `PYTHON_ENV`

## 命名检查清单
- [ ] 符合语言规范
- [ ] 避免缩写
- [ ] 无拼写错误
- [ ] 语义清晰